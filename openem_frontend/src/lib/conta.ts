// Direitos do titular no app (LGPD, art. 18): o arquivo com os dados do aluno
// e a limpeza do aparelho depois que a conta é excluída.
import { setToken } from '../api';

/** Cache do service worker com as respostas da API (ver vite.config.ts). */
export const API_CACHE = 'api-cache';
/** Banco local: fila offline (offline/queue.ts) e quadros (board/storage.ts). */
export const LOCAL_DB = 'openem';
/** Os quadros caem no localStorage quando não há IndexedDB. */
const BOARD_KEYS = ['openem:board:', 'openem:boards:'];

/** openem-meus-dados-2026-10-25.json, com a data do aparelho. */
export function nomeDoArquivoDeDados(agora = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  const dia = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
  return `openem-meus-dados-${dia}.json`;
}

/** O JSON da exportação, indentado para quem abrir o arquivo conseguir ler. */
export function arquivoDeDados(dados: unknown): Blob {
  return new Blob([JSON.stringify(dados, null, 2)], {
    type: 'application/json',
  });
}

/**
 * Conta excluída: tira deste aparelho o token, as respostas da API guardadas
 * pelo service worker e o banco local (fila offline e quadros). Nada aqui
 * lança erro: num modo privado ou sem service worker, só há menos a apagar.
 */
export async function limparDadosDoAparelho(): Promise<void> {
  setToken(null);
  try {
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (chave && BOARD_KEYS.some((p) => chave.startsWith(p))) chaves.push(chave);
    }
    for (const chave of chaves) localStorage.removeItem(chave);
  } catch {
    /* localStorage indisponível */
  }
  await Promise.all([apagarCacheDaApi(), apagarBancoLocal()]);
}

async function apagarCacheDaApi(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(API_CACHE);
  } catch {
    /* sem Cache Storage (http, modo privado) */
  }
}

function apagarBancoLocal(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    try {
      const req = indexedDB.deleteDatabase(LOCAL_DB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Outra aba com o banco aberto: as conexões fecham no versionchange e a
      // exclusão termina sozinha; não há por que segurar a tela.
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
