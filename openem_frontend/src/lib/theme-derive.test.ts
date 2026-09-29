import { describe, expect, it } from 'vitest';
import { contrastRatio, isHex, luminance, toOklch } from './color';
import {
  contrastIssues,
  deriveVariant,
  MIN,
  paletteFromBrand,
  TOKEN_KEYS,
  type Tokens,
} from './theme-derive';

/** Mesmas regras da auditoria das paletas prontas (theme-palettes.test.ts). */
function expectReadable(t: Tokens) {
  for (const k of TOKEN_KEYS) expect(isHex(t[k]), k).toBe(true);
  for (const bg of ['bg', 'sidebar', 'surface', 'surface-2']) {
    expect(contrastRatio(t.fg, t[bg]), `fg/${bg}`).toBeGreaterThanOrEqual(MIN.text);
    expect(contrastRatio(t.muted, t[bg]), `muted/${bg}`).toBeGreaterThanOrEqual(MIN.muted);
  }
  for (const bg of ['bg', 'surface', 'surface-2']) {
    expect(contrastRatio(t.brand, t[bg]), `brand/${bg}`).toBeGreaterThanOrEqual(MIN.brand);
  }
  expect(contrastRatio(t['brand-ink'], t.brand)).toBeGreaterThanOrEqual(MIN.ink);
  expect(contrastIssues(t)).toEqual([]);
}

const BRANDS = ['#d91748', '#ffd400', '#00e5a0', '#1d4ed8', '#7c3aed', '#808080', '#ff2ec4'];

describe('paletteFromBrand', () => {
  it.each(BRANDS)('gera lados claro e escuro legíveis a partir de %s', (brand) => {
    const light = paletteFromBrand(brand, 'light');
    const dark = paletteFromBrand(brand, 'dark');
    expectReadable(light);
    expectReadable(dark);
    expect(luminance(light.bg)).toBeGreaterThan(0.7);
    expect(luminance(dark.bg)).toBeLessThan(0.05);
  });

  it('neutros herdam o matiz da marca', () => {
    const t = paletteFromBrand('#2563eb', 'light');
    const diff = Math.abs(toOklch(t.bg).h - toOklch('#2563eb').h);
    expect(Math.min(diff, 360 - diff)).toBeLessThan(15);
  });

  it('cor inválida cai na marca padrão', () => {
    expect(paletteFromBrand('url(x)', 'dark')).toEqual(paletteFromBrand('#d91748', 'dark'));
  });
});

describe('deriveVariant', () => {
  const light = paletteFromBrand('#0e7490', 'light');

  it('cria o lado escuro de um tema claro e vice-versa', () => {
    const dark = deriveVariant(light, 'dark');
    expectReadable(dark);
    expect(luminance(dark.bg)).toBeLessThan(0.05);
    const back = deriveVariant(dark, 'light');
    expectReadable(back);
    expect(luminance(back.bg)).toBeGreaterThan(0.7);
  });

  it('mantém o matiz da marca', () => {
    const dark = deriveVariant(light, 'dark');
    const diff = Math.abs(toOklch(dark.brand).h - toOklch(light.brand).h);
    expect(Math.min(diff, 360 - diff)).toBeLessThan(8);
  });

  it('conserta tema escolhido à mão com pouco contraste', () => {
    const ruim: Tokens = {
      bg: '#777777',
      sidebar: '#777777',
      surface: '#7a7a7a',
      'surface-2': '#808080',
      fg: '#8a8a8a',
      muted: '#888888',
      line: '#999999',
      brand: '#888800',
      'brand-2': '#999900',
      'brand-ink': '#8a8a00',
    };
    expectReadable(deriveVariant(ruim, 'light'));
    expectReadable(deriveVariant(ruim, 'dark'));
  });

  it('tolera tokens faltando', () => {
    expectReadable(deriveVariant({ brand: '#ff6a3d' }, 'dark'));
    expectReadable(deriveVariant({}, 'light'));
  });
});

describe('contrastIssues', () => {
  it('aponta os pares abaixo do mínimo com rótulo legível', () => {
    const t = { ...paletteFromBrand('#d91748', 'light'), muted: '#dddddd' };
    const issues = contrastIssues(t);
    expect(issues.map((i) => i.label)).toEqual([
      'Texto suave sobre Fundo',
      'Texto suave sobre Cartões',
    ]);
    expect(issues[0].min).toBe(4.5);
    expect(issues[0].ratio).toBeLessThan(4.5);
  });

  it('ignora tokens que não são hex', () => {
    expect(contrastIssues({ fg: 'red', bg: '#ffffff' })).toEqual([]);
  });

  it('cobre texto na marca e marca sobre cartões', () => {
    const t = {
      ...paletteFromBrand('#d91748', 'light'),
      brand: '#fafafa',
      'brand-ink': '#ffffff',
    };
    expect(contrastIssues(t).map((i) => i.label)).toEqual([
      'Texto na marca sobre Marca',
      'Marca sobre Cartões',
    ]);
  });
});
