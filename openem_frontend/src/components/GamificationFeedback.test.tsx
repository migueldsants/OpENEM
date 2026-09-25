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
      icon: 'flame',
      color: 'text-red',
    },
  ],
};

describe('GamificationFeedback', () => {
  it('uma linha: XP, combo e um único destaque juntando nível e liga', () => {
    render(<GamificationFeedback g={base} />);
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.getByText(/combo ×1.6/)).toBeInTheDocument();
    expect(screen.getByText('Nível 3 e liga Prata!')).toBeInTheDocument();
    expect(screen.queryByText(/Subiu para/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nova liga/)).not.toBeInTheDocument();
  });

  it('a conquista aparece uma vez só (no toast), não repetida em badge', () => {
    render(<GamificationFeedback g={base} />);
    expect(screen.getAllByText('Semana cheia')).toHaveLength(1);
    expect(screen.getByText('Conquista desbloqueada')).toBeInTheDocument();
  });

  it('o detalhe do XP (bônus diário, conquistas) fica no tooltip e para leitor de tela', () => {
    render(
      <GamificationFeedback
        g={{
          ...base,
          xpGained: 125,
          breakdown: { ...base.breakdown, achievementXp: 100 },
        }}
      />,
    );
    const xp = screen.getByText('+125 XP').closest('span')!;
    expect(xp).toHaveAttribute(
      'title',
      '10 da resposta, 9 de bônus diário, 100 de conquistas',
    );
    expect(xp).toHaveTextContent('100 de conquistas');
  });

  it('só nível, ou só liga, vira a frase certa', () => {
    const { rerender } = render(
      <GamificationFeedback g={{ ...base, leagueChanged: false, newAchievements: [] }} />,
    );
    expect(screen.getByText('Subiu para o nível 3!')).toBeInTheDocument();
    rerender(
      <GamificationFeedback g={{ ...base, leveledUp: false, newAchievements: [] }} />,
    );
    expect(screen.getByText('Nova liga: Prata!')).toBeInTheDocument();
  });

  it('omite combo e destaque quando não há', () => {
    render(
      <GamificationFeedback
        g={{
          ...base,
          breakdown: { base: 10, comboMultiplier: 1, dailyBonus: 0, achievementXp: 0 },
          leveledUp: false,
          leagueChanged: false,
          newAchievements: [],
        }}
      />,
    );
    expect(screen.getByText('+25 XP')).toBeInTheDocument();
    expect(screen.queryByText(/combo/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nível|liga/i)).not.toBeInTheDocument();
  });
});
