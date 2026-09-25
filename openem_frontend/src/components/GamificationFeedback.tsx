import type { GamificationDelta } from '../api';
import { AchievementToasts } from './AchievementToast';
import { IconBolt, IconFlame, IconTrophy } from './icons';

/** De onde veio o XP, para o tooltip e o leitor de tela. */
function detalheXp(g: GamificationDelta): string {
  const partes = [`${g.breakdown.base} da resposta`];
  if (g.breakdown.dailyBonus > 0) {
    partes.push(`${g.breakdown.dailyBonus} de bônus diário`);
  }
  if (g.breakdown.achievementXp > 0) {
    partes.push(`${g.breakdown.achievementXp} de conquistas`);
  }
  return partes.join(', ');
}

/** O único destaque da resposta: nível e liga numa frase só. */
function destaque(g: GamificationDelta): string | null {
  if (g.leveledUp && g.leagueChanged) {
    return `Nível ${g.level} e liga ${g.league.name}!`;
  }
  if (g.leveledUp) return `Subiu para o nível ${g.level}!`;
  if (g.leagueChanged) return `Nova liga: ${g.league.name}!`;
  return null;
}

/**
 * Feedback de gamificação depois de uma ação (issue #17): uma linha com o XP
 * (e o combo, se houver) e no máximo um destaque. As conquistas saem só no
 * toast (issue #48); repetir em badge aqui triplicava a mesma informação.
 * Compartilhado entre Questões, Favoritos, Revisão, Simulados, Redação,
 * Cronograma e Pomodoro.
 */
export function GamificationFeedback({ g }: { g: GamificationDelta }) {
  const brilho = destaque(g);
  const detalhe = detalheXp(g);
  return (
    <>
      <AchievementToasts list={g.newAchievements} />
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 animate-rise">
        <span
          title={detalhe}
          className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand"
        >
          <IconBolt width={13} height={13} filled />+{g.xpGained} XP
          <span className="sr-only"> ({detalhe})</span>
        </span>
        {g.breakdown.comboMultiplier > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-2.5 py-1 text-xs font-semibold text-warning">
            <IconFlame width={13} height={13} filled />
            combo ×{g.breakdown.comboMultiplier}
          </span>
        )}
        {brilho && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">
            <IconTrophy width={13} height={13} filled />
            {brilho}
          </span>
        )}
      </div>
    </>
  );
}
