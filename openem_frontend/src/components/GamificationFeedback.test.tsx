import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GamificationFeedback } from './GamificationFeedback';
import type { GamificationDelta } from '../api';

const base: GamificationDelta = {
  xpGained: 25,
  breakdown: { base: 10, comboMultiplier: 1.6, dailyBonus: 9 },
  xp: 250,
  level: 3,
  leveledUp: true,
  league: { key: 'PRATA', name: 'Prata' },
  leagueChanged: true,
  currentStreak: 7,
  streakIncremented: true,
  newAchievements: [
    { code: 'STREAK_7', name: 'Semana cheia', description: 'Estude 7 dias.' },
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
    expect(screen.getByText('Semana cheia')).toBeInTheDocument();
  });

  it('omite combo e bônus quando valem zero/1x', () => {
    render(
      <GamificationFeedback
        g={{
          ...base,
          breakdown: { base: 10, comboMultiplier: 1, dailyBonus: 0 },
          leveledUp: false,
          leagueChanged: false,
          newAchievements: [],
        }}
      />,
    );
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.queryByText(/combo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bônus diário/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subiu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nova liga/)).not.toBeInTheDocument();
  });
});