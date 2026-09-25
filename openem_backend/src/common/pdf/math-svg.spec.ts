import { normalizeLatex, texToSvg } from './math-svg';

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
});
