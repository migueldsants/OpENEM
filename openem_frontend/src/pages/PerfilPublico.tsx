import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type PublicProfile } from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconBolt, IconCheck, IconFlame, IconLock, IconTrophy } from '../components/icons';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { leagueStyle } from '../lib/gamification';
import { PageHeader } from '../components/PageHeader';

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'hoje';
  if (d < 30) return `há ${d} dia${d === 1 ? '' : 's'}`;
  const m = Math.floor(d / 30);
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(d / 365);
  return `há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}

export default function PerfilPublico() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setProfile(await api.publicProfile(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Perfil não encontrado.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy>
        <Skeleton className="h-28" />
        <SkeletonCard lines={3} />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error ?? 'Perfil não encontrado.'} />
      </div>
    );
  }

  const header = (
    <PageHeader
      eyebrow="Perfil público"
      title={profile.nickname}
      subtitle={<>Estudante desde {new Date(profile.createdAt).toLocaleDateString('pt-BR')}{' '} ({timeSince(profile.createdAt)}) · Objetivo: {profile.goal}</>}
    />
  );

  if (!profile.gamificationEnabled) {
    return (
      <div className="space-y-6">
        {header}
        <section className="card flex items-center gap-3 p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
            <IconLock width={18} height={18} />
          </span>
          <p className="text-sm text-muted">
            Este estudante desligou pontos, sequência e conquistas.
          </p>
        </section>
      </div>
    );
  }

  const league = leagueStyle(profile.league.key);

  return (
    <div className="space-y-6">
      {header}

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
            <p className="eyebrow">Liga {profile.league.name}</p>
            <p className="font-display text-2xl font-extrabold tracking-tight">
              Nível {profile.level}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold tabular-nums text-brand">
              {profile.xp.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted">XP total</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <span
              className={`grid size-9 place-items-center rounded-lg ${
                profile.currentStreak > 0 ? 'bg-warning/12 text-warning' : 'bg-surface-2 text-muted'
              }`}
            >
              <IconFlame width={20} height={20} filled={profile.currentStreak > 0} />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold tabular-nums">
                {profile.currentStreak}
              </p>
              <p className="text-xs text-muted">dias seguidos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand/12 text-brand">
              <IconBolt width={20} height={20} filled />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold tabular-nums">
                {profile.achievementsUnlocked}/{profile.achievementsTotal}
              </p>
              <p className="text-xs text-muted">conquistas</p>
            </div>
          </div>
        </div>
      </section>

      {profile.featuredAchievements.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Conquistas em destaque</h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {profile.featuredAchievements.map((a) => (
              <li
                key={a.code}
                className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
                  <IconCheck width={16} height={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}