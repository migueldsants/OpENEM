import type { GamificationDelta } from '../api';
import { AchievementToasts } from './AchievementToast';
import {
  IconBolt,
  IconFlame,
  IconTrophy,
} from './icons';

/**
 * Badges de feedback de gamificação (XP, combo, bônus diário, level up, liga,
 * conquistas). Compartilhado entre Questões, Favoritos, Revisão, Simulados,
 * Redação e Cronograma (issue #17).
 * Conquistas novas também disparam toasts empilháveis (issue #48).
 */
export function GamificationFeedback({ g }: { g: GamificationDelta }) {
  return (
    <>
      <AchievementToasts list={g.newAchievements} />
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 animate-rise">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
          <IconBolt width={13} height={13} filled />+{g.xpGained} XP
        </span>
        {g.breakdown.comboMultiplier > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red/12 px-2.5 py-1 text-xs font-semibold text-red">
            <IconFlame width={13} height={13} filled />
            combo ×{g.breakdown.comboMultiplier}
          </span>
        )}
        {g.breakdown.dailyBonus > 0 && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
            +{g.breakdown.dailyBonus} bônus diário
          </span>
        )}
        {g.breakdown.achievementXp > 0 && (
          <span className="rounded-full bg-hum/15 px-2.5 py-1 text-xs font-semibold text-hum">
            +{g.breakdown.achievementXp} de conquistas
          </span>
        )}
        {g.leveledUp && (
          <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
            Subiu para o nível {g.level}!
          </span>
        )}
        {g.leagueChanged && (
          <span className="rounded-full bg-mat/15 px-2.5 py-1 text-xs font-bold text-mat">
            Nova liga: {g.league.name}!
          </span>
        )}
        {g.newAchievements.map((a) => (
          <span
            key={a.code}
            title={a.description}
            className="inline-flex items-center gap-1 rounded-full bg-hum/15 px-2.5 py-1 text-xs font-semibold text-hum"
          >
            <IconTrophy width={13} height={13} filled />
            {a.name}
          </span>
        ))}
      </div>
    </>
  );
}