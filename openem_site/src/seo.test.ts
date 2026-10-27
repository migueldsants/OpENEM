import { describe, expect, it } from 'vitest';
import { absolutizar, jsonLd, robotsTxt, siteUrl, sitemapXml } from './seo';

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

  it('o og:url é o canonical, não o endereço da página (espelho sem tradução)', () => {
    const espelho = '<head><link rel="canonical" href="/docs/alunos/x/" /></head>';
    const saida = absolutizar(espelho, 'https://openem.exemplo', '/docs/en/alunos/x/');
    expect(saida).toContain('<meta property="og:url" content="https://openem.exemplo/docs/alunos/x/" />');
  });
});

describe('jsonLd', () => {
  const dados = {
    tipo: 'TechArticle' as const,
    titulo: 'Simulados <novos>',
    descricao: 'Provas no tempo do ENEM.',
    url: '/docs/alunos/simulados/',
    lang: 'pt-BR',
    trilha: [
      { nome: 'Documentação do OpENEM', url: '/docs/' },
      { nome: 'Simulados', url: '/docs/alunos/simulados/' },
    ],
  };

  function grafo(script: string): Record<string, unknown>[] {
    const m = /^<script type="application\/ld\+json">(.*)<\/script>$/.exec(script);
    expect(m).not.toBeNull();
    const json = JSON.parse(m![1]) as { '@context': string; '@graph': Record<string, unknown>[] };
    expect(json['@context']).toBe('https://schema.org');
    return json['@graph'];
  }

  it('com o domínio: a página com url completa e a trilha (BreadcrumbList)', () => {
    const [pagina, trilha] = grafo(jsonLd('https://openem.exemplo', dados));
    expect(pagina).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Simulados <novos>',
      inLanguage: 'pt-BR',
      url: 'https://openem.exemplo/docs/alunos/simulados/',
      isPartOf: { '@type': 'WebSite', name: 'OpENEM', url: 'https://openem.exemplo/' },
    });
    expect(trilha).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: 'https://openem.exemplo/docs/' },
        { position: 2, item: 'https://openem.exemplo/docs/alunos/simulados/' },
      ],
    });
  });

  it('sem o domínio: só a página, sem url nem trilha (exigem endereço completo)', () => {
    const g = grafo(jsonLd(null, dados));
    expect(g).toHaveLength(1);
    expect(g[0]).not.toHaveProperty('url');
  });

  it('o JSON nunca fecha o <script> antes da hora', () => {
    const script = jsonLd(null, { ...dados, titulo: '</script><script>alert(1)</script>' });
    expect(script.indexOf('</script>')).toBe(script.length - '</script>'.length);
  });

  it('documento legal leva a data da última mudança', () => {
    const [pagina] = grafo(
      jsonLd(null, { ...dados, tipo: 'WebPage', atualizado: '2026-10-25', trilha: undefined }),
    );
    expect(pagina).toMatchObject({ '@type': 'WebPage', dateModified: '2026-10-25' });
  });
});
