// Tela Progresso: ranking com a posição real do aluno e a próxima conquista.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Progresso from './Progresso';
import { api } from '../api';
import type { AchievementView, LeaderboardEntryXp } from '../api';

vi.mock('../api', () => ({
  api: {
    achievements: vi.fn(),
    xpHistory: vi.fn(),
    xpLeaderboard: vi.fn(),
  },
}));

// O mesmo objeto em todo render: a tela sincroniza o resumo num efeito, e um
// objeto novo a cada chamada renderizaria sem parar.
vi.mock('../gamification', () => {
  const value = {
    summary: {
      enabled: true,
      xp: 120,
      level: 3,
      league: { key: 'BRONZE', name: 'Bronze' },
      progress: { into: 20, forNext: 125, pct: 0.16 },
      currentStreak: 2,
      longestStreak: 4,
      lastActivityOn: '2026-10-21',
      answersCount: 10,
      correctCount: 6,
      simulationsCount: 0,
      essaysCount: 0,
      highScoreEssays: 0,
      reviewsCount: 0,
      sessionsDone: 0,
      achievementsUnlocked: 1,
      achievementsTotal: 18,
    },
    refresh: vi.fn(),
  };
  return { useGamification: () => value };
});

const entry = (
  rank: number,
  over: Partial<LeaderboardEntryXp> = {},
): LeaderboardEntryXp => ({
  userId: `u${rank}`,
  displayName: `Aluno ${rank}`,
  xp: 5000 - rank * 10,
  level: 10,
  rank,
  isMe: false,
  ...over,
});

const NEXT: AchievementView = {
  code: 'TEN_ANSWERS',
  name: 'Aquecendo',
  description: 'Responda 10 questões.',
  xp: 100,
  icon: 'target',
  color: 'text-brand',
  unlocked: false,
  unlockedAt: null,
  progress: 0.4,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Progresso />
    </MemoryRouter>,
  );
}

describe('Progresso', () => {
  beforeEach(() => {
    vi.mocked(api.achievements).mockResolvedValue([NEXT]);
    vi.mocked(api.xpHistory).mockResolvedValue({
      enabled: true,
      logs: [],
      byDay: [],
    });
  });

  it('aluno fora do top aparece com a posição real e destacado', async () => {
    vi.mocked(api.xpLeaderboard).mockResolvedValue({
      enabled: true,
      scope: 'league',
      league: 'Bronze',
      entries: [
        ...Array.from({ length: 10 }, (_, i) => entry(i + 1)),
        entry(237, { userId: 'eu', displayName: 'Eu mesmo', xp: 120, isMe: true }),
      ],
    });
    renderPage();

    const me = (await screen.findByText('Eu mesmo')).closest('li')!;
    expect(me).toHaveAttribute('aria-current', 'true');
    expect(within(me).getByText('237')).toBeInTheDocument();
    expect(within(me).getByText('você')).toBeInTheDocument();
    expect(screen.queryByText('11')).toBeNull();
    // O salto na numeração é marcado por uma divisória.
    expect(me.className).toContain('border-t');
    const tenth = screen.getByText('Aluno 10').closest('li')!;
    expect(tenth).not.toHaveAttribute('aria-current');
  });

  it('aluno dentro do top: destacado na própria posição, sem divisória', async () => {
    vi.mocked(api.xpLeaderboard).mockResolvedValue({
      enabled: true,
      scope: 'league',
      league: 'Bronze',
      entries: [entry(1), entry(2, { displayName: 'Eu mesmo', isMe: true }), entry(3)],
    });
    renderPage();

    const me = (await screen.findByText('Eu mesmo')).closest('li')!;
    expect(me).toHaveAttribute('aria-current', 'true');
    expect(within(me).getByText('2')).toBeInTheDocument();
    expect(me.className).not.toContain('border-t');
  });

  it('próxima conquista é um cartão comum, sem faixa lateral', async () => {
    vi.mocked(api.xpLeaderboard).mockResolvedValue({
      enabled: true,
      scope: 'league',
      league: 'Bronze',
      entries: [],
    });
    renderPage();

    const label = await screen.findByText('Próxima conquista');
    const card = label.closest('.card')!;
    expect(card.className).not.toMatch(/border-l-|border-brand/);
    expect(within(card as HTMLElement).getByText('Aquecendo')).toBeInTheDocument();
  });
});
