// Telas de conta fora do login: o que vem no fragmento das URLs de volta
// (link do e-mail, volta do Google) e os direitos do titular no app (LGPD,
// art. 18): o arquivo com os dados do aluno e a limpeza do aparelho depois que
// a conta é excluída.
import { setToken } from '../api';
import { clearApiCache } from '../offline/session';

export { API_CACHE } from '../offline/api-cache';

/**
 * Valor de um parâmetro do fragmento (`#token=...`). O link do e-mail e a
 * volta do Google mandam o segredo no fragmento porque o navegador não o
 * envia a servidor nenhum (nem em log, nem no Referer).
 */
export function fragmentParam(hash: string, nome: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(nome);
}

/** O que a API manda em `#erro=` na volta do Google, em frase. */
export const ERROS_GOOGLE: Record<string, string> = {
  cancelado: 'Você cancelou a entrada pelo Google.',
  sessao:
    'A entrada pelo Google demorou demais ou foi aberta em outra aba. Tente de novo.',
  email:
    'O Google não confirmou o e-mail desta conta. Use outra conta Google ou entre com e-mail e senha.',
  conta:
    'Este e-mail já está ligado a outra conta Google, ou há mais de uma conta com ele aqui. Entre com e-mail e senha.',
  falha: 'Não foi possível entrar pelo Google. Tente de novo em instantes.',
};

/** Frase de um código de erro da volta do Google (desconhecido = falha). */
export function erroGoogle(codigo: string | null): string {
  return (codigo && ERROS_GOOGLE[codigo]) || ERROS_GOOGLE.falha;
}

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
  await Promise.all([clearApiCache(), apagarBancoLocal()]);
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
