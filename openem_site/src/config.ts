/**
 * Onde o app mora. No servidor, o app fica em /app/, na mesma origem. No dev
 * (`npm run dev`), o app roda no Vite dele, na porta 5173: sem VITE_APP_URL,
 * o link vai para lá. Nos testes o modo é `test` e vale o caminho do servidor.
 */
export const APP_URL: string =
  import.meta.env.VITE_APP_URL ??
  (import.meta.env.MODE === 'development' ? 'http://localhost:5173/app/' : '/app/');

export const DOCS_URL = '/docs/';

export const GITHUB_URL = 'https://github.com/migueldsants/OpENEM';
