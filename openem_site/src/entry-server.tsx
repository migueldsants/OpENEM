import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { GITHUB_URL } from './config';
import { Docs } from './docs/Docs';
import { GRUPOS, PAGINAS, PAGINAS_EN, paginaPorUrl } from './docs/conteudo';
import { IDIOMAS, idiomaDaUrl, langDo, TEXTOS, urlNoIdioma } from './docs/i18n';
import { Landing } from './landing/Landing';
import { Legal } from './legal/Legal';
import { DOCUMENTOS, documentoPorUrl, urlDoDocumento } from './legal/documentos';
import { llmsFullTxt, llmsTxt } from './llms';
import { jsonLd } from './seo';

// O prerender (scripts/prerender.mjs) é JavaScript puro e usa o SEO daqui.
export { absolutizar, robotsTxt, siteUrl, sitemapXml } from './seo';

/**
 * Cada página que o build grava em HTML, com o modelo de onde ela parte.
 * `indexar` é falso no endereço inglês de página sem tradução: ele repete o
 * texto em português, então fica fora do sitemap e aponta o canonical para a
 * página original (conteúdo duplicado não disputa a busca com ela).
 */
export function paginas(): { url: string; modelo: string; indexar: boolean }[] {
  return [
    { url: '/', modelo: 'index.html', indexar: true },
    { url: '/docs/', modelo: 'docs/index.html', indexar: true },
    { url: '/docs/en/', modelo: 'docs/index.html', indexar: true },
    ...[...PAGINAS, ...PAGINAS_EN].map((p) => ({
      url: p.url,
      modelo: 'docs/index.html',
      indexar: p.traduzida,
    })),
    ...DOCUMENTOS.map((d) => ({ url: d.url, modelo: 'legal/index.html', indexar: true })),
  ];
}

/** llms.txt e llms-full.txt (ver ./llms), da documentação em português. */
export function arquivosLlms(site: string | null): { indice: string; completo: string } {
  const entrada = (p: { titulo: string; url: string; descricao: string }) => ({
    titulo: p.titulo,
    url: p.url,
    descricao: p.descricao,
  });
  const secoes = [
    ...GRUPOS.map((g) => ({
      titulo: g.titulo,
      entradas: PAGINAS.filter((p) => p.grupo === g.id).map(entrada),
    })),
    {
      titulo: 'Termos e privacidade',
      entradas: DOCUMENTOS.filter((d) => d.idioma === 'pt').map(entrada),
    },
  ];
  const opcionais = [
    {
      titulo: 'Texto completo da documentação',
      url: '/llms-full.txt',
      descricao: 'Todas as páginas em português num arquivo só, em Markdown.',
    },
    { titulo: 'Documentation in English', url: '/docs/en/', descricao: TEXTOS.en.inicioResumo },
    {
      titulo: 'Código-fonte',
      url: GITHUB_URL,
      descricao: 'Repositório do OpENEM no GitHub, sob a licença AGPL-3.0.',
    },
  ];
  return { indice: llmsTxt(site, secoes, opcionais), completo: llmsFullTxt(site, PAGINAS) };
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const DESCRICAO_PADRAO = {
  pt: 'Como usar o OpENEM para estudar para o ENEM, e como hospedar ou contribuir com o projeto.',
  en: 'How to host OpENEM, the free and open-source ENEM prep platform, and how to contribute to it.',
};

const ALT_IMAGEM = {
  pt: 'OpENEM: preparação gratuita e de código aberto para o ENEM',
  en: 'OpENEM: free and open-source ENEM prep',
};

/** `<head>` comum: título, descrição, canonical, idiomas, Open Graph e JSON-LD. */
function cabecalho(opcoes: {
  titulo: string;
  descricao: string;
  canonical: string;
  idioma: 'pt' | 'en';
  alternativas: { lang: string; href: string }[];
  dados?: string;
}): string {
  const { titulo, descricao, canonical, idioma, alternativas, dados } = opcoes;
  return [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descricao)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    // A mesma página nos dois idiomas, para o buscador mostrar a certa.
    ...alternativas.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}" />`),
    '<meta property="og:site_name" content="OpENEM" />',
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descricao)}" />`,
    `<meta property="og:locale" content="${idioma === 'en' ? 'en_US' : 'pt_BR'}" />`,
    '<meta property="og:type" content="article" />',
    '<meta property="og:image" content="/og.png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapar(ALT_IMAGEM[idioma])}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(dados ? [dados] : []),
  ].join('\n    ');
}

/** HTML, `<head>` e o idioma do `<html lang>` de cada página. */
export function renderizar(
  url: string,
  site: string | null = null,
): { html: string; head: string; lang: string } {
  if (url === '/') {
    return { html: renderToString(<StrictMode><Landing /></StrictMode>), head: '', lang: 'pt-BR' };
  }
  const documento = documentoPorUrl(url);
  if (documento) {
    const head = cabecalho({
      titulo: `${documento.titulo} | OpENEM`,
      descricao: documento.descricao,
      canonical: url,
      idioma: documento.idioma,
      alternativas: IDIOMAS.map((i) => ({
        lang: i.lang,
        href: urlDoDocumento(documento.slug, i.id),
      })),
      dados: jsonLd(site, {
        tipo: 'WebPage',
        titulo: documento.titulo,
        descricao: documento.descricao,
        url,
        lang: langDo(documento.idioma),
        atualizado: documento.atualizado,
      }),
    });
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
  // Endereço inglês sem tradução: o texto é o português, então o canonical é
  // a página em português e não há alternativa em inglês para anunciar.
  const espelho = pagina?.traduzida === false;
  const original = urlNoIdioma(url, 'pt');
  const head = cabecalho({
    titulo,
    descricao,
    canonical: espelho ? original : url,
    idioma,
    alternativas: espelho
      ? [{ lang: 'pt-BR', href: original }]
      : IDIOMAS.map((i) => ({ lang: i.lang, href: urlNoIdioma(url, i.id) })),
    dados:
      pagina && !espelho
        ? jsonLd(site, {
            tipo: 'TechArticle',
            titulo: pagina.titulo,
            descricao: pagina.descricao,
            url,
            lang: langDo(idioma),
            trilha: [
              { nome: TEXTOS[idioma].tituloBase, url: IDIOMAS.find((i) => i.id === idioma)!.base },
              { nome: pagina.titulo, url },
            ],
          })
        : undefined,
  });
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Docs />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head, lang: langDo(idioma) };
}
