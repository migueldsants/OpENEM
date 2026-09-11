import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type DailyChallenge,
  type ForumThreadSummary,
  type GamificationSummary,
  type Performance,
  type Recommendation,
  type ReviewItem,
} from '../api';
import { useAuth } from '../auth';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  IconCalendar,
  IconChat,
  IconClock,
  IconFlame,
  IconSparkle,
  IconTarget,
  IconTrophy,
} from '../components/icons';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { WeeklyGoalsCard } from '../components/WeeklyGoalsCard';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';
import { areaSourceName, subjectLabel, topicLabel } from '../lib/question';
import { leagueStyle } from '../lib/gamification';

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "em 2 dias", "amanhã", "em 3 horas" — relativo a agora. */
function relativeDate(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const day = 86_400_000;
  if (Math.abs(diffMs) < day) {
    const hours = Math.round(diffMs / 3_600_000);
    return rtf.format(hours, 'hour');
  }
  return rtf.format(Math.round(diffMs / day), 'day');
}

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

/**
 * Painel: as métricas de estudo num lugar só — nível e liga, desafio do dia,
 * metas da semana, acerto, revisão, desempenho por área, pontos a reforçar,
 * recomendações e o fórum. Antes tudo isso ficava na Home, que agora é só um
 * hub de navegação.
 */
export default function Painel() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [perf, setPerf] = useState<Performance | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [game, setGame] = useState<GamificationSummary | null>(null);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [nextReview, setNextReview] = useState<ReviewItem | null>(null);
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [claiming, setClaiming] = useState(false);
  // Erro de carregamento (issue #49): distingue falha de API de "sem dados" —
  // sem isso, erro deixava skeleton infinito indistinguível de loading.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoadError(null);
    const fail = () =>
      setLoadError(
        'Não foi possível carregar seu painel. Verifique sua conexão.',
      );
    void api.performance().then(setPerf).catch(fail);
    void api.reviewQueue().then(setReview).catch(fail);
    void api.gamification().then(setGame).catch(fail);
    void api.dailyChallenge().then(setDaily).catch(fail);
    void api.recommendations(3).then(setRecs).catch(fail);
    void api.reviewNext().then(setNextReview).catch(fail);
    void api.forumThreads().then(setThreads).catch(fail);
  }, [reloadKey]);

  async function claimDaily() {
    setClaiming(true);
    try {
      await api.claimDailyChallenge();
      setDaily(await api.dailyChallenge());
      setGame(await api.gamification());
    } catch {
      /* silencioso: o card continua mostrando o estado anterior */
    } finally {
      setClaiming(false);
    }
  }

  const answered = perf?.overall.total ?? 0;
  const hasData = answered > 0;
  const loadingPerf = perf === null;
  const hotThread =
    threads.length > 0
      ? [...threads].sort(
          (a, b) =>
            b.replies - a.replies ||
            +new Date(b.createdAt) - +new Date(a.createdAt),
        )[0]
      : null;

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Painel</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {name ? `Seu progresso, ${name}` : 'Seu progresso'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          {hasData
            ? 'Veja onde você está forte e onde vale reforçar.'
            : 'Responda algumas questões para começar a ver seu desempenho aqui.'}
        </p>
      </header>

      <ErrorBanner
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />

      {game?.enabled && <ProgressWidget data={game} />}

      {daily === null ? (
        <Skeleton className="h-20" />
      ) : (
        daily?.enabled && (
          <DailyChallengeCard
            data={daily}
            onClaim={() => void claimDaily()}
            claiming={claiming}
          />
        )
      )}

      <WeeklyGoalsCard />

      <div className="grid grid-cols-3 gap-3">
        {loadingPerf ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : (
          <>
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
          </>
        )}
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

      {/* Próxima revisão agendada — só quando a fila de vencidos está vazia. */}
      {review.length === 0 && nextReview && (
        <NavLink
          to="/revisao"
          className="card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <IconCalendar width={22} height={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">
              Próxima revisão
            </span>
            <span className="text-xs text-muted">
              {nextReview.topic.name} · {relativeDate(nextReview.dueAt)}
            </span>
          </span>
          <span className="chip shrink-0 bg-surface-2 text-muted">
            {nextReview.topic.subject.name}
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

        {loadingPerf ? (
          <ul className="mt-4 space-y-3" aria-label="Carregando desempenho">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <SkeletonText width="35%" />
                  <SkeletonText width="15%" />
                </div>
                <Skeleton className="h-2" />
              </li>
            ))}
          </ul>
        ) : hasData && perf!.bySubject.length > 0 ? (
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
          <EmptyState
            icon={IconTrophy}
            title="Sem dados ainda"
            description={
              <>
                Responda sua primeira questão em{' '}
                <NavLink to="/questoes" className="font-medium text-brand">
                  Questões
                </NavLink>{' '}
                para ver suas estatísticas.
              </>
            }
            tip="Cada resposta alimenta seu desempenho por área"
            bare
          />
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
              const area = areaKey(areaSourceName(r.question));
              return (
                <li key={r.question.id}>
                  <NavLink
                    to="/questoes"
                    className="block rounded-lg border border-line p-3 transition-colors hover:bg-surface-2"
                  >
                    <p className="flex items-center gap-2 text-xs">
                      <span className={`size-2 rounded-full ${AREA_DOT[area]}`} />
                      <span className={`font-semibold ${AREA_TEXT[area]}`}>
                        {topicLabel(r.question) ?? subjectLabel(r.question)}
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

      {/* Fórum em alta — tópico com mais respostas (proxy de "quente"). */}
      {hotThread && (
        <NavLink
          to="/comunidade"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lin/12 text-lin">
            <IconChat width={22} height={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold">Fórum em alta</span>
            <span className="block truncate text-xs text-muted">
              {hotThread.title}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-data font-bold tabular-nums">
              {hotThread.replies}
            </span>
            <span className="text-[10px] text-muted">
              {hotThread.replies === 1 ? 'resposta' : 'respostas'}
            </span>
          </span>
        </NavLink>
      )}
    </div>
  );
}
