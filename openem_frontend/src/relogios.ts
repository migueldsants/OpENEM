import { useSyncExternalStore } from 'react';
import {
  lerRelogios,
  MAX_RELOGIOS,
  type Relogio,
} from './lib/relogios';

/*
 * Estado dos cronômetros e timers. Vive fora do React (como o modo imersivo)
 * para a tela e o aviso de fim de timer, montado no App, lerem a mesma lista:
 * o timer toca mesmo com o aluno em outra tela.
 */

const STORAGE_KEY = 'openem.relogios';

function carregar(): Relogio[] {
  try {
    return lerRelogios(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

let lista: Relogio[] = carregar();
const ouvintes = new Set<() => void>();

function emitir() {
  for (const o of ouvintes) o();
}

function definir(nova: Relogio[]) {
  lista = nova;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nova));
  } catch {
    /* sem armazenamento os relógios ainda funcionam até recarregar */
  }
  emitir();
}

/** Relê do armazenamento: outra aba mexeu na lista. */
function recarregar() {
  lista = carregar();
  emitir();
}

function assinar(o: () => void) {
  if (ouvintes.size === 0) window.addEventListener('storage', aoMudar);
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
    if (ouvintes.size === 0) window.removeEventListener('storage', aoMudar);
  };
}

function aoMudar(e: StorageEvent) {
  if (e.key === null || e.key === STORAGE_KEY) recarregar();
}

export function useRelogios(): Relogio[] {
  return useSyncExternalStore(assinar, () => lista);
}

export const relogios = {
  /** Devolve `false` quando a lista já está cheia. */
  adicionar(r: Relogio): boolean {
    if (lista.length >= MAX_RELOGIOS) return false;
    definir([...lista, r]);
    return true;
  },
  atualizar(id: string, fn: (r: Relogio) => Relogio) {
    definir(lista.map((r) => (r.id === id ? fn(r) : r)));
  },
  remover(id: string) {
    definir(lista.filter((r) => r.id !== id));
  },
  marcarTocados(ids: string[]) {
    definir(lista.map((r) => (ids.includes(r.id) ? { ...r, tocou: true } : r)));
  },
  recarregar,
};
