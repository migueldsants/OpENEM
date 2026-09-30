import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  fromOklch,
  isHex,
  luminance,
  parseHex,
  readableInk,
  toHex,
  toOklch,
} from './color';

describe('isHex / parseHex / toHex', () => {
  it('só aceita #rrggbb', () => {
    expect(isHex('#a1B2c3')).toBe(true);
    expect(isHex(' #a1b2c3 ')).toBe(true);
    for (const v of ['#abc', 'a1b2c3', '#a1b2c3ff', 'red', 'url(x)', 12, null]) {
      expect(isHex(v)).toBe(false);
    }
  });

  it('converte ida e volta', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHex('nada')).toBeNull();
    expect(toHex([255, 128, 0])).toBe('#ff8000');
    // Fora da faixa é cortado, e arredonda.
    expect(toHex([300, -4, 15.6])).toBe('#ff0010');
  });
});

describe('luminância e contraste (WCAG)', () => {
  it('extremos', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('invalido')).toBe(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('valores de referência', () => {
    // #767676 sobre branco é o cinza clássico de 4,54:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(luminance('#808080')).toBeCloseTo(0.2159, 3);
  });
});

describe('OKLCH', () => {
  it('ida e volta preserva a cor', () => {
    for (const hex of ['#d91748', '#00e5a0', '#15111c', '#f5f1f6', '#2563eb']) {
      expect(fromOklch(toOklch(hex))).toBe(hex);
    }
  });

  it('valores conhecidos', () => {
    const white = toOklch('#ffffff');
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeLessThan(1e-3);
    expect(white.h).toBe(0);
    const red = toOklch('#ff0000');
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.c).toBeCloseTo(0.258, 2);
    expect(red.h).toBeCloseTo(29.2, 0);
  });

  it('fora do gamut reduz o croma sem mudar a claridade', () => {
    const out = fromOklch({ l: 0.7, c: 0.4, h: 150 });
    expect(isHex(out)).toBe(true);
    expect(toOklch(out).l).toBeCloseTo(0.7, 2);
    expect(toOklch(out).c).toBeLessThan(0.4);
  });

  it('corta L fora de 0..1', () => {
    expect(fromOklch({ l: 1.4, c: 0, h: 0 })).toBe('#ffffff');
    expect(fromOklch({ l: -1, c: 0, h: 0 })).toBe('#000000');
  });
});

describe('ensureContrast', () => {
  it('não mexe no que já passa', () => {
    expect(ensureContrast('#000000', '#ffffff', 7)).toBe('#000000');
  });

  it('escurece sobre fundo claro e clareia sobre fundo escuro', () => {
    const onLight = ensureContrast('#aaaaaa', '#ffffff', 4.5);
    expect(contrastRatio(onLight, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(luminance(onLight)).toBeLessThan(luminance('#aaaaaa'));

    const onDark = ensureContrast('#444444', '#101010', 4.5);
    expect(contrastRatio(onDark, '#101010')).toBeGreaterThanOrEqual(4.5);
    expect(luminance(onDark)).toBeGreaterThan(luminance('#444444'));
  });

  it('vale contra todos os fundos da lista', () => {
    const fg = ensureContrast('#999999', ['#ffffff', '#eeeeee', '#dddddd'], 4.5);
    for (const bg of ['#ffffff', '#eeeeee', '#dddddd']) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('mantém o matiz ao ajustar', () => {
    const fg = ensureContrast('#ff6b8b', '#ffffff', 4.5);
    expect(Math.abs(toOklch(fg).h - toOklch('#ff6b8b').h)).toBeLessThan(6);
  });

  it('meta impossível devolve o extremo', () => {
    expect(ensureContrast('#808080', '#808080', 30)).toBe('#000000');
  });
});

describe('readableInk', () => {
  it('branco sobre cor escura, escuro sobre cor clara', () => {
    expect(readableInk('#1d4ed8')).toBe('#ffffff');
    const ink = readableInk('#ffd400');
    expect(ink).not.toBe('#ffffff');
    expect(contrastRatio(ink, '#ffd400')).toBeGreaterThanOrEqual(7);
  });
});
