// SEO do site gerado no build (issue #88): robots.txt, sitemap.xml e as URLs
// absolutas que o Open Graph exige. O domínio vem de SITE_URL no build; cada
// instalação tem o seu, e sem ele o sitemap não é gerado (ele só aceita URL
// completa).

/** SITE_URL sem barra no fim, ou null quando não foi definido ou é inválido. */
export function siteUrl(raw: string | undefined): string | null {
  const valor = raw?.trim();
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** O app e a API ficam fora dos buscadores: são telas de quem já tem conta. */
export function robotsTxt(site: string | null): string {
  const linhas = ['User-agent: *', 'Allow: /', 'Disallow: /app/', 'Disallow: /api/'];
  if (site) linhas.push('', `Sitemap: ${site}/sitemap.xml`);
  return linhas.join('\n') + '\n';
}

function escaparXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sitemapXml(site: string, urls: string[]): string {
  const itens = urls.map((u) => `  <url><loc>${escaparXml(site + u)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...itens,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Troca os caminhos relativos do canonical e do og:image pelo endereço
 * completo, e acrescenta o og:url, que é o canonical (no espelho inglês sem
 * tradução, a página em português). Sem SITE_URL, a página fica como está.
 */
export function absolutizar(html: string, site: string | null, url: string): string {
  if (!site) return html;
  const canonical = /<link rel="canonical" href="(\/[^"]*)"/.exec(html)?.[1] ?? url;
  return html
    .replace(/(<link rel="canonical" href=")(\/[^"]*)"/, `$1${site}$2"`)
    .replace(/(<link rel="alternate" hreflang="[^"]+" href=")(\/[^"]*)"/g, `$1${site}$2"`)
    .replace(/(<meta property="og:image" content=")(\/[^"]*)"/, `$1${site}$2"`)
    .replace('</head>', `  <meta property="og:url" content="${site}${canonical}" />\n  </head>`);
}

const LICENCA = 'https://www.gnu.org/licenses/agpl-3.0.html';

export interface DadosDaPagina {
  /** TechArticle nos guias da documentação; WebPage nos documentos legais. */
  tipo: 'TechArticle' | 'WebPage';
  titulo: string;
  descricao: string;
  /** Caminho da página, começando em /. */
  url: string;
  /** Idioma no formato do `<html lang>` (pt-BR, en). */
  lang: string;
  /** Data da última mudança, AAAA-MM-DD, quando a página a tem. */
  atualizado?: string;
  /** Trilha até a página, da raiz da documentação até ela. */
  trilha?: { nome: string; url: string }[];
}

/**
 * Dados estruturados (schema.org em JSON-LD) de uma página, para o buscador
 * entender o que ela é. A `url` e a trilha (BreadcrumbList) exigem endereço
 * completo: sem SITE_URL, elas ficam de fora e sobra só a descrição da página.
 * O `<` vira escape para o JSON nunca fechar o `<script>` antes da hora.
 */
export function jsonLd(site: string | null, dados: DadosDaPagina): string {
  const pagina: Record<string, unknown> = {
    '@type': dados.tipo,
    name: dados.titulo,
    headline: dados.titulo,
    description: dados.descricao,
    inLanguage: dados.lang,
    license: LICENCA,
    isPartOf: { '@type': 'WebSite', name: 'OpENEM', ...(site ? { url: `${site}/` } : {}) },
  };
  if (site) pagina.url = `${site}${dados.url}`;
  if (dados.atualizado) pagina.dateModified = dados.atualizado;
  const grafo: Record<string, unknown>[] = [pagina];
  if (site && dados.trilha && dados.trilha.length > 0) {
    grafo.push({
      '@type': 'BreadcrumbList',
      itemListElement: dados.trilha.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.nome,
        item: `${site}${t.url}`,
      })),
    });
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo }).replace(
    /</g,
    '\\u003c',
  );
  return `<script type="application/ld+json">${json}</script>`;
}
