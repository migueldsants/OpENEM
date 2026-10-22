import { describe, expect, it } from 'vitest';
import {
  ancora,
  buscar,
  lerCabecalho,
  lerCaminho,
  montarPaginas,
  PAGINAS,
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
      grupo: 'alunos',
      ordem: 3,
      slug: 'simulados',
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

describe('conteúdo publicado', () => {
  it('toda página tem título, descrição e nenhum travessão', () => {
    for (const p of PAGINAS) {
      expect(p.titulo, p.arquivo).not.toBe('');
      expect(p.descricao, p.arquivo).not.toBe('');
      expect(p.corpo, p.arquivo).not.toMatch(/[—–]/);
      expect(p.corpo, p.arquivo).not.toMatch(/^# /m);
    }
  });

  it('links internos apontam para páginas que existem', () => {
    const urls = new Set(['/docs/', ...PAGINAS.map((p) => p.url)]);
    for (const p of PAGINAS) {
      for (const m of p.corpo.matchAll(/\]\((\/docs\/[^)#\s]*)/g)) {
        const alvo = m[1].endsWith('/') ? m[1] : `${m[1]}/`;
        expect(urls.has(alvo), `${p.arquivo} -> ${m[1]}`).toBe(true);
      }
    }
  });
});
