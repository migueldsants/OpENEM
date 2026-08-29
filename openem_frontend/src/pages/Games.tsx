import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type GameCatalogItem,
  type GamificationDelta,
  type LeaderboardEntry,
} from '../api';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconBolt, IconClock, IconGame, IconTarget } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { useGamification } from '../gamification';

type Phase = 'menu' | 'playing' | 'over';

interface Problem {
  a: number;
  b: number;
  op: '+' | '-' | '×' | '÷';
  answer: number;
}

const LEVELS = [
  { key: 'facil', label: 'Fácil', max: 10, ops: ['+', '-'] as const, time: 8 },
  { key: 'medio', label: 'Médio', max: 50, ops: ['+', '-', '×'] as const, time: 6 },
  {
    key: 'dificil',
    label: 'Difícil',
    max: 100,
    ops: ['+', '-', '×', '÷'] as const,
    time: 5,
  },
];

function rnd(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

function makeProblem(level: (typeof LEVELS)[number]): Problem {
  const op = level.ops[Math.floor(Math.random() * level.ops.length)];
  let a = rnd(level.max);
  let b = rnd(level.max);
  if (op === '-') {
    if (b > a) [a, b] = [b, a]; // resultado não-negativo
    return { a, b, op, answer: a - b };
  }
  if (op === '÷') {
    // garante divisão exata: b = divisor, a = múltiplo
    b = Math.max(2, rnd(10));
    a = b * rnd(level.max);
    return { a, b, op, answer: a / b };
  }
  if (op === '×') {
    // mantém operandos menores para multiplicação
    a = rnd(Math.min(12, level.max));
    b = rnd(Math.min(12, level.max));
    return { a, b, op, answer: a * b };
  }
  return { a, b, op, answer: a + b };
}

/** Minigame Cálculo Mental: resoluções rápidas com combo e bônus de velocidade. */
function CalcMental({
  levelKey,
  onOver,
  onQuit,
}: {
  levelKey: string;
  onOver: (score: number, level: number, durationSec: number) => void;
  onQuit: () => void;
}) {
  const level = LEVELS.find((l) => l.key === levelKey) ?? LEVELS[0];
  const [problem, setProblem] = useState<Problem>(() => makeProblem(level));
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(level.time);
  const [roundStart, setRoundStart] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef(Date.now());

  // Re-gera um problema e reinicia o cronômetro da rodada.
  const next = useCallback(() => {
    setProblem(makeProblem(level));
    setGuess('');
    setFeedback(null);
    setRoundStart(Date.now());
    setTimeLeft(level.time);
  }, [level]);

  // Foco no input a cada rodada.
  useEffect(() => {
    inputRef.current?.focus();
  }, [problem]);

  // Cronômetro regressivo da rodada.
  useEffect(() => {
    if (feedback) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // tempo esgotado = erro
          setFeedback('no');
          setCombo(0);
          setLives((l) => l - 1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [feedback, problem]);

  // Fim de jogo quando as vidas acabam.
  useEffect(() => {
    if (lives <= 0) {
      const durationSec = Math.round((Date.now() - startRef.current) / 1000);
      const finalLevel = Math.min(3, 1 + Math.floor(score / 20));
      onOver(score, finalLevel, durationSec);
    }
  }, [lives, onOver, score]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (feedback || guess === '') return;
    const value = Number(guess);
    if (Number.isNaN(value)) return;
    const elapsed = (Date.now() - roundStart) / 1000;
    if (value === problem.answer) {
      const speedBonus = elapsed < 3 ? 2 : 1;
      const gained = (1 + combo) * speedBonus;
      setScore((s) => s + gained);
      setCombo((c) => c + 1);
      setFeedback('ok');
    } else {
      setFeedback('no');
      setCombo(0);
      setLives((l) => l - 1);
    }
  }

  // Avança após mostrar o feedback (acerto ou erro).
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => next(), feedback === 'ok' ? 500 : 900);
    return () => clearTimeout(id);
  }, [feedback, next]);

  const timePct = Math.round((timeLeft / level.time) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onQuit} className="btn btn-ghost shrink-0">
          Sair
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-display text-sm font-bold tabular-nums">
            {score}
            <span className="text-muted"> pts</span>
          </p>
          <p className="text-[0.68rem] text-muted">
            combo ×{combo} · {lives} vidas
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-display text-sm font-bold tabular-nums ${
            timeLeft <= 2 ? 'bg-red/12 text-red' : 'bg-surface-2 text-fg'
          }`}
        >
          <IconClock width={16} height={16} />
          {timeLeft}s
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 linear ${
            timeLeft <= 2 ? 'bg-red' : 'bg-brand'
          }`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      <div
        className={`card card-raised p-8 text-center transition-colors ${
          feedback === 'ok'
            ? 'bg-nat/10'
            : feedback === 'no'
              ? 'bg-red/10'
              : ''
        }`}
      >
        <p className="font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
          {problem.a} {problem.op} {problem.b}
        </p>
        <p className="mt-1 text-xs text-muted">= ?</p>

        <form onSubmit={submit} className="mt-5">
          <input
            ref={inputRef}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            inputMode="numeric"
            pattern="[0-9-]*"
            placeholder="Sua resposta"
            className="input mx-auto w-40 text-center text-2xl font-bold tabular-nums"
            disabled={!!feedback}
          />
          {!feedback && (
            <button type="submit" className="btn btn-primary mt-3" disabled={guess === ''}>
              Confirmar
            </button>
          )}
        </form>

        {feedback === 'ok' && (
          <p className="mt-3 text-sm font-semibold text-nat">
            Acertou! +{(1 + combo - 1) * (Date.now() - roundStart < 3000 ? 2 : 1)} pts
          </p>
        )}
        {feedback === 'no' && (
          <p className="mt-3 text-sm font-semibold text-red">
            Resposta: {problem.answer}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        Acerte em menos de 3s para dobrar os pontos da rodada.
      </p>
    </div>
  );
}

/** Card de um minigame no menu. */
function GameCard({
  game,
  onPlay,
}: {
  game: GameCatalogItem;
  onPlay: (levelKey: string) => void;
}) {
  const [selected, setSelected] = useState(game.levels[0]?.key ?? '');
  return (
    <li className="card card-raised overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <IconGame width={22} height={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold">{game.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {game.description}
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {game.scoring}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="seg">
            {game.levels.map((l) => (
              <button
                key={l.key}
                data-active={selected === l.key}
                onClick={() => setSelected(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onPlay(selected)}
            className="btn btn-primary ml-auto"
          >
            <IconTarget width={16} height={16} />
            Jogar
          </button>
        </div>
      </div>
    </li>
  );
}

function Leaderboard({
  title,
  entries,
  unit = 'pontos',
}: {
  title: string;
  entries: LeaderboardEntry[];
  unit?: string;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nenhum resultado ainda. Seja o primeiro a jogar!
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {entries.map((e, i) => (
            <li
              key={e.userId}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold tabular-nums ${
                  i === 0
                    ? 'bg-mat/15 text-mat'
                    : i === 1
                      ? 'bg-surface-2 text-muted'
                      : i === 2
                        ? 'bg-hum/15 text-hum'
                        : 'bg-surface-2 text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {e.displayName}
              </span>
              <span className="shrink-0 font-display font-bold tabular-nums text-brand">
                {e.bestScore}{' '}
                <span className="text-xs font-medium text-muted">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Games() {
  const { refresh } = useGamification();
  const [games, setGames] = useState<GameCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('menu');
  const [activeLevel, setActiveLevel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [globalBoard, setGlobalBoard] = useState<LeaderboardEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [g, b, gb] = await Promise.all([
        api.gameCatalog(),
        api.gameLeaderboard('calculo-mental', 10).catch(() => []),
        api.globalLeaderboard(10).catch(() => []),
      ]);
      setGames(g);
      setBoard(b);
      setGlobalBoard(gb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleOver(score: number, level: number, durationSec: number) {
    setPhase('over');
    if (score <= 0) return;
    setError(null);
    try {
      const res = await api.submitGameScore(
        'calculo-mental',
        score,
        level,
        durationSec,
      );
      if (res.gamification) {
        setAward(res.gamification);
        void refresh();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  if (phase === 'playing') {
    return (
      <div className="space-y-5 pb-28 md:pb-24">
        <CalcMental
          levelKey={activeLevel}
          onOver={handleOver}
          onQuit={() => setPhase('menu')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Minigames</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Games
        </h1>
        <p className="mt-1 text-sm text-muted">
          Treine o raciocínio rápido e ganhe XP jogando.
        </p>
      </header>

      {error && (
        <ErrorBanner message={error} />
      )}

      {phase === 'over' && (
        <div className="card card-raised p-5">
          <div className="flex items-center gap-2">
            <IconBolt width={20} height={20} className="text-brand" filled />
            <p className="font-display text-lg font-bold">Partida concluída!</p>
          </div>
          {award && (
            <div className="mt-2">
              <GamificationFeedback g={award} />
            </div>
          )}
          <button
            onClick={() => {
              setAward(null);
              setPhase('menu');
            }}
            className="btn btn-primary mt-3"
          >
            Voltar ao menu
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : (
        <ul className="space-y-3">
          {games.map((g) => (
            <GameCard
              key={g.key}
              game={g}
              onPlay={(levelKey) => {
                setAward(null);
                setActiveLevel(levelKey);
                setPhase('playing');
              }}
            />
          ))}
        </ul>
      )}

      <Leaderboard title="Ranking — Cálculo Mental" entries={board} />
      <Leaderboard
        title="Ranking geral (XP)"
        entries={globalBoard}
        unit="XP"
      />
    </div>
  );
}