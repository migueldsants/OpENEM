import { describe, expect, it } from 'vitest';
import {
  ancora,
  buscar,
  espelhoEmIngles,
  lerCabecalho,
  lerCaminho,
  montarPaginas,
  PAGINAS,
  PAGINAS_EN,
  titulosDaPagina,
} from './conteudo';

const FONTE = `---
titulo: Simulados
descricao: Como montar um simulado.
---

## Montar um simulado por tema

Escolha área, matéria e assunto.

\`\`\`bash
## isto não é título
\`\`\`

## Caderno em PDF
`;

describe('cabeçalho e caminho', () => {
  it('lê título, descrição e corpo (também com CRLF)', () => {
    const c = lerCabecalho(FONTE.replace(/\n/g, '\r\n'));
    expect(c.titulo).toBe('Simulados');
    expect(c.descricao).toBe('Como montar um simulado.');
    expect(c.corpo.startsWith('## Montar')).toBe(true);
  });

  it('arquivo sem cabeçalho vira só corpo', () => {
    expect(lerCabecalho('# Oi')).toEqual({ titulo: '', descricao: '', corpo: '# Oi' });
  });

  it('extrai grupo, ordem e slug do caminho', () => {
    expect(lerCaminho('./conteudo/alunos/03-simulados.md')).toEqual({
      idioma: 'pt',
      grupo: 'alunos',
      ordem: 3,
      slug: 'simulados',
    });
    expect(lerCaminho('./conteudo/en/hospedar/01-instalacao.md')).toEqual({
      idioma: 'en',
      grupo: 'hospedar',
      ordem: 1,
      slug: 'instalacao',
    });
    expect(lerCaminho('./conteudo/outro/01-x.md')).toBeNull();
  });

  it('ordena por grupo e número e monta a URL sem o número', () => {
    const p = montarPaginas({
      './conteudo/contribuir/01-a.md': '---\ntitulo: A\n---\n',
      './conteudo/alunos/02-c.md': '---\ntitulo: C\n---\n',
      './conteudo/alunos/01-b.md': '---\ntitulo: B\n---\n',
    });
    expect(p.map((x) => x.url)).toEqual(['/docs/alunos/b/', '/docs/alunos/c/', '/docs/contribuir/a/']);
    expect(p[0].arquivo).toBe('openem_site/src/docs/conteudo/alunos/01-b.md');
  });
});

describe('títulos e âncoras', () => {
  it('âncora sem acento e sem pontuação', () => {
    expect(ancora('Caderno em PDF: imprimir')).toBe('caderno-em-pdf-imprimir');
    expect(ancora('Revisão espaçada')).toBe('revisao-espacada');
  });

  it('lista só os ## fora de bloco de código', () => {
    const { corpo } = lerCabecalho(FONTE);
    expect(titulosDaPagina(corpo).map((t) => t.texto)).toEqual([
      'Montar um simulado por tema',
      'Caderno em PDF',
    ]);
  });
});

describe('busca', () => {
  const paginas = montarPaginas({
    './conteudo/alunos/01-simulados.md': FONTE,
    './conteudo/alunos/02-revisao.md': '---\ntitulo: Revisão\ndescricao: Revisão espaçada.\n---\nO assunto volta no dia seguinte.',
  });

  it('acha sem acento e sem caixa, título primeiro', () => {
    expect(buscar(paginas, 'REVISAO')[0].pagina.titulo).toBe('Revisão');
    expect(buscar(paginas, 'simulado')[0].pagina.titulo).toBe('Simulados');
  });

  it('exige todas as palavras e ignora consulta curta', () => {
    expect(buscar(paginas, 'revisao pdf')).toHaveLength(0);
    expect(buscar(paginas, 'a')).toHaveLength(0);
  });
});

describe('espelho em inglês', () => {
  const pt = montarPaginas({
    './conteudo/hospedar/01-a.md': '---\ntitulo: A\ndescricao: a\n---\nTexto A.',
    './conteudo/hospedar/02-b.md': '---\ntitulo: B\ndescricao: b\n---\nTexto B.',
  });
  const en = montarPaginas({
    './conteudo/en/hospedar/01-a.md': '---\ntitulo: A (en)\ndescricao: a\n---\nText A.',
  });
  const espelho = espelhoEmIngles(pt, en);

  it('a página traduzida vem do arquivo em inglês, em /docs/en/', () => {
    expect(espelho[0]).toMatchObject({
      idioma: 'en',
      traduzida: true,
      titulo: 'A (en)',
      url: '/docs/en/hospedar/a/',
      arquivo: 'openem_site/src/docs/conteudo/en/hospedar/01-a.md',
    });
  });

  it('a sem tradução repete o português no endereço inglês, marcada', () => {
    expect(espelho[1]).toMatchObject({
      idioma: 'en',
      traduzida: false,
      titulo: 'B',
      corpo: 'Texto B.',
      url: '/docs/en/hospedar/b/',
    });
  });

  it('as duas listas têm as mesmas páginas, na mesma ordem', () => {
    expect(PAGINAS_EN.map((p) => `${p.grupo}/${p.slug}`)).toEqual(
      PAGINAS.map((p) => `${p.grupo}/${p.slug}`),
    );
  });
});

describe('conteúdo publicado', () => {
  it('toda página tem título, descrição e nenhum travessão', () => {
    for (const p of [...PAGINAS, ...PAGINAS_EN]) {
      expect(p.titulo, p.arquivo).not.toBe('');
      expect(p.descricao, p.arquivo).not.toBe('');
      expect(p.corpo, p.arquivo).not.toMatch(/[—–]/);
      expect(p.corpo, p.arquivo).not.toMatch(/^# /m);
    }
  });

  it('hospedar e contribuir estão traduzidas para o inglês', () => {
    for (const p of PAGINAS_EN.filter((x) => x.grupo !== 'alunos' && x.slug !== 'api')) {
      expect(p.traduzida, p.url).toBe(true);
    }
  });

  it('a página traduzida só aponta para a documentação em inglês', () => {
    for (const p of PAGINAS_EN.filter((x) => x.traduzida)) {
      for (const m of p.corpo.matchAll(/\]\((\/docs\/[^)#\s]*)/g)) {
        expect(m[1].startsWith('/docs/en/'), `${p.arquivo} -> ${m[1]}`).toBe(true);
      }
    }
  });

  it('links internos apontam para páginas que existem', () => {
    const urls = new Set(['/docs/', '/docs/en/', ...PAGINAS.map((p) => p.url), ...PAGINAS_EN.map((p) => p.url)]);
    for (const p of [...PAGINAS, ...PAGINAS_EN.filter((x) => x.traduzida)]) {
      for (const m of p.corpo.matchAll(/\]\((\/docs\/[^)#\s]*)/g)) {
        const alvo = m[1].endsWith('/') ? m[1] : `${m[1]}/`;
        expect(urls.has(alvo), `${p.arquivo} -> ${m[1]}`).toBe(true);
      }
    }
  });
});
