// Fila offline (issue #42): respostas e avaliações de revisão feitas sem
// rede ficam no IndexedDB e sincronizam quando a conexão volta.
// Deduplicação por chave (último valor vence) para não inflar XP/SM-2
// quando o usuário refaz a mesma ação offline.

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
 */
export async function syncPending(): Promise<number> {
  const pending = await listPending();
  let synced = 0;
  for (const action of pending) {
    try {
      if (action.kind === 'answer') {
        await sendAnswer(action);
      } else {
        await sendReview(action);
      }
      await dequeue(action.key);
      synced += 1;
    } catch {
      // Ainda offline ou erro do servidor: tenta de novo mais tarde.
      break;
    }
  }
  return synced;
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
  if (!res.ok) throw new Error(`answer ${res.status}`);
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
  if (!res.ok) throw new Error(`review ${res.status}`);
}