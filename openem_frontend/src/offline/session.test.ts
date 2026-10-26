// Limpeza do aparelho no logout: cache da API do service worker + fila offline.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { API_CACHE } from './api-cache';
import { enqueue, listPending } from './queue';
import { clearApiCache, clearSessionData } from './session';

describe('limpeza da sessão no aparelho', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('apaga o cache da API pelo mesmo nome que o Workbox usa', async () => {
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { delete: del });
    await clearApiCache();
    expect(del).toHaveBeenCalledWith(API_CACHE);
    expect(API_CACHE).toBe('api-cache');
  });

  it('não quebra sem Cache Storage nem quando ele falha', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(clearApiCache()).resolves.toBeUndefined();
    vi.stubGlobal('caches', { delete: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(clearApiCache()).resolves.toBeUndefined();
  });

  it('clearSessionData esvazia também a fila offline', async () => {
    vi.stubGlobal('caches', { delete: vi.fn().mockResolvedValue(true) });
    await enqueue({ kind: 'answer', key: 'answer:q1:1', questionId: 'q1' });
    await clearSessionData();
    expect(await listPending()).toHaveLength(0);
  });
});
