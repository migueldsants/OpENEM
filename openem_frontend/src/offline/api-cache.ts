/**
 * Nome do cache do service worker com as respostas GET da API (issue #42).
 * Fica num arquivo próprio porque o `vite.config.ts` também o importa: a
 * configuração do Workbox e a limpeza do logout precisam do mesmo nome.
 */
export const API_CACHE = 'api-cache';
