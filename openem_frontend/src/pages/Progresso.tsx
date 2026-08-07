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
  IconCheck,
  IconFlame,
  IconLock,
  IconTrophy,
} from '../components/icons';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { leagueStyle } from '../lib/gamification';

/**
 * Mapeia um código de conquista para o progresso atual (atual/total) quando
 * possível. Conquistas puramente binárias (ex.: FIRST_ANSWER) não têm barra —
 * só travado/desbloqueado.
 */
const ACHIEVEMENT_THRESHOLDS: Record<
  string,
  { current: (s: SummaryData) => number; total: number }
> = {
  TEN_ANSWERS: { total: 10, current: (s) => s.answersCount },
  HUNDRED_ANSWERS: { total: 100, current: (s) => s.answersCount },
  TEN_CORRECT: { total: 10, current: (s) => s.correctCount },
  STREAK_3: { total: 3, current: (s) => s.currentStreak },
  STREAK_7: { total: 7, current: (s) => s.currentStreak },
  STREAK_30: { total: 30, current: (s) => s.currentStreak },
  POINTS_500: { total: 500, current: (s) => s.xp },
  POINTS_2000: { total: 2000, current: (s) => s.xp },
  FIVE_SIMULATIONS: { total: 5, current: (s) => s.simulationsCount },
  TEN_REVIEWS: { total: 10, current: (s) => s.reviewsCount },
  TEN_SESSIONS: { total: 10, current: (s) => s.sessionsDone },
};

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
            active ? 'bg-red/12 text-red' : 'bg-surface-2 text-muted'
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
        <p className="mt-2 text-sm text-muted">
          Seu histórico de XP aparece aqui conforme você estuda.
        </p>
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

function AchievementProgress({
  item,
  data,
}: {
  item: AchievementView;
  data: SummaryData;
}) {
  const rule = ACHIEVEMENT_THRESHOLDS[item.code];
  if (!rule) return null;
  const current = Math.min(rule.current(data), rule.total);
  const pct = Math.round((current / rule.total) * 100);
  return (
    <span className="mt-1.5 block">
      <span className="flex items-center justify-between text-[0.68rem] text-muted">
        <span>
          {current}/{rule.total}
        </span>
        {!item.unlocked && <span>{pct}%</span>}
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

function AchievementsGrid({
  items,
  data,
}: {
  items: AchievementView[];
  data: SummaryData;
}) {
  // Próxima conquista: a travada com maior progresso percentual.
  const next = useMemo(() => {
    const locked = items.filter((a) => !a.unlocked);
    if (locked.length === 0) return null;
    let best: { item: AchievementView; pct: number } | null = null;
    for (const item of locked) {
      const rule = ACHIEVEMENT_THRESHOLDS[item.code];
      if (!rule) continue;
      const pct = rule.current(data) / rule.total;
      if (!best || pct > best.pct) best = { item, pct };
    }
    return best;
  }, [items, data]);

  return (
    <section className="space-y-3">
      {next && (
        <div className="card card-raised border-l-4 border-brand p-4">
          <p className="eyebrow">Próxima conquista</p>
          <div className="mt-1 flex items-center gap-2">
            <IconTrophy width={18} height={18} className="text-brand" />
            <p className="font-display text-sm font-bold">{next.item.name}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted">{next.item.description}</p>
          <AchievementProgress item={next.item} data={data} />
        </div>
      )}

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Conquistas</h2>
          <span className="text-xs text-muted">
            {items.filter((a) => a.unlocked).length}/{items.length}
          </span>
        </div>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {items.map((a) => (
            <li
              key={a.code}
              className={`flex flex-col rounded-xl border p-3 ${
                a.unlocked
                  ? 'border-brand/30 bg-brand/5'
                  : 'border-line opacity-80'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                    a.unlocked ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-muted'
                  }`}
                >
                  {a.unlocked ? (
                    <IconCheck width={16} height={16} />
                  ) : (
                    <IconLock width={15} height={15} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
              </div>
              <AchievementProgress item={a} data={data} />
            </li>
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
  if (logs.length === 0) return null;
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
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand/12 text-brand">
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
        <p className="mt-3 text-sm text-muted">
          Nenhum jogador ainda. Jogue para aparecer no ranking!
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {board.entries.map((e, i) => (
            <li
              key={e.userId}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
              onClick={() => navigate(`/usuarios/${e.userId}`)}
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
              <span className="shrink-0 text-xs text-muted">
                Nv {e.level}
              </span>
              <span className="shrink-0 font-display font-bold tabular-nums text-brand">
                {e.xp.toLocaleString('pt-BR')}
              </span>
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

  useEffect(() => {
    void (async () => {
      try {
        const [a, h] = await Promise.all([
          api.achievements(),
          api.xpHistory(30),
        ]);
        setAchievements(a);
        setHistory(h);
      } catch {
        /* silencioso */
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
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Sua jornada</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Progresso
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ganhe XP estudando — questões, simulados, redações, revisões e
          sessões do cronograma contam.
        </p>
      </header>

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
          <AchievementsGrid items={achievements} data={data} />
          {history && <ActivityFeed history={history} />}
        </>
      ) : (
        <div className="card p-6 text-center text-sm text-muted">
          A gamificação está desativada.{' '}
          <NavLink to="/perfil" className="font-medium text-brand">
            Ativar no perfil
          </NavLink>{' '}
          para ganhar XP e conquistas.
        </div>
      )}
    </div>
  );
}