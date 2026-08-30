// Testes da tela Conquistas (issue #48).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Conquistas from './Conquistas';
import { api } from '../api';
import type { AchievementView } from '../api';

vi.mock('../api', () => ({
  api: {
    achievements: vi.fn(),
  },
}));

const ITEMS: AchievementView[] = [
  {
    code: 'FIRST_ANSWER',
    name: 'Primeiro passo',
    description: 'Responda sua primeira questão.',
    xp: 50,
    icon: '📝',
    color: 'text-brand',
    unlocked: true,
    unlockedAt: new Date().toISOString(),
    progress: 1,
  },
  {
    code: 'TEN_ANSWERS',
    name: 'Aquecendo',
    description: 'Responda 10 questões.',
    xp: 100,
    icon: '🎯',
    color: 'text-brand',
    unlocked: false,
    unlockedAt: null,
    progress: 0.4,
  },
  {
    code: 'STREAK_3',
    name: 'Pegando o ritmo',
    description: 'Estude 3 dias seguidos.',
    xp: 75,
    icon: '🔥',
    color: 'text-red',
    unlocked: false,
    unlockedAt: null,
    progress: 0,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Conquistas />
    </MemoryRouter>,
  );
}

describe('Conquistas (issue #48)', () => {
  it('mostra o total desbloqueado e a barra geral', async () => {
    vi.mocked(api.achievements).mockResolvedValue(ITEMS);
    renderPage();

    expect(await screen.findByText('Primeiro passo')).toBeInTheDocument();
    // "1" e "/3" estão em spans separados no cabeçalho.
    expect(
      screen.getByText((_, el) => el?.textContent === '1/3'),
    ).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText(/50 XP acumulado/)).toBeInTheDocument();
  });

  it('agrupa por categoria com títulos', async () => {
    vi.mocked(api.achievements).mockResolvedValue(ITEMS);
    renderPage();

    await screen.findByText('Primeiro passo');
    expect(screen.getByRole('heading', { name: 'Questões' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sequência' })).toBeInTheDocument();
  });

  it('cards travados mostram progresso em %; desbloqueados mostram data', async () => {
    vi.mocked(api.achievements).mockResolvedValue(ITEMS);
    renderPage();

    await screen.findByText('Aquecendo');
    expect(screen.getByText('40%')).toBeInTheDocument();
    // "Desbloqueada" aparece na barra e na linha da data do card.
    expect(screen.getAllByText(/Desbloqueada/).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('estado vazio quando nada desbloqueado', async () => {
    vi.mocked(api.achievements).mockResolvedValue(
      ITEMS.map((i) => ({ ...i, unlocked: false, unlockedAt: null })),
    );
    renderPage();

    expect(
      await screen.findByText('Nenhuma conquista ainda'),
    ).toBeInTheDocument();
  });

  it('exibe erro quando a API falha', async () => {
    vi.mocked(api.achievements).mockRejectedValue(new Error('Falhou'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Falhou');
  });
});