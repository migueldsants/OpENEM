import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { Docs } from './docs/Docs';
import { PAGINAS, paginaPorUrl, TITULO_BASE } from './docs/conteudo';
import { Landing } from './landing/Landing';

/** Cada página que o build grava em HTML, com o modelo de onde ela parte. */
export function paginas(): { url: string; modelo: string }[] {
  return [
    { url: '/', modelo: 'index.html' },
    { url: '/docs/', modelo: 'docs/index.html' },
    ...PAGINAS.map((p) => ({ url: p.url, modelo: 'docs/index.html' })),
  ];
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function renderizar(url: string): { html: string; head: string } {
  if (url === '/') {
    return { html: renderToString(<StrictMode><Landing /></StrictMode>), head: '' };
  }
  const pagina = paginaPorUrl(url);
  const titulo = pagina ? `${pagina.titulo} | ${TITULO_BASE}` : TITULO_BASE;
  const descricao =
    pagina?.descricao ||
    'Como usar o OpENEM para estudar para o ENEM, e como hospedar ou contribuir com o projeto.';
  const head = [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descricao)}" />`,
  ].join('\n    ');
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Docs />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head };
}
