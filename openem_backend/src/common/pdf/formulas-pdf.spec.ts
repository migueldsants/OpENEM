import {
  FormulaPdfItem,
  formulasPdfBuffer,
  groupFormulas,
  rows,
  SVG_TO_PDF_OPTIONS,
} from './formulas-pdf';

describe('SVG_TO_PDF_OPTIONS', () => {
  it('toda imagem do SVG vira um pixel embutido, nunca um caminho', () => {
    for (const link of ['figura.png', '/qualquer/lugar.jpg', 'https://x/y']) {
      expect(SVG_TO_PDF_OPTIONS.imageCallback()).toMatch(
        /^data:image\/png;base64,/,
      );
      expect(SVG_TO_PDF_OPTIONS.imageCallback()).not.toContain(link);
    }
  });
});

const item = (over: Partial<FormulaPdfItem> = {}): FormulaPdfItem => ({
  title: 'Bhaskara',
  latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  description: 'Raízes de ax² + bx + c = 0. Δ > 0: duas raízes.',
  subjectName: 'Matemática',
  topicName: 'Equações do 2º grau',
  symbols: [
    { symbol: 'x', meaning: 'raízes da equação', unit: null },
    { symbol: '\\Delta', meaning: 'discriminante', unit: null },
  ],
  ...over,
});

/** Quantas páginas o PDF tem (conta os objetos /Type /Page). */
const paginas = (buf: Buffer) =>
  (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('groupFormulas', () => {
  it('agrupa por matéria e assunto mantendo a ordem de chegada', () => {
    const g = groupFormulas([
      item({ title: 'A' }),
      item({ title: 'B', topicName: 'Porcentagem' }),
      item({ title: 'C', subjectName: 'Física', topicName: 'Cinemática' }),
      item({ title: 'D' }),
      item({ title: 'E', topicName: null }),
    ]);
    expect(g.map((x) => [x.subject, x.count])).toEqual([
      ['Matemática', 4],
      ['Física', 1],
    ]);
    expect(g[0].topics.map((t) => [t.name, t.items.length])).toEqual([
      ['Equações do 2º grau', 2],
      ['Porcentagem', 1],
      ['Outras fórmulas', 1],
    ]);
  });
});

describe('rows', () => {
  it('monta a grade em linhas de duas, a última pode ficar com uma', () => {
    expect(rows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(rows([1, 2], 1)).toEqual([[1], [2]]);
    expect(rows([], 2)).toEqual([]);
  });
});

describe('formulasPdfBuffer', () => {
  jest.setTimeout(30_000);

  it('gera um PDF com capa, sumário e as fórmulas', async () => {
    const buf = await formulasPdfBuffer(
      [
        item(),
        item({ title: 'Solução', latex: 'C = \\frac{m}{V_{\\text{solução}}}' }),
        item({
          title: 'MRU',
          subjectName: 'Física',
          topicName: 'Cinemática',
          latex: 's = s_0 + vt',
        }),
      ],
      { title: 'Minhas fórmulas', now: new Date(2026, 8, 25) },
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // Capa + sumário + ao menos uma página de conteúdo.
    expect(paginas(buf)).toBeGreaterThanOrEqual(3);
  });

  it('sem capa e sem sumário sai só o conteúdo', async () => {
    const buf = await formulasPdfBuffer([item()], {
      title: 'X',
      cover: false,
      toc: false,
      legend: false,
      descriptions: false,
      twoColumns: false,
    });
    expect(paginas(buf)).toBe(1);
  });

  it('muitas fórmulas quebram página sem travar', async () => {
    const muitas = Array.from({ length: 40 }, (_, i) =>
      item({ title: `F${i}`, topicName: `Assunto ${i % 7}` }),
    );
    const buf = await formulasPdfBuffer(muitas, {
      title: 'Muitas',
      cover: false,
      toc: false,
    });
    expect(paginas(buf)).toBeGreaterThan(3);
  });
});
