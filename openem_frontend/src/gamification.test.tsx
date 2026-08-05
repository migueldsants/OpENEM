import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  GamificationProvider,
  useGamification,
} from './gamification';
import { useAuth } from './auth';

vi.mock('./auth');
vi.mock('./api', () => ({
  api: {
    gamification: vi.fn(),
  },
}));

const { api } = await import('./api');

function wrapper({ children }: { children: React.ReactNode }) {
  return <GamificationProvider>{children}</GamificationProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGamification', () => {
  it('carrega o resumo quando autenticado', async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
    });
    (api.gamification as ReturnType<typeof vi.fn>).mockResolvedValue({
      enabled: true,
      xp: 120,
      level: 2,
      league: { key: 'bronze', name: 'Bronze' },
      progress: { into: 120, forNext: 500, pct: 0.24 },
      currentStreak: 3,
      longestStreak: 5,
      lastActivityOn: '2026-08-04',
      answersCount: 10,
      correctCount: 6,
      achievementsUnlocked: 1,
      achievementsTotal: 8,
    });

    const { result } = renderHook(() => useGamification(), { wrapper });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    const summary = result.current.summary;
    if (!summary || !summary.enabled) {
      throw new Error('esperado summary habilitado');
    }
    expect(summary.enabled).toBe(true);
    expect(summary.level).toBe(2);
  });

  it('mantem summary null quando nao autenticado', async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: false,
    });
    const { result } = renderHook(() => useGamification(), { wrapper });
    await waitFor(() => expect(result.current.summary).toBeNull());
    expect(api.gamification).not.toHaveBeenCalled();
  });

  it('silencia falhas de rede (summary permanece null)', async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      authenticated: true,
    });
    (api.gamification as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('rede'),
    );
    const { result } = renderHook(() => useGamification(), { wrapper });
    await waitFor(() => expect(api.gamification).toHaveBeenCalled());
    expect(result.current.summary).toBeNull();
  });

  it('lanca quando usado fora do provider', () => {
    expect(() => renderHook(() => useGamification())).toThrow(
      /useGamification/,
    );
  });
});