import { FORMULA_SYMBOLS, FORMULAS } from '../../../prisma/seed-formulas-lib';
import { normalizeLatex, semImagens, TEX_PACKAGES, texToSvg } from './math-svg';

describe('semImagens', () => {
  it('tira <image> em todas as formas, e só ele', () => {
    const svg =
      '<svg><path d="M0 0"/><image href="a.png"/>' +
      '<g><image xlink:href="b.png" width="1"></image></g>' +
      '<IMAGE href="c.png"><text>x</text></svg>';
    const limpo = semImagens(svg);
    expect(limpo).not.toMatch(/image/i);
    expect(limpo).toContain('<path d="M0 0"/>');
    expect(limpo).toContain('<g></g>');
    expect(limpo).toContain('<text>x</text>');
  });

  it('SVG sem imagem passa igual', () => {
    const svg = '<svg><path d="M1 2"/></svg>';
    expect(semImagens(svg)).toBe(svg);
  });
});

describe('TEX_PACKAGES', () => {
  it('não liga os pacotes que montam HTML, macros ou ações', () => {
    for (const p of [
      'html',
      'newcommand',
      'configmacros',
      'action',
      'unicode',
    ]) {
      expect(TEX_PACKAGES).not.toContain(p);
    }
  });

  it('todo o catálogo de fórmulas compila com esses pacotes', () => {
    const latex = [
      ...FORMULAS.map((f) => f.latex),
      ...Object.values(FORMULA_SYMBOLS).flatMap((s) => s.map((x) => x.symbol)),
    ];
    expect(latex.length).toBeGreaterThan(60);
    const quebradas = latex.filter((l) => texToSvg(l).error);
    expect(quebradas).toEqual([]);
  });
});

describe('normalizeLatex', () => {
  it('acento de modo texto usado em modo matemático vira a letra certa', () => {
    // \c{c}\c{a}o era como o catálogo antigo escrevia "ção".
    expect(normalizeLatex('m_{solu\\c{c}\\c{a}o}')).not.toMatch(/\\c\{/);
    expect(normalizeLatex('favor\\acute{a}veis')).not.toMatch(/\\acute/);
  });

  it('letra acentuada dentro de \\text vira acento do TeX', () => {
    expect(normalizeLatex('\\text{conclusão}')).toBe('\\text{conclus\\~ao}');
    expect(normalizeLatex('\\text{possíveis}')).toBe("\\text{poss\\'iveis}");
  });

  it('cedilha sai do \\text e é montada com glifos do MathJax', () => {
    const out = normalizeLatex('V_{\\text{solução}}');
    expect(out).toContain('\\text{solu}');
    expect(out).toContain('\\underset');
    expect(out).toContain('\\text{\\~ao}');
    // Sem \text{} vazio sobrando no fim.
    expect(out).not.toContain('\\text{}');
  });

  it('fora de \\text, letra acentuada ganha um \\text', () => {
    expect(normalizeLatex('é')).toBe("\\text{\\'e}");
  });

  it('LaTeX sem acento passa igual', () => {
    const l = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
    expect(normalizeLatex(l)).toBe(l);
  });
});

describe('texToSvg', () => {
  it('devolve SVG com medidas e sem erro para LaTeX válido', () => {
    const m = texToSvg('\\frac{a}{b}');
    expect(m.svg).toMatch(/^<svg/);
    expect(m.error).toBe(false);
    expect(m.widthEx).toBeGreaterThan(0);
    expect(m.heightEx).toBeGreaterThan(0);
    // Fração desce abaixo da linha de base.
    expect(m.depthEx).toBeGreaterThan(0);
  });

  it('palavras com acento e cedilha compilam sem erro', () => {
    for (const l of [
      'C = \\frac{m_{\\text{soluto}}}{V_{\\text{solução}}}',
      '\\text{introdução} \\to \\text{conclusão}',
      'P(A) = \\frac{\\text{favoráveis}}{\\text{possíveis}}',
    ]) {
      expect(texToSvg(l).error).toBe(false);
    }
  });

  it('marca erro quando o LaTeX não compila', () => {
    expect(texToSvg('\\comandoquenaoexiste{x}').error).toBe(true);
  });

  it('entrada que derruba o MathJax vira "?" com erro, sem exceção', () => {
    // Caractere de controle (form feed) fazia o MathJax lançar TypeError.
    const m = texToSvg('a+\f rac{1}{2}');
    expect(m.error).toBe(true);
    expect(m.svg).toMatch(/^<svg/);
    // O conversor continua inteiro para a próxima fórmula.
    expect(texToSvg('\\frac{a}{b}').error).toBe(false);
  });

  it('fórmulas de química e de símbolos comuns compilam', () => {
    for (const l of [
      '\\ce{H2O}',
      '\\cancel{x}',
      '\\boldsymbol{v}',
      '\\upmu',
      '\\degree',
    ]) {
      expect(texToSvg(l).error).toBe(false);
    }
  });
});
