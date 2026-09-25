import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type GameCatalogItem,
  type GamificationDelta,
  type LeaderboardEntry,
} from '../api';
import { GamificationFeedback } from '../components/GamificationFeedback';
import {
  IconBolt,
  IconClock,
  IconFlame,
  IconGame,
  IconHeart,
  IconTarget,
  IconTrophy,
} from '../components/icons';
import Reveal from '../components/Reveal';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { useAuth } from '../auth';
import { useGamification } from '../gamification';
import { PageHeader } from '../components/PageHeader';

type Phase = 'menu' | 'playing' | 'over';

/** Resultado de uma partida, comum a qualquer minigame. */
export interface GameResult {
  score: number;
  level: number;
  durationSec: number;
}

/** Contrato que todo minigame implementa para plugar no catálogo. */
interface GameComponentProps {
  levelKey: string;
  onFinish: (result: GameResult) => void;
}

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
function CalcMental({ levelKey, onFinish }: GameComponentProps) {
  const level = LEVELS.find((l) => l.key === levelKey) ?? LEVELS[0];
  const [problem, setProblem] = useState<Problem>(() => makeProblem(level));
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(level.time);
  const [roundStart, setRoundStart] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);
  // Pontos da rodada, congelados no momento do acerto — recalcular no render
  // com Date.now() podia exibir ×1 numa rodada que pontuou ×2.
  const [gained, setGained] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  /** Encerra a partida uma única vez (fim de vidas ou saída manual). */
  const finish = useCallback(
    (finalScore: number) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinish({
        score: finalScore,
        level: Math.min(3, 1 + Math.floor(finalScore / 20)),
        durationSec: Math.round((Date.now() - startRef.current) / 1000),
      });
    },
    [onFinish],
  );

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

  // Cronômetro regressivo da rodada. O updater é puro de propósito: com efeitos
  // dentro dele o StrictMode o invocava duas vezes e o timeout custava 2 vidas.
  useEffect(() => {
    if (feedback) return;
    const id = setInterval(
      () => setTimeLeft((t) => Math.max(0, t - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [feedback, problem]);

  // Tempo esgotado conta como erro (efeito separado do updater acima).
  useEffect(() => {
    if (timeLeft > 0 || feedback) return;
    setFeedback('no');
    setCombo(0);
    setLives((l) => l - 1);
  }, [timeLeft, feedback]);

  // Fim de jogo quando as vidas acabam.
  useEffect(() => {
    if (lives <= 0) finish(score);
  }, [lives, finish, score]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (feedback || guess === '') return;
    const value = Number(guess);
    if (Number.isNaN(value)) return;
    const elapsed = (Date.now() - roundStart) / 1000;
    if (value === problem.answer) {
      const speedBonus = elapsed < 3 ? 2 : 1;
      const points = (1 + combo) * speedBonus;
      setGained(points);
      setScore((s) => s + points);
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
        <button
          onClick={() => finish(score)}
          className="btn btn-ghost shrink-0"
          title="Encerra a partida e registra a pontuação atual"
        >
          Encerrar
        </button>
        <span
          role="timer"
          aria-label={`${timeLeft} segundos restantes`}
          className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 font-display text-lg font-extrabold tabular-nums transition-colors ${
            timeLeft <= 2 ? 'bg-danger/12 text-danger' : 'bg-surface-2 text-fg'
          }`}
        >
          <IconClock width={18} height={18} aria-hidden />
          {timeLeft}s
        </span>
      </div>

      {/* Barra do tempo: fina, colada ao HUD, vira vermelha nos 2s finais. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 linear ${
            timeLeft <= 2 ? 'bg-danger' : 'bg-brand'
          }`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {/* Placar em tiles: pontos, combo e vidas legíveis de relance. */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card px-3 py-2 text-center">
          <p className="font-display text-xl font-extrabold tabular-nums">
            {score}
          </p>
          <p className="eyebrow mt-0.5">pontos</p>
        </div>
        <div className="card px-3 py-2 text-center">
          <p
            className={`inline-flex items-center gap-1 font-display text-xl font-extrabold tabular-nums ${
              combo >= 3 ? 'text-warning' : ''
            }`}
          >
            {combo >= 3 && <IconFlame width={16} height={16} filled aria-hidden />}
            ×{combo}
          </p>
          <p className="eyebrow mt-0.5">combo</p>
        </div>
        <div className="card px-3 py-2 text-center">
          <p className="flex items-center justify-center gap-1">
            <span className="sr-only">{lives} vidas</span>
            {[0, 1, 2].map((i) => (
              <IconHeart
                key={i}
                width={17}
                height={17}
                filled={i < lives}
                aria-hidden
                className={i < lives ? 'text-danger' : 'text-line'}
              />
            ))}
          </p>
          <p className="eyebrow mt-0.5">vidas</p>
        </div>
      </div>

      <div
        className={`card card-raised relative overflow-hidden p-8 text-center transition-colors sm:p-10 ${
          feedback === 'ok'
            ? 'bg-success/10'
            : feedback === 'no'
              ? 'bg-danger/10'
              : ''
        }`}
      >
        {/* Textura de gabarito — decorativa, dá matéria ao fundo do card. */}
        <span
          className="bubble-field pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden
        />
        <div className="relative">
        <p
          role="math"
          aria-label={`${problem.a} ${problem.op} ${problem.b}`}
          className="font-display text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl"
        >
          {problem.a} <span className="text-muted">{problem.op}</span>{' '}
          {problem.b}
        </p>
        <p className="mt-1 font-data text-xs text-muted">= ?</p>

        <form onSubmit={submit} className="mt-5">
          <input
            ref={inputRef}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            inputMode="numeric"
            pattern="[0-9-]*"
            placeholder="Sua resposta"
            aria-label="Sua resposta"
            className="input mx-auto w-40 text-center text-2xl font-bold tabular-nums"
            disabled={!!feedback}
          />
          {!feedback && (
            <button type="submit" className="btn btn-primary mt-3" disabled={guess === ''}>
              Confirmar
            </button>
          )}
        </form>

        {/* Leitores de tela precisam do resultado da rodada. */}
        <div aria-live="assertive" className="mt-3 min-h-5">
          {feedback === 'ok' && (
            <p className="text-sm font-semibold text-success">
              Acertou! +{gained} pts
            </p>
          )}
          {feedback === 'no' && (
            <p className="text-sm font-semibold text-danger">
              Resposta: {problem.answer}
            </p>
          )}
        </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted">
        Acerte em menos de 3s para dobrar os pontos da rodada.
      </p>
    </div>
  );
}

/**
 * Registro de minigames: a chave vem do catálogo do backend (GET /games).
 * Um jogo sem componente aqui aparece como "em breve" em vez de abrir o jogo
 * errado — antes qualquer item do catálogo renderizava o Cálculo Mental e
 * gravava a pontuação na chave 'calculo-mental'.
 */
const GAME_COMPONENTS: Record<
  string,
  (props: GameComponentProps) => React.ReactElement
> = {
  'calculo-mental': CalcMental,
};

/** Card de um minigame no menu. */
function GameCard({
  game,
  playable,
  record,
  onPlay,
}: {
  game: GameCatalogItem;
  playable: boolean;
  record: number | null;
  onPlay: (levelKey: string) => void;
}) {
  const [selected, setSelected] = useState(game.levels[0]?.key ?? '');
  return (
    <li className="card card-raised overflow-hidden">
      <div className="flex items-start gap-3.5 p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand">
          <IconGame width={28} height={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">
            {game.name}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted text-pretty">
            {game.description}
          </p>
          {record !== null && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
              <IconTrophy width={13} height={13} className="text-mat" aria-hidden />
              Melhor marca:{' '}
              <span className="font-data font-semibold text-fg">
                {record} pts
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Rodapé de ação, separado do conteúdo por uma superfície mais funda. */}
      <div className="border-t border-line bg-surface-2/60 p-4">
        <p className="text-xs leading-relaxed text-muted text-pretty">
          {game.scoring}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Dificuldade">
            {game.levels.map((l) => (
              <button
                key={l.key}
                data-active={selected === l.key}
                aria-pressed={selected === l.key}
                onClick={() => setSelected(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onPlay(selected)}
            disabled={!playable}
            title={playable ? undefined : 'Este minigame ainda não está disponível'}
            className="btn btn-primary ml-auto"
          >
            <IconTarget width={16} height={16} />
            {playable ? 'Jogar' : 'Em breve'}
          </button>
        </div>
      </div>
    </li>
  );
}

// Pódio com os gradientes de liga que o design system já define.
const MEDAL = ['league-ouro', 'league-prata', 'league-bronze'];

function Leaderboard({
  title,
  entries,
  unit = 'pontos',
  meId,
}: {
  title: string;
  entries: LeaderboardEntry[];
  unit?: string;
  meId?: string;
}) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold">
        <IconTrophy width={16} height={16} className="text-muted" aria-hidden />
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nenhum resultado ainda. Seja o primeiro a jogar.
        </p>
      ) : (
        <ol className="mt-3 space-y-0.5">
          {entries.map((e, i) => {
            const isMe = meId !== undefined && e.userId === meId;
            return (
            <li
              key={e.userId}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                isMe
                  ? 'bg-brand/10 ring-1 ring-brand/25'
                  : 'hover:bg-surface-2'
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-lg font-data text-xs font-bold tabular-nums ${
                  MEDAL[i] ? MEDAL[i] : 'text-muted'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${
                  i === 0 || isMe ? 'font-semibold' : 'font-medium'
                }`}
              >
                {e.displayName}
                {isMe && (
                  <span className="ml-1.5 text-xs font-medium text-brand">
                    você
                  </span>
                )}
              </span>
              <span className="shrink-0 font-data font-bold tabular-nums text-brand">
                {e.bestScore}{' '}
                <span className="text-xs font-medium text-muted">{unit}</span>
              </span>
            </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function Games() {
  const { me } = useAuth();
  const { refresh } = useGamification();
  const [games, setGames] = useState<GameCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('menu');
  const [activeGame, setActiveGame] = useState<GameCatalogItem | null>(null);
  const [activeLevel, setActiveLevel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);
  const [lastScore, setLastScore] = useState(0);
  const [boards, setBoards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [globalBoard, setGlobalBoard] = useState<LeaderboardEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const catalog = await api.gameCatalog();
      setGames(catalog);
      // Um ranking por jogo do catálogo, em vez de uma chave fixa.
      const [perGame, gb] = await Promise.all([
        Promise.all(
          catalog.map((g) =>
            api
              .gameLeaderboard(g.key, 10)
              .catch((): LeaderboardEntry[] => [])
              .then((entries) => [g.key, entries] as const),
          ),
        ),
        api.globalLeaderboard(10).catch((): LeaderboardEntry[] => []),
      ]);
      setBoards(Object.fromEntries(perGame));
      setGlobalBoard(gb);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFinish = useCallback(
    async (gameKey: string, result: GameResult) => {
      setPhase('over');
      setLastScore(result.score);
      if (result.score <= 0) return;
      setError(null);
      try {
        const res = await api.submitGameScore(
          gameKey,
          result.score,
          result.level,
          result.durationSec,
        );
        if (res.gamification) {
          setAward(res.gamification);
          void refresh();
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      }
    },
    [load, refresh],
  );

  if (phase === 'playing' && activeGame) {
    const ActiveGame = GAME_COMPONENTS[activeGame.key];
    return (
      <div className="space-y-5">
        <ActiveGame
          levelKey={activeLevel}
          onFinish={(result) => void handleFinish(activeGame.key, result)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treino rápido"
        title="Games"
        subtitle="Treine o raciocínio rápido e ganhe XP jogando."
      />

      <ErrorBanner message={error} onRetry={() => void load()} />

      {phase === 'over' && (
        <div className="card card-raised card-glow p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <IconBolt width={20} height={20} filled />
            </span>
            <p className="font-display text-lg font-bold">Partida concluída</p>
          </div>
          <p className="mt-1 text-sm text-muted">
            {lastScore > 0
              ? `Pontuação registrada: ${lastScore} pts.`
              : 'Sem pontos nesta partida. Acerte pelo menos uma conta para pontuar.'}
          </p>
          {award && (
            <div className="mt-2">
              <GamificationFeedback g={award} />
            </div>
          )}
          <button
            onClick={() => {
              setAward(null);
              setActiveGame(null);
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
        <ul className="space-y-4">
          {games.map((g) => (
            <GameCard
              key={g.key}
              game={g}
              playable={g.key in GAME_COMPONENTS}
              record={boards[g.key]?.[0]?.bestScore ?? null}
              onPlay={(levelKey) => {
                setAward(null);
                setActiveGame(g);
                setActiveLevel(levelKey);
                setPhase('playing');
              }}
            />
          ))}
        </ul>
      )}

      <Reveal className="grid gap-3 sm:grid-cols-2">
        {games.map((g) => (
          <Leaderboard
            key={g.key}
            title={`Ranking: ${g.name}`}
            entries={boards[g.key] ?? []}
            meId={me?.id}
          />
        ))}
        <Leaderboard
          title="Ranking geral (XP)"
          entries={globalBoard}
          unit="XP"
          meId={me?.id}
        />
      </Reveal>
    </div>
  );
}
