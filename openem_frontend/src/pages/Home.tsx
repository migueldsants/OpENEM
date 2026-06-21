import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type DailyChallenge,
  type GamificationSummary,
  type Performance,
  type Recommendation,
  type ReviewItem,
} from '../api';
import { useAuth } from '../auth';
import {
  IconChat,
  IconClock,
  IconFlame,
  IconPen,
  IconSparkle,
  IconStack,
  IconStar,
  IconTarget,
  IconTrophy,
} from '../components/icons';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';
import { leagueStyle } from '../lib/gamification';

function ProgressWidget({
  data,
}: {
  data: Extract<GamificationSummary, { enabled: true }>;
}) {
  const league = leagueStyle(data.league.key);
  const pct = Math.round(data.progress.pct * 100);
  return (
    <NavLink
      to="/progresso"
      className={`card card-raised block p-4 ring-1 transition-transform hover:-translate-y-0.5 ${league.ring}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${league.soft} ${league.text}`}
        >
          <IconTrophy width={22} height={22} filled />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">
            Nível {data.level}{' '}
            <span className="text-xs font-medium text-muted">
              · Liga {data.league.name}
            </span>
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {data.currentStreak > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-red">
            <IconFlame width={18} height={18} filled />
            {data.currentStreak}
          </span>
        )}
      </div>
    </NavLink>
  );
}

/** Card do desafio diário com barra de progresso e resgate de XP. */
function DailyChallengeCard({
  data,
  onClaim,
  claiming,
}: {
  data: Extract<DailyChallenge, { enabled: true }>;
  onClaim: () => void;
  claiming: boolean;
}) {
  const pct = Math.round((data.progress / data.goal) * 100);
  return (
    <div className="card card-raised p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <IconTarget width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">
            Desafio diário{' '}
            <span className="text-xs font-medium text-muted">
              · +{data.xpReward} XP
            </span>
          </p>
          <p className="text-xs text-muted">
            Responda {data.goal} questões hoje ({data.progress}/{data.goal})
          </p>
        </div>
        {data.completed && !data.claimed && (
          <button
            onClick={onClaim}
            disabled={claiming}
            className="btn btn-primary shrink-0"
          >
            {claiming ? '…' : 'Resgatar'}
          </button>
        )}
        {data.claimed && (
          <span className="shrink-0 text-sm font-semibold text-nat">
            Concluído ✓
          </span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width]"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent = 'text-fg',
}: {
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <p className={`font-display text-2xl font-extrabold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

export default function Home() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [perf, setPerf] = useState<Performance | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [game, setGame] = useState<GamificationSummary | null>(null);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    void api.performance().then(setPerf).catch(() => setPerf(null));
    void api.reviewQueue().then(setReview).catch(() => setReview([]));
    void api.gamification().then(setGame).catch(() => setGame(null));
    void api.dailyChallenge().then(setDaily).catch(() => setDaily(null));
    void api.recommendations(3).then(setRecs).catch(() => setRecs([]));
  }, []);

  async function claimDaily() {
    setClaiming(true);
    try {
      await api.claimDailyChallenge();
      setDaily(await api.dailyChallenge());
      setGame(await api.gamification());
    } catch {
      /* silencioso */
    } finally {
      setClaiming(false);
    }
  }

  const answered = perf?.overall.total ?? 0;
  const hasData = answered > 0;

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Seu painel</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {name ? `Bora estudar, ${name}?` : 'Bora estudar?'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          {hasData
            ? 'Veja onde você está forte e onde vale reforçar.'
            : 'Responda algumas questões para começar a ver seu desempenho aqui.'}
        </p>
      </header>

      {game?.enabled && <ProgressWidget data={game} />}

      {daily?.enabled && (
        <DailyChallengeCard
          data={daily}
          onClaim={() => void claimDaily()}
          claiming={claiming}
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat
          value={hasData ? `${perf!.overall.accuracy}%` : '—'}
          label="de acerto"
          accent="text-brand"
        />
        <Stat value={String(answered)} label="respondidas" />
        <Stat
          value={String(review.length)}
          label="para revisar"
          accent={review.length ? 'text-hum' : 'text-fg'}
        />
      </div>

      {/* Revisão devida — chamada direta quando há assuntos vencidos. */}
      {review.length > 0 && (
        <NavLink
          to="/revisao"
          className="card card-raised flex items-center gap-3 p-4 ring-1 ring-hum/30 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-hum/12 text-hum">
            <IconClock width={22} height={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">
              Revisar agora
            </span>
            <span className="text-xs text-muted">
              {review.length}{' '}
              {review.length === 1 ? 'assunto vencido' : 'assuntos vencidos'} na
              sua fila
            </span>
          </span>
        </NavLink>
      )}

      {/* Desempenho por área — o coração do painel. */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Desempenho por área</h2>
          <NavLink to="/desempenho" className="text-xs font-medium text-brand">
            Ver completo
          </NavLink>
        </div>

        {hasData && perf!.bySubject.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {perf!.bySubject.map((s) => {
              const area = areaKey(s.name);
              return (
                <li key={s.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${AREA_DOT[area]}`} />
                      {s.name.replace(' e suas Tecnologias', '')}
                    </span>
                    <span className="tabular-nums text-muted">
                      {s.correct}/{s.total} · {s.accuracy}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${AREA_DOT[area]}`}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
            Sem dados ainda.{' '}
            <NavLink to="/questoes" className="font-medium text-brand">
              Responda sua primeira questão
            </NavLink>{' '}
            para ver suas estatísticas.
          </div>
        )}
      </section>

      {/* Pontos a reforçar — só quando há sinal. */}
      {hasData && perf!.weakestTopics.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">A reforçar</h2>
          <p className="mt-0.5 text-xs text-muted">
            Assuntos com menor acerto até agora.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {perf!.weakestTopics.slice(0, 5).map((t) => (
              <li key={t.id} className="chip">
                {t.name}
                <span className="tabular-nums text-muted">{t.accuracy}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recomendado para você — questões dos assuntos com mais erros. */}
      {recs.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <IconSparkle width={18} height={18} className="text-brand" />
            <h2 className="font-display text-lg font-bold">
              Recomendado para você
            </h2>
          </div>
          <ul className="mt-3 space-y-2.5">
            {recs.map((r) => {
              const area = areaKey(r.question.topic.subject.name);
              return (
                <li key={r.question.id}>
                  <NavLink
                    to="/questoes"
                    className="block rounded-lg border border-line p-3 transition-colors hover:bg-surface-2"
                  >
                    <p className="flex items-center gap-2 text-xs">
                      <span className={`size-2 rounded-full ${AREA_DOT[area]}`} />
                      <span className={`font-semibold ${AREA_TEXT[area]}`}>
                        {r.question.topic.name}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm">
                      {r.question.statement}
                    </p>
                    <p className="mt-1 text-xs text-muted">{r.reason}</p>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <NavLink
          to="/questoes"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-mat/12 text-mat">
            <IconStack width={22} height={22} />
          </span>
          <span>
            <span className="block font-display font-bold">Responder questões</span>
            <span className="text-xs text-muted">Com gabarito comentado</span>
          </span>
        </NavLink>
        <NavLink
          to="/redacao"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-red/12 text-red">
            <IconPen width={22} height={22} />
          </span>
          <span>
            <span className="block font-display font-bold">Treinar redação</span>
            <span className="text-xs text-muted">Nota por competência</span>
          </span>
        </NavLink>
        <NavLink
          to="/favoritos"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-hum/12 text-hum">
            <IconStar width={22} height={22} filled />
          </span>
          <span>
            <span className="block font-display font-bold">Favoritas</span>
            <span className="text-xs text-muted">Questões salvas</span>
          </span>
        </NavLink>
        <NavLink
          to="/comunidade"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-lin/12 text-lin">
            <IconChat width={22} height={22} />
          </span>
          <span>
            <span className="block font-display font-bold">Comunidade</span>
            <span className="text-xs text-muted">Fórum de dúvidas</span>
          </span>
        </NavLink>
      </div>
    </div>
  );
}
