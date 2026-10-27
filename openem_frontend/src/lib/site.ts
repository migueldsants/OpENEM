// Endereços do site público (openem_site), que mora na mesma origem do app:
// a documentação em /docs/. No dev (`npm run dev`), o site roda em outro Vite,
// na porta 5174: sem VITE_DOCS_URL, os links (Ajuda, Privacidade, Termos) vão
// para lá. Nos testes o modo é `test` e vale o caminho do servidor.
export const DOCS_URL: string =
  import.meta.env.VITE_DOCS_URL ??
  (import.meta.env.MODE === 'development' ? 'http://localhost:5174/docs/' : '/docs/');

/**
 * Código-fonte desta instalação. A AGPL-3.0 (§13) pede que quem usa o app pela
 * rede possa obter o código que roda nele: quem hospeda uma versão modificada
 * aponta VITE_SOURCE_URL (build arg SOURCE_URL da imagem) para o próprio fork.
 */
export const SOURCE_URL: string =
  import.meta.env.VITE_SOURCE_URL || 'https://github.com/migueldsants/OpENEM';

/** Raiz do site: a documentação mora em <raiz>docs/. */
export const SITE_URL: string = DOCS_URL.replace(/docs\/?$/, '');

/** Política de Privacidade e Termos de Uso, no site. */
export const PRIVACIDADE_URL = `${SITE_URL}privacidade/`;
export const TERMOS_URL = `${SITE_URL}termos/`;

/** Página da documentação para alunos. */
export function docsAlunos(slug: string): string {
  return `${DOCS_URL}alunos/${slug}/`;
}
