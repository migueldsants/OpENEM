import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type AchievementView, type GamificationSummary } from '../api';
import {
  IconBolt,
  IconCheck,
  IconFlame,
  IconLock,
  IconTrophy,
} from '../components/icons';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { leagueStyle } from '../lib/gamification';

function XpCard({
  data,
}: {
  data: Extract<GamificationSummary, { enabled: true }>;
}) {
  const league = leagueStyle(data.league.key);
  const pct = Math.round(data.progress.pct * 100);
  return (
    <section className={`card card-raised overflow-hidden p-5 ring-1 ${league.ring}`}>
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

function AchievementsGrid({ items }: { items: AchievementView[] }) {
  return (
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
            className={`flex items-start gap-3 rounded-xl border p-3 ${
              a.unlocked
                ? 'border-brand/30 bg-brand/5'
                : 'border-line opacity-70'
            }`}
          >
            <span
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                a.unlocked
                  ? 'bg-brand/15 text-brand'
                  : 'bg-surface-2 text-muted'
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
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Progresso() {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [achievements, setAchievements] = useState<AchievementView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [s, a] = await Promise.all([
          api.gamification(),
          api.achievements(),
        ]);
        setSummary(s);
        setAchievements(a);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Sua jornada</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Progresso
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ganhe XP respondendo questões, mantenha a sequência e suba de liga.
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
      ) : summary && summary.enabled ? (
        <>
          <XpCard data={summary} />
          <StreakRow
            current={summary.currentStreak}
            longest={summary.longestStreak}
          />
          <AchievementsGrid items={achievements} />
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
