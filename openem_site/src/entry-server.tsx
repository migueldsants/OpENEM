import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { Docs } from './docs/Docs';
import { PAGINAS, PAGINAS_EN, paginaPorUrl } from './docs/conteudo';
import { IDIOMAS, idiomaDaUrl, langDo, TEXTOS, urlNoIdioma } from './docs/i18n';
import { Landing } from './landing/Landing';
import { Legal } from './legal/Legal';
import { DOCUMENTOS, documentoPorUrl, urlDoDocumento } from './legal/documentos';

// O prerender (scripts/prerender.mjs) é JavaScript puro e usa o SEO daqui.
export { absolutizar, robotsTxt, siteUrl, sitemapXml } from './seo';

/** Cada página que o build grava em HTML, com o modelo de onde ela parte. */
export function paginas(): { url: string; modelo: string }[] {
  return [
    { url: '/', modelo: 'index.html' },
    { url: '/docs/', modelo: 'docs/index.html' },
    { url: '/docs/en/', modelo: 'docs/index.html' },
    ...[...PAGINAS, ...PAGINAS_EN].map((p) => ({ url: p.url, modelo: 'docs/index.html' })),
    ...DOCUMENTOS.map((d) => ({ url: d.url, modelo: 'legal/index.html' })),
  ];
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const DESCRICAO_PADRAO = {
  pt: 'Como usar o OpENEM para estudar para o ENEM, e como hospedar ou contribuir com o projeto.',
  en: 'How to host OpENEM, the free and open-source ENEM prep platform, and how to contribute to it.',
};

/** `<head>` comum: título, descrição, canonical, idiomas e Open Graph. */
function cabecalho(
  titulo: string,
  descricao: string,
  url: string,
  idioma: 'pt' | 'en',
  alternativas: { lang: string; href: string }[],
): string {
  return [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<link rel="canonical" href="${url}" />`,
    // A mesma página nos dois idiomas, para o buscador mostrar a certa.
    ...alternativas.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}" />`),
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descricao)}" />`,
    `<meta property="og:locale" content="${idioma === 'en' ? 'en_US' : 'pt_BR'}" />`,
    '<meta property="og:type" content="article" />',
    '<meta property="og:image" content="/og.png" />',
    '<meta name="twitter:card" content="summary_large_image" />',
  ].join('\n    ');
}

/** HTML, `<head>` e o idioma do `<html lang>` de cada página. */
export function renderizar(url: string): { html: string; head: string; lang: string } {
  if (url === '/') {
    return { html: renderToString(<StrictMode><Landing /></StrictMode>), head: '', lang: 'pt-BR' };
  }
  const documento = documentoPorUrl(url);
  if (documento) {
    const head = cabecalho(
      `${documento.titulo} | OpENEM`,
      documento.descricao,
      url,
      documento.idioma,
      IDIOMAS.map((i) => ({ lang: i.lang, href: urlDoDocumento(documento.slug, i.id) })),
    );
    const html = renderToString(
      <StrictMode>
        <Legal url={url} />
      </StrictMode>,
    );
    return { html, head, lang: langDo(documento.idioma) };
  }
  const idioma = idiomaDaUrl(url);
  const base = TEXTOS[idioma].tituloBase;
  const pagina = paginaPorUrl(url);
  const titulo = pagina ? `${pagina.titulo} | ${base}` : base;
  const descricao = (pagina?.traduzida !== false && pagina?.descricao) || DESCRICAO_PADRAO[idioma];
  const head = cabecalho(
    titulo,
    descricao,
    url,
    idioma,
    IDIOMAS.map((i) => ({ lang: i.lang, href: urlNoIdioma(url, i.id) })),
  );
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Docs />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head, lang: langDo(idioma) };
}
