// Persistência local do Quadro de Estudos (issue #32). Sem backend: tudo no
// dispositivo. Prefere IndexedDB (comporta imagens dataURL); cai para localStorage
// se IDB estiver indisponível (modo privado, quota, etc.).

import type { Board } from './types';
import { cryptoRandomId } from './serialize';

const DB_NAME = 'openem';
const DB_VERSION = 1;
const STORE = 'boards';
const LS_PREFIX = 'openem:board:';
const LS_INDEX = 'openem:boards:index';

let idbSupported: boolean | null = null;

function idbAvailable(): boolean {
  if (idbSupported !== null) return idbSupported;
  try {
    idbSupported =
      typeof indexedDB !== 'undefined' &&
      typeof indexedDB.open === 'function';
  } catch {
    idbSupported = false;
  }
  return idbSupported;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      // Exclusão da conta apaga o banco (lib/conta.ts): a conexão aberta
      // fecha em vez de travar o deleteDatabase.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbAll<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

// --- Fallback localStorage ---

function lsKey(id: string) {
  return `${LS_PREFIX}${id}`;
}

function lsList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_INDEX) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function lsWriteIndex(ids: string[]) {
  localStorage.setItem(LS_INDEX, JSON.stringify(ids));
}

function lsGet(id: string): Board | null {
  const raw = localStorage.getItem(lsKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Board;
  } catch {
    return null;
  }
}

function lsSave(board: Board) {
  localStorage.setItem(lsKey(board.id), JSON.stringify(board));
  const ids = new Set(lsList());
  ids.add(board.id);
  lsWriteIndex([...ids]);
}

function lsDelete(id: string) {
  localStorage.removeItem(lsKey(id));
  lsWriteIndex(lsList().filter((x) => x !== id));
}

// --- API pública ---

export async function listBoards(): Promise<Board[]> {
  if (idbAvailable()) {
    try {
      const all = await idbAll<Board[]>('readonly', (s) => s.getAll());
      return (all ?? []).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } catch {
      // cai para localStorage
    }
  }
  return lsList()
    .map((id) => lsGet(id))
    .filter((b): b is Board => b !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getBoard(id: string): Promise<Board | null> {
  if (idbAvailable()) {
    try {
      const b = await idbAll<Board | undefined>('readonly', (s) => s.get(id));
      return b ?? null;
    } catch {
      /* fallback */
    }
  }
  return lsGet(id);
}

/** Busca um scratch vinculado a uma questão (botão "Anotar"). */
export async function getScratchByQuestion(questionId: string): Promise<Board | null> {
  const all = await listBoards();
  return all.find((b) => b.questionId === questionId) ?? null;
}

export async function saveBoard(board: Board): Promise<void> {
  const next: Board = { ...board, updatedAt: new Date().toISOString() };
  if (idbAvailable()) {
    try {
      await idbAll('readwrite', (s) => s.put(next));
      return;
    } catch {
      /* fallback */
    }
  }
  lsSave(next);
}

export async function deleteBoard(id: string): Promise<void> {
  if (idbAvailable()) {
    try {
      await idbAll('readwrite', (s) => s.delete(id));
      return;
    } catch {
      /* fallback */
    }
  }
  lsDelete(id);
}

/** Duplica um quadro (novo id, novo título, novos timestamps). */
export async function duplicateBoard(id: string): Promise<Board | null> {
  const src = await getBoard(id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: Board = {
    ...src,
    id: cryptoRandomId(),
    title: `${src.title} (cópia)`,
    createdAt: now,
    updatedAt: now,
    elements: src.elements.map((e) => ({ ...e, id: cryptoRandomId() })),
  };
  await saveBoard(copy);
  return copy;
}

/** Reseta o cache de suporte a IDB (útil em testes). */
export function _resetIdbCache() {
  idbSupported = null;
}