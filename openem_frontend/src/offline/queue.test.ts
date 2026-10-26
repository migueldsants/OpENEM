// Testes da fila offline (issue #42) — fake-indexeddb (registrado no setup).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueue,
  countPending,
  listPending,
  dequeue,
  syncPending,
  clearPending,
  currentOwner,
  type PendingAction,
} from './queue';

/** JWT só com o payload que a fila lê (assinatura não é conferida aqui). */
function jwtDe(sub: string): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256' })}.${b64url({ sub })}.assinatura`;
}

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

describe('fila offline por aluno (aparelho compartilhado)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 201 }),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.removeItem('openem.token');
    await clearPending();
  });

  it('currentOwner lê o sub do JWT e devolve null sem token ou com token inválido', () => {
    expect(currentOwner()).toBeNull();
    localStorage.setItem('openem.token', jwtDe('aluno-a'));
    expect(currentOwner()).toBe('aluno-a');
    localStorage.setItem('openem.token', 'nao-e-jwt');
    expect(currentOwner()).toBeNull();
  });

  it('marca a ação com o aluno logado', async () => {
    localStorage.setItem('openem.token', jwtDe('aluno-a'));
    await enqueue(ANSWER);
    expect((await listPending())[0].owner).toBe('aluno-a');
  });

  it('não envia a resposta de um aluno com o token de outro', async () => {
    localStorage.setItem('openem.token', jwtDe('aluno-a'));
    await enqueue(ANSWER);

    localStorage.setItem('openem.token', jwtDe('aluno-b'));
    expect(await countPending()).toBe(0);
    expect(await syncPending()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    // Continua guardada para quando o aluno A voltar.
    expect(await listPending()).toHaveLength(1);

    localStorage.setItem('openem.token', jwtDe('aluno-a'));
    expect(await syncPending()).toBe(1);
  });

  it('ação antiga, sem owner, segue com o token atual', async () => {
    localStorage.setItem('openem.token', jwtDe('aluno-b'));
    // enqueue sempre marca: grava direto, como antes do campo existir.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('openem', 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('pending-actions', 'readwrite');
      tx.objectStore('pending-actions').put(ANSWER);
      tx.oncomplete = () => resolve();
    });
    db.close();
    expect(await syncPending()).toBe(1);
  });

  it('clearPending esvazia a fila de todos os alunos', async () => {
    localStorage.setItem('openem.token', jwtDe('aluno-a'));
    await enqueue(ANSWER);
    localStorage.setItem('openem.token', jwtDe('aluno-b'));
    await enqueue({ ...ANSWER, key: 'answer:q2:1', questionId: 'q2' });
    await clearPending();
    expect(await listPending()).toHaveLength(0);
  });
});