// Testes da fila offline (issue #42) — fake-indexeddb (IDB completo em memória).
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueue,
  countPending,
  listPending,
  dequeue,
  syncPending,
  type PendingAction,
} from './queue';

const ANSWER: PendingAction = {
  kind: 'answer',
  key: 'answer:q1:1',
  questionId: 'q1',
  chosenId: 'a1',
};

describe('fila offline (issue #42)', () => {
  beforeEach(() => {
    localStorage.setItem('openem.token', 'tok');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 201 }),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.removeItem('openem.token');
    // Limpa a fila entre testes.
    for (const a of await listPending()) await dequeue(a.key);
  });

  it('enfileira, conta e lista ações pendentes', async () => {
    expect(await countPending()).toBe(0);
    await enqueue(ANSWER);
    expect(await countPending()).toBe(1);
    expect((await listPending())[0].kind).toBe('answer');
  });

  it('enqueue com a mesma chave substitui (dedupe)', async () => {
    await enqueue(ANSWER);
    await enqueue({ ...ANSWER, key: ANSWER.key, chosenId: 'a2' });
    expect(await countPending()).toBe(1);
    const all = await listPending();
    expect(all[0]).toMatchObject({ chosenId: 'a2' });
  });

  it('dequeue remove após o envio', async () => {
    await enqueue(ANSWER);
    await dequeue(ANSWER.key);
    expect(await countPending()).toBe(0);
  });

  it('syncPending envia answer e review e limpa a fila', async () => {
    await enqueue(ANSWER);
    await enqueue({
      kind: 'review',
      key: 'review:r1:1',
      reviewItemId: 'r1',
      quality: 4,
    });

    const synced = await syncPending();
    expect(synced).toBe(2);
    expect(await countPending()).toBe(0);
    // Os POSTs vão para os endpoints corretos com o token.
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0][0]).toBe('/api/v1/answers');
    expect(calls[1][0]).toBe('/api/v1/review/r1');
    const headers = (calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('sync para na primeira falha de rede e mantém a ação na fila', async () => {
    await enqueue(ANSWER);
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'));

    const synced = await syncPending();
    expect(synced).toBe(0);
    expect(await countPending()).toBe(1);
  });

  it('erro HTTP (4xx) também mantém na fila', async () => {
    await enqueue(ANSWER);
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }));

    const synced = await syncPending();
    expect(synced).toBe(0);
    expect(await countPending()).toBe(1);
  });
});