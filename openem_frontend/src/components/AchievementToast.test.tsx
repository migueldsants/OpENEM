// Testes do toast de conquista (issue #48).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AchievementToasts } from './AchievementToast';
import type { Achievement } from '../api';

const ACH: Achievement = {
  code: 'FIRST_ANSWER',
  name: 'Primeiro passo',
  description: 'Responda sua primeira questão.',
  xp: 50,
  icon: '📝',
  color: 'text-brand',
};

describe('AchievementToasts (issue #48)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não renderiza nada com lista vazia', () => {
    const { container } = render(<AchievementToasts list={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra nome, emoji e XP da conquista desbloqueada', async () => {
    vi.useRealTimers();
    render(<AchievementToasts list={[ACH]} />);
    expect(
      await screen.findByText('Conquista desbloqueada'),
    ).toBeInTheDocument();
    expect(screen.getByText('Primeiro passo')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
  });

  it('empilha múltiplas conquistas', async () => {
    vi.useRealTimers();
    render(
      <AchievementToasts
        list={[
          ACH,
          { ...ACH, code: 'STREAK_3', name: 'Pegando o ritmo', icon: '🔥' },
        ]}
      />,
    );
    expect(await screen.findByText('Primeiro passo')).toBeInTheDocument();
    expect(screen.getByText('Pegando o ritmo')).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('some após ~5 segundos', async () => {
    vi.useRealTimers();
    render(<AchievementToasts list={[ACH]} />);
    expect(await screen.findByText('Primeiro passo')).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByText('Primeiro passo')).not.toBeInTheDocument(),
      { timeout: 6000 },
    );
  });
});