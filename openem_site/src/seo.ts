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
 * completo, e acrescenta o og:url. Sem SITE_URL, a página fica como está.
 */
export function absolutizar(html: string, site: string | null, url: string): string {
  if (!site) return html;
  return html
    .replace(/(<link rel="canonical" href=")(\/[^"]*)"/, `$1${site}$2"`)
    .replace(/(<meta property="og:image" content=")(\/[^"]*)"/, `$1${site}$2"`)
    .replace('</head>', `  <meta property="og:url" content="${site}${url}" />\n  </head>`);
}
