// O que o aparelho guarda de um aluno e precisa sair quando ele sai da conta.
// O público divide celular com a família e usa computador da escola: o
// próximo a entrar não pode ver os dados nem herdar as ações do anterior.
import { API_CACHE } from './api-cache';
import { clearPending } from './queue';

/**
 * Apaga o cache das respostas da API. O Workbox guarda cada resposta pela URL,
 * sem o token: com rede lenta (mais de 5 s), o `/users/me` de um aluno era
 * servido ao próximo que entrasse no mesmo aparelho.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(API_CACHE);
  } catch {
    // Cache Storage indisponível (aba privada, navegador antigo): nada a apagar.
  }
}

/** Logout: cache da API e fila offline (ações não enviadas se perdem). */
export async function clearSessionData(): Promise<void> {
  await Promise.allSettled([clearApiCache(), clearPending()]);
}
