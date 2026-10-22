import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type AchievementView } from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconLock, IconTrophy } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { AchievementCard } from './Progresso';
import { PageHeader } from '../components/PageHeader';

/** Conquistas agrupadas por categoria (issue #48). */
const CATEGORIES: { key: string; label: string; codes: string[] }[] = [
  {
    key: 'answers',
    label: 'Questões',
    codes: [
      'FIRST_ANSWER',
      'TEN_ANSWERS',
      'HUNDRED_ANSWERS',
      'TEN_CORRECT',
    ],
  },
  {
    key: 'streak',
    label: 'Sequência',
    codes: ['STREAK_3', 'STREAK_7', 'STREAK_30'],
  },
  {
    key: 'xp',
    label: 'XP e níveis',
    codes: [
      'POINTS_500',
      'POINTS_2000',
      'REACH_LEVEL_5',
      'REACH_LEVEL_10',
      'REACH_LEVEL_20',
    ],
  },
  {
    key: 'simulations',
    label: 'Simulados',
    codes: ['FIRST_SIMULATION', 'FIVE_SIMULATIONS'],
  },
  {
    key: 'essays',
    label: 'Redação',
    codes: ['FIRST_ESSAY', 'HIGH_SCORE_ESSAY'],
  },
  {
    key: 'reviews',
    label: 'Revisão',
    codes: ['FIRST_REVIEW', 'TEN_REVIEWS'],
  },
  {
    key: 'sessions',
    label: 'Sessões de estudo',
    codes: ['FIRST_SESSION', 'TEN_SESSIONS'],
  },
];

/**
 * Tela dedicada de Conquistas (issue #48): total desbloqueado com progresso
 * geral, seções por categoria, cards ricos (emoji, data, +XP) e destaque de
 * brilho nas desbloqueadas nas últimas 24h (no AchievementCard).
 */
export default function Conquistas() {
  const [items, setItems] = useState<AchievementView[] | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.achievements();
        if (Array.isArray(res)) setItems(res);
        else setDisabled(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar suas conquistas.',
        );
      }
    })();
  }, []);

  const unlocked = items?.filter((a) => a.unlocked).length ?? 0;
  const total = items?.length ?? 0;
  const overallPct = total ? Math.round((unlocked / total) * 100) : 0;
  const totalXp = items
    ?.filter((a) => a.unlocked)
    .reduce((sum, a) => sum + a.xp, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seu troféu"
        title="Conquistas"
        subtitle="Cada marco vale XP bônus. Quanto mais difícil, maior a recompensa."
      />

      <ErrorBanner message={error} />

      {disabled ? (
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
        />
      ) : items === null && !error ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={1} />
          <SkeletonCard lines={6} />
        </div>
      ) : items ? (
        <>
          {/* Cabeçalho com total e progresso geral */}
          <section className="card card-raised p-5">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand">
                <IconTrophy width={28} height={28} filled />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-extrabold tabular-nums">
                  {unlocked}
                  <span className="text-base font-semibold text-muted">
                    /{total}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  desbloqueadas · {totalXp} XP acumulado de conquistas
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand/12 px-2.5 py-1 text-xs font-bold text-brand">
                {overallPct}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width]"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </section>

          {unlocked === 0 && (
            <EmptyState
              icon={IconTrophy}
              title="Nenhuma conquista ainda"
              description={
                <>
                  Responda sua primeira questão em{' '}
                  <b>Questões</b> para desbloquear a primeira!
                </>
              }
              tip="Toda atividade conta: respostas, revisões, simulados…"
            />
          )}

          {/* Seções por categoria */}
          {CATEGORIES.map((cat) => {
            const catItems = cat.codes
              .map((code) => items.find((a) => a.code === code))
              .filter((a): a is AchievementView => !!a);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.key} className="card p-5">
                <h2 className="font-display text-lg font-bold">{cat.label}</h2>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                  {catItems.map((a) => (
                    <AchievementCard key={a.code} a={a} />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}