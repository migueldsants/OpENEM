// Fila offline (issue #42): respostas e avaliações de revisão feitas sem
// rede ficam no IndexedDB e sincronizam quando a conexão volta.
// Deduplicação por chave (último valor vence) para não inflar XP/SM-2
// quando o usuário refaz a mesma ação offline.
import { parseRetryAfter } from '../lib/rate-limit';

/**
 * 429 durante a sincronização (issue #87). O servidor recusou sem processar,
 * então reenviar a mesma ação depois da espera não duplica nada.
 */
export class RateLimitedError extends Error {
  constructor(readonly retryAfterSec: number | null) {
    super('rate limited');
    this.name = 'RateLimitedError';
  }
}

export interface SyncOptions {
  /** Espera entre tentativas; os testes trocam. */
  sleep?: (ms: number) => Promise<void>;
  /** Espera maior que esta fica para a próxima sincronização. */
  maxWaitSec?: number;
  /** 429 seguidos aceitos numa mesma ação antes de desistir por ora. */
  maxRetries?: number;
}

const dormir = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PendingAction =
  | { kind: 'answer'; key: string; questionId: string; chosenId?: string; timeSpentSec?: number }
  | { kind: 'review'; key: string; reviewItemId: string; quality: number };

const DB_NAME = 'openem';
const STORE = 'pending-actions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Enfileira (ou substitui) uma ação pendente. */
export async function enqueue(action: PendingAction): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(action); // mesmo key = substitui (dedupe)
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Lista as ações pendentes (ordem de inserção lógica: FIFO por tipo). */
export async function listPending(): Promise<PendingAction[]> {
  const db = await openDb();
  const all = await new Promise<PendingAction[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingAction[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return all;
}

export async function countPending(): Promise<number> {
  const pending = await listPending();
  return pending.length;
}

/** Remove da fila após o envio com sucesso. */
export async function dequeue(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * Sincroniza a fila: envia cada ação pendente; em sucesso remove da fila.
 * Falhas mantêm a ação na fila para a próxima tentativa. Retorna quantas
 * foram sincronizadas.
 *
 * Com 150 respostas feitas offline, a reconexão esbarra no rate limiting. No
 * 429 a fila para, espera o Retry-After e reenvia a mesma ação (que não foi
 * processada nem saiu da fila): nada se perde nem se duplica. Espera longa
 * demais fica para a próxima sincronização.
 */
export async function syncPending(options: SyncOptions = {}): Promise<number> {
  const { sleep = dormir, maxWaitSec = 60, maxRetries = 5 } = options;
  const pending = await listPending();
  let synced = 0;
  for (const action of pending) {
    let tentativas = 0;
    for (;;) {
      try {
        if (action.kind === 'answer') {
          await sendAnswer(action);
        } else {
          await sendReview(action);
        }
        await dequeue(action.key);
        synced += 1;
        break;
      } catch (err) {
        if (err instanceof RateLimitedError) {
          const espera = err.retryAfterSec ?? 1;
          tentativas += 1;
          if (espera <= maxWaitSec && tentativas <= maxRetries) {
            await sleep(espera * 1000);
            continue;
          }
        }
        // Ainda offline, erro do servidor ou espera longa: tenta mais tarde.
        return synced;
      }
    }
  }
  return synced;
}

function falhou(res: Response, tipo: string): never {
  if (res.status === 429) {
    throw new RateLimitedError(parseRetryAfter(res.headers.get('retry-after')));
  }
  throw new Error(`${tipo} ${res.status}`);
}

async function sendAnswer(action: Extract<PendingAction, { kind: 'answer' }>) {
  const res = await fetch('/api/v1/answers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('openem.token')
        ? {
            Authorization: `Bearer ${localStorage.getItem('openem.token')}`,
          }
        : {}),
    },
    body: JSON.stringify({
      questionId: action.questionId,
      chosenId: action.chosenId,
      timeSpentSec: action.timeSpentSec,
    }),
  });
  if (!res.ok) falhou(res, 'answer');
}

async function sendReview(action: Extract<PendingAction, { kind: 'review' }>) {
  const res = await fetch(`/api/v1/review/${action.reviewItemId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('openem.token')
        ? {
            Authorization: `Bearer ${localStorage.getItem('openem.token')}`,
          }
        : {}),
    },
    body: JSON.stringify({ quality: action.quality }),
  });
  if (!res.ok) falhou(res, 'review');
}