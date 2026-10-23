import { describe, expect, it } from 'vitest';
import { absolutizar, robotsTxt, siteUrl, sitemapXml } from './seo';

describe('siteUrl', () => {
  it.each([
    ['https://openem.exemplo', 'https://openem.exemplo'],
    ['https://openem.exemplo/', 'https://openem.exemplo'],
    [' https://escola.exemplo/openem/ ', 'https://escola.exemplo/openem'],
  ])('%p → %p', (raw, esperado) => {
    expect(siteUrl(raw)).toBe(esperado);
  });

  it.each([[undefined], [''], ['openem.exemplo'], ['ftp://x.exemplo']])('%p não vale', (raw) => {
    expect(siteUrl(raw)).toBeNull();
  });
});

describe('robotsTxt', () => {
  it('tira o app e a API dos buscadores', () => {
    const txt = robotsTxt(null);
    expect(txt).toContain('Disallow: /app/');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).not.toContain('Sitemap');
  });

  it('com o domínio, aponta o sitemap', () => {
    expect(robotsTxt('https://openem.exemplo')).toContain(
      'Sitemap: https://openem.exemplo/sitemap.xml',
    );
  });
});

describe('sitemapXml', () => {
  it('lista as páginas com o endereço completo', () => {
    const xml = sitemapXml('https://openem.exemplo', ['/', '/docs/']);
    expect(xml).toContain('<loc>https://openem.exemplo/</loc>');
    expect(xml).toContain('<loc>https://openem.exemplo/docs/</loc>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});

describe('absolutizar', () => {
  const html =
    '<head><link rel="canonical" href="/docs/" /><meta property="og:image" content="/og.png" /></head>';

  it('com o domínio, URLs completas e og:url', () => {
    const saida = absolutizar(html, 'https://openem.exemplo', '/docs/');
    expect(saida).toContain('href="https://openem.exemplo/docs/"');
    expect(saida).toContain('content="https://openem.exemplo/og.png"');
    expect(saida).toContain('<meta property="og:url" content="https://openem.exemplo/docs/" />');
  });

  it('as versões em outro idioma (hreflang) também ficam absolutas', () => {
    const comIdiomas =
      '<head><link rel="alternate" hreflang="pt-BR" href="/docs/x/" /><link rel="alternate" hreflang="en" href="/docs/en/x/" /></head>';
    const saida = absolutizar(comIdiomas, 'https://openem.exemplo', '/docs/x/');
    expect(saida).toContain('hreflang="pt-BR" href="https://openem.exemplo/docs/x/"');
    expect(saida).toContain('hreflang="en" href="https://openem.exemplo/docs/en/x/"');
  });

  it('sem o domínio, nada muda', () => {
    expect(absolutizar(html, null, '/docs/')).toBe(html);
  });
});
