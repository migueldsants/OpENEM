// Endereços do site público (openem_site), que mora na mesma origem do app:
// a documentação em /docs/. No dev, o site roda em outro Vite (:5174), e
// VITE_DOCS_URL aponta para lá.
export const DOCS_URL: string = import.meta.env.VITE_DOCS_URL ?? '/docs/';

/** Página da documentação para alunos. */
export function docsAlunos(slug: string): string {
  return `${DOCS_URL}alunos/${slug}/`;
}
