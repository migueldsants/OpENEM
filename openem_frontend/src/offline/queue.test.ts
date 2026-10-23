// Testes da fila offline (issue #42) — fake-indexeddb (registrado no setup).
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
    // Corpo da avaliação com a qualidade.
    const reviewBody = JSON.parse((calls[1][1] as RequestInit).body as string);
    expect(reviewBody).toEqual({ quality: 4 });
  });

  it('sync envia review com falha HTTP e a mantém na fila (cobertura do throw)', async () => {
    await enqueue({
      kind: 'review',
      key: 'review:r2:1',
      reviewItemId: 'r2',
      quality: 2,
    });
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 404 }));

    const synced = await syncPending();
    expect(synced).toBe(0);
    expect(await countPending()).toBe(1);
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

describe('fila offline com rate limiting (issue #87)', () => {
  const r429 = (segundos: string) =>
    new Response('{}', { status: 429, headers: { 'Retry-After': segundos } });

  beforeEach(() => {
    localStorage.setItem('openem.token', 'tok');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.removeItem('openem.token');
    for (const a of await listPending()) await dequeue(a.key);
  });

  it('150 respostas sincronizam todas, esperando o Retry-After', async () => {
    for (let i = 0; i < 150; i++) {
      await enqueue({
        kind: 'answer',
        key: `answer:q${i}:1`,
        questionId: `q${i}`,
        chosenId: 'a1',
      });
    }
    // O servidor aceita 20 seguidas e recusa a próxima, como a rajada.
    let seguidas = 0;
    const enviadas: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (seguidas === 20) {
        seguidas = 0;
        return r429('1');
      }
      seguidas += 1;
      enviadas.push(
        JSON.parse((init as RequestInit).body as string).questionId,
      );
      return new Response('{}', { status: 201 });
    });
    const sleep = vi.fn(() => Promise.resolve());

    const synced = await syncPending({ sleep });

    expect(synced).toBe(150);
    expect(await countPending()).toBe(0);
    // Nenhuma perdida e nenhuma repetida.
    expect(enviadas).toHaveLength(150);
    expect(new Set(enviadas).size).toBe(150);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledTimes(7);
  });

  it('espera longa demais fica para a próxima sincronização', async () => {
    await enqueue(ANSWER);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(r429('900'));
    const sleep = vi.fn(() => Promise.resolve());

    const synced = await syncPending({ sleep });

    expect(synced).toBe(0);
    expect(sleep).not.toHaveBeenCalled();
    expect(await countPending()).toBe(1);
  });

  it('desiste depois de muitos 429 seguidos, sem perder a ação', async () => {
    await enqueue(ANSWER);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(r429('2')),
    );
    const sleep = vi.fn(() => Promise.resolve());

    const synced = await syncPending({ sleep, maxRetries: 3 });

    expect(synced).toBe(0);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(await countPending()).toBe(1);
  });

  it('429 sem Retry-After espera 1 s', async () => {
    await enqueue(ANSWER);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const sleep = vi.fn(() => Promise.resolve());

    await expect(syncPending({ sleep })).resolves.toBe(1);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});