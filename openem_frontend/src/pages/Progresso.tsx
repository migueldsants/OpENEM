import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  api,
  type AchievementView,
  type GamificationSummary,
  type LeaderboardResult,
  type XpHistory,
} from '../api';
import {
  IconBolt,
  IconFlame,
  IconLock,
  IconSparkle,
  IconTrophy,
} from '../components/icons';
import { EmptyState } from '../components/EmptyState';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { AchievementIcon } from '../lib/achievement-icon';
import { leagueStyle } from '../lib/gamification';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';

type SummaryData = Extract<GamificationSummary, { enabled: true }> & {
  nextLevelXp: number;
};

function withNextLevel(
  s: Extract<GamificationSummary, { enabled: true }>,
): SummaryData {
  const next = s.progress.into + s.progress.forNext;
  return { ...s, nextLevelXp: next };
}

function XpCard({ data }: { data: SummaryData }) {
  const league = leagueStyle(data.league.key);
  const pct = Math.round(data.progress.pct * 100);
  const xpToNext = data.progress.forNext - data.progress.into;
  return (
    <section
      className={`card card-raised overflow-hidden p-5 ring-1 ${league.ring}`}
    >
      <div className="flex items-center gap-4">
        <span
          className={`grid size-14 shrink-0 place-items-center rounded-2xl ${league.soft} ${league.text}`}
        >
          <IconTrophy width={28} height={28} filled />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Liga {data.league.name}</p>
          <p className="font-display text-2xl font-extrabold tracking-tight">
            Nível {data.level}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-extrabold tabular-nums text-brand">
            {data.xp.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-muted">XP total</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Progresso do nível</span>
          <span className="tabular-nums">
            {data.progress.into}/{data.progress.forNext} XP
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Faltam <strong className="text-fg tabular-nums">{xpToNext} XP</strong>{' '}
          para o nível {data.level + 1}
        </p>
      </div>
    </section>
  );
}

function StreakRow({
  current,
  longest,
}: {
  current: number;
  longest: number;
}) {
  const active = current > 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card flex items-center gap-3 p-4">
        <span
          className={`grid size-10 place-items-center rounded-xl ${
            active ? 'bg-warning/12 text-warning' : 'bg-surface-2 text-muted'
          }`}
        >
          <IconFlame width={22} height={22} filled={active} />
        </span>
        <div>
          <p className="font-display text-xl font-extrabold tabular-nums">
            {current}
          </p>
          <p className="text-xs text-muted">dias seguidos</p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4">
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
          <IconBolt width={22} height={22} />
        </span>
        <div>
          <p className="font-display text-xl font-extrabold tabular-nums">
            {longest}
          </p>
          <p className="text-xs text-muted">recorde de dias</p>
        </div>
      </div>
    </div>
  );
}

/** Gráfico de XP ganho por dia (barras SVG). */
function XpHistoryChart({ history }: { history: XpHistory }) {
  if (history.enabled === false) return null;
  const { byDay } = history;
  if (byDay.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">XP por dia</h2>
        <EmptyState
          icon={IconBolt}
          title="Sem XP registrado ainda"
          description="Seu histórico de XP aparece aqui conforme você estuda."
          tip="Responda questões e pratique para acumular XP"
          bare
        />
      </section>
    );
  }
  const max = Math.max(1, ...byDay.map((d) => d.xp));
  const W = Math.max(280, byDay.length * 14);
  const barW = 10;
  const gap = 4;
  const h = 120;
  const pts = byDay.map((d, i) => {
    const bh = Math.max(2, Math.round((d.xp / max) * (h - 24)));
    const x = i * (barW + gap);
    const y = h - bh - 12;
    return { ...d, x, y, bh };
  });
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">XP por dia</h2>
        <span className="text-xs text-muted">últimos {byDay.length} dias</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg
          width={W}
          height={h}
          viewBox={`0 0 ${W} ${h}`}
          role="img"
          aria-label="XP ganho por dia"
          className="w-full"
        >
          {pts.map((p) => (
            <g key={p.day}>
              <rect
                x={p.x}
                y={p.y}
                width={barW}
                height={p.bh}
                rx={2}
                className="fill-brand"
              >
                <title>
                  {p.day}: {p.xp} XP
                </title>
              </rect>
              <text
                x={p.x + barW / 2}
                y={h - 2}
                textAnchor="middle"
                className="fill-muted"
                style={{ fontSize: 9 }}
              >
                {p.day.slice(8)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

/** Barra de progresso da conquista (API: progress 0..1, issue #48). */
function AchievementProgressBar({ item }: { item: AchievementView }) {
  const pct = Math.round(item.progress * 100);
  return (
    <span className="mt-1.5 block">
      <span className="flex items-center justify-between text-xs text-muted">
        <span>{item.unlocked ? 'Desbloqueada' : `${pct}%`}</span>
        <span className="font-semibold text-brand">+{item.xp} XP</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${item.unlocked ? 100 : pct}%` }}
        />
      </span>
    </span>
  );
}

/** Card de conquista — ícone temático + cor própria (issue #48). */
export function AchievementCard({
  a,
  compact = false,
}: {
  a: AchievementView;
  compact?: boolean;
}) {
  const fresh =
    a.unlockedAt &&
    Date.now() - new Date(a.unlockedAt).getTime() < 24 * 60 * 60 * 1000;
  return (
    <li
      title={
        a.unlocked && a.unlockedAt
          ? `Desbloqueada em ${new Date(a.unlockedAt).toLocaleDateString('pt-BR')}`
          : undefined
      }
      className={`flex flex-col rounded-xl border p-3 transition-all ${
        a.unlocked
          ? 'border-brand/30 bg-brand/5'
          : 'border-line opacity-80 grayscale'
      } ${fresh ? 'ring-2 ring-brand/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid ${compact ? 'size-8' : 'size-11'} shrink-0 place-items-center rounded-lg ${
            a.unlocked ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-muted'
          }`}
          aria-hidden
        >
          <AchievementIcon name={a.icon} size={compact ? 17 : 23} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${a.unlocked ? a.color : ''}`}>
            {a.name}
          </p>
          <p className="text-xs text-muted">{a.description}</p>
          {a.unlocked && a.unlockedAt && !compact && (
            <p className="mt-0.5 text-xs text-muted">
              Desbloqueada{' '}
              {new Date(a.unlockedAt).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-bold ${
            a.unlocked ? 'bg-brand/12 text-brand' : 'bg-surface-2 text-muted'
          }`}
        >
          +{a.xp}
        </span>
      </div>
      <AchievementProgressBar item={a} />
    </li>
  );
}

function AchievementsGrid({
  items,
}: {
  items: AchievementView[];
}) {
  // Próxima conquista: a travada com maior progresso (todas, issue #48).
  const next = useMemo(() => {
    const locked = items.filter((a) => !a.unlocked);
    if (locked.length === 0) return null;
    return locked.reduce<AchievementView>(
      (best, item) => (item.progress > best.progress ? item : best),
      locked[0],
    );
  }, [items]);

  return (
    <section className="space-y-3">
      {next && (
        <div className="card card-raised border-l-4 border-brand p-4">
          <p className="eyebrow">Próxima conquista</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-brand" aria-hidden>
              <AchievementIcon name={next.icon} size={20} />
            </span>
            <p className="font-display text-sm font-bold">{next.name}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted">{next.description}</p>
          <AchievementProgressBar item={next} />
        </div>
      )}

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Conquistas</h2>
          <NavLink
            to="/conquistas"
            className="text-xs font-medium text-brand"
          >
            Ver todas →
          </NavLink>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {items.filter((a) => a.unlocked).length}/{items.length} desbloqueadas
        </p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {items.slice(0, 6).map((a) => (
            <AchievementCard key={a.code} a={a} compact />
          ))}
        </ul>
      </section>
    </section>
  );
}

/** Atividades recentes (log de XP). */
function ActivityFeed({ history }: { history: XpHistory }) {
  if (history.enabled === false) return null;
  const { logs } = history;
  if (logs.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Atividades recentes</h2>
        <EmptyState
          icon={IconSparkle}
          title="Nenhuma atividade ainda"
          description="Suas ações recentes aparecem aqui."
          tip="Toda resposta vira XP e aparece aqui"
          bare
        />
      </section>
    );
  }
  const labels: Record<string, string> = {
    ANSWER: 'Questão',
    SIMULATION: 'Simulado',
    ESSAY: 'Redação',
    REVIEW: 'Revisão',
    STUDY_SESSION: 'Sessão',
    DAILY_CHALLENGE: 'Desafio diário',
  };
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-bold">Atividades recentes</h2>
      <ul className="mt-3 space-y-1.5">
        {logs.slice(0, 8).map((log) => (
          <li
            key={log.id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
              <IconBolt width={14} height={14} filled />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {labels[log.action] ?? log.action}
              </span>
              {log.detail && (
                <span className="block truncate text-xs text-muted">
                  {log.detail}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-brand">
              +{log.xpGained} XP
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ranking de XP (global ou por liga) — issue #19. */
function LeaderboardSection() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<'global' | 'league'>('league');
  const [board, setBoard] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .xpLeaderboard(scope, 10)
      .then(setBoard)
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Ranking</h2>
        <div className="seg">
          <button
            data-active={scope === 'league'}
            onClick={() => setScope('league')}
          >
            Minha liga
          </button>
          <button
            data-active={scope === 'global'}
            onClick={() => setScope('global')}
          >
            Geral
          </button>
        </div>
      </div>
      {board?.league && (
        <p className="mt-1 text-xs text-muted">Liga {board.league}</p>
      )}
      {loading ? (
        <div className="mt-3 space-y-1.5" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : !board || board.entries.length === 0 ? (
        <EmptyState
          icon={IconTrophy}
          title="Nenhum jogador ainda"
          description="Jogue para aparecer no ranking!"
          bare
        />
      ) : (
        <ol className="mt-3 space-y-1.5">
          {board.entries.map((e, i) => (
            <li key={e.userId}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                onClick={() => navigate(`/usuarios/${e.userId}`)}
              >
                <span
                  aria-hidden
                  className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums ${
                    i === 0
                      ? 'bg-mat/15 text-mat'
                      : i === 1
                        ? 'bg-surface-2 text-muted'
                        : i === 2
                          ? 'bg-warning/15 text-warning'
                          : 'bg-surface-2 text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.displayName}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  Nível {e.level}
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums text-brand">
                  {e.xp.toLocaleString('pt-BR')}
                </span>
                <span className="sr-only">, ver perfil</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Progresso() {
  const { summary, refresh } = useGamification();
  const [localSummary, setLocalSummary] = useState<GamificationSummary | null>(
    null,
  );
  const [achievements, setAchievements] = useState<AchievementView[]>([]);
  const [history, setHistory] = useState<XpHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [a, h] = await Promise.all([
          api.achievements(),
          api.xpHistory(30),
        ]);
        setAchievements(a);
        setHistory(h);
      } catch (err) {
        // Sem aviso, a falha parecia "nenhuma conquista ainda".
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar suas conquistas.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Mantém o resumo sincronizado com o contexto (que é atualizado após awards).
  useEffect(() => {
    if (summary) setLocalSummary(summary);
  }, [summary]);

  // Recarrega o histórico quando o resumo muda (XP subiu).
  useEffect(() => {
    if (summary && summary.enabled) {
      void api
        .xpHistory(30)
        .then(setHistory)
        .catch(() => {});
    }
  }, [summary]);

  void refresh;

  const data =
    localSummary && localSummary.enabled ? withNextLevel(localSummary) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sua jornada"
        title="Progresso"
        subtitle="Ganhe XP estudando: questões, simulados, redações, revisões e sessões do cronograma contam."
      />

      <ErrorBanner message={error} />

      {loading ? (
        <div className="space-y-5" aria-busy>
          <Skeleton className="h-32" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <SkeletonCard lines={4} />
        </div>
      ) : data ? (
        <>
          <XpCard data={data} />
          <StreakRow current={data.currentStreak} longest={data.longestStreak} />
          <LeaderboardSection />
          {history && <XpHistoryChart history={history} />}
          <AchievementsGrid items={achievements} />
          {history && <ActivityFeed history={history} />}
        </>
      ) : (
        <EmptyState
          icon={IconLock}
          title="Gamificação desativada"
          description={
            <>
              Ative no{' '}
              <NavLink to="/perfil" className="font-medium text-brand">
                perfil
              </NavLink>{' '}
              para ganhar XP e conquistas.
            </>
          }
          tip="XP, ligas e streaks deixam o estudo mais vivo"
        />
      )}
    </div>
  );
}