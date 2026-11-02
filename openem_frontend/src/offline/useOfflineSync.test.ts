import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countPending, syncPending } from './queue';
import { useOfflineSync } from './useOfflineSync';

vi.mock('./queue', () => ({
  countPending: vi.fn(),
  syncPending: vi.fn(),
}));

const mockCount = vi.mocked(countPending);
const mockSync = vi.mocked(syncPending);

afterEach(() => {
  vi.clearAllMocks();
});

describe('useOfflineSync', () => {
  it('sincroniza ao montar, conta as pendências e avisa as telas', async () => {
    mockSync.mockResolvedValue(2);
    mockCount.mockResolvedValue(1);
    const ouvinte = vi.fn();
    window.addEventListener('openem:synced', ouvinte);

    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => expect(result.current.pending).toBe(1));
    expect(result.current.syncing).toBe(false);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener('openem:synced', ouvinte);
  });

  it('fila que responde depois de desmontar não mexe no estado nem dispara evento', async () => {
    // A corrida do CI: o IndexedDB responde quando o App já saiu da tela.
    let terminar!: (n: number) => void;
    mockSync.mockReturnValue(
      new Promise<number>((resolve) => {
        terminar = resolve;
      }),
    );
    mockCount.mockResolvedValue(0);
    const ouvinte = vi.fn();
    window.addEventListener('openem:synced', ouvinte);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useOfflineSync());
    expect(result.current.syncing).toBe(true);
    unmount();

    await act(async () => {
      terminar(3);
      await Promise.resolve();
    });

    expect(ouvinte).not.toHaveBeenCalled();
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
    window.removeEventListener('openem:synced', ouvinte);
  });
});
