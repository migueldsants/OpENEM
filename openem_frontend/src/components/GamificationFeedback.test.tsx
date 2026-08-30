import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamificationFeedback } from './GamificationFeedback';
import type { GamificationDelta } from '../api';

const base: GamificationDelta = {
  xpGained: 25,
  breakdown: { base: 10, comboMultiplier: 1.6, dailyBonus: 9, achievementXp: 0 },
  xp: 250,
  level: 3,
  leveledUp: true,
  league: { key: 'PRATA', name: 'Prata' },
  leagueChanged: true,
  currentStreak: 7,
  streakIncremented: true,
  newAchievements: [
    {
      code: 'STREAK_7',
      name: 'Semana cheia',
      description: 'Estude 7 dias.',
      xp: 200,
      icon: '🌋',
      color: 'text-red',
    },
  ],
};

describe('GamificationFeedback', () => {
  it('mostra XP, combo, bônus, level up, liga e conquistas', () => {
    render(<GamificationFeedback g={base} />);
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.getByText(/combo ×1.6/)).toBeInTheDocument();
    expect(screen.getByText(/\+9 bônus diário/)).toBeInTheDocument();
    expect(screen.getByText(/Subiu para o nível 3/)).toBeInTheDocument();
    expect(screen.getByText(/Nova liga: Prata/)).toBeInTheDocument();
    // Badge inline e toast (issue #48) — ambos mostram a conquista.
    expect(screen.getAllByText('Semana cheia').length).toBeGreaterThanOrEqual(2);
  });

  it('mostra o XP extra de conquistas quando há (issue #48)', () => {
    render(
      <GamificationFeedback
        g={{
          ...base,
          xpGained: 125,
          breakdown: {
            ...base.breakdown,
            achievementXp: 100,
          },
        }}
      />,
    );
    expect(screen.getByText('+125 XP')).toBeInTheDocument();
    expect(screen.getByText('+100 de conquistas')).toBeInTheDocument();
  });

  it('omite combo e bônus quando valem zero/1x', () => {
    render(
      <GamificationFeedback
        g={{
          ...base,
          breakdown: {
            base: 10,
            comboMultiplier: 1,
            dailyBonus: 0,
            achievementXp: 0,
          },
          leveledUp: false,
          leagueChanged: false,
          newAchievements: [],
        }}
      />,
    );
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.queryByText(/combo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bônus diário/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subiu para/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nova liga/)).not.toBeInTheDocument();
    expect(screen.queryByText(/de conquistas/)).not.toBeInTheDocument();
  });
});