import { beforeEach, describe, expect, it } from 'vitest';
import { luminance } from './lib/color';
import { paletteFromBrand, TOKEN_KEYS } from './lib/theme-derive';
import {
  applyCustomTheme,
  clearCustomInlineStyles,
  clearStoredCustom,
  customScheme,
  DEFAULT_NAME,
  exportCustomJson,
  fromOneSide,
  loadCustom,
  normalizeColor,
  parseCustom,
  sanitizeTokens,
  saveCustom,
  STORAGE_KEY,
  tokensStyle,
  validateCustomJson,
} from './theme-custom';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.cssText = '';
});

describe('normalizeColor', () => {
  it('aceita apenas #rrggbb', () => {
    expect(normalizeColor('#AABBCC')).toBe('#AABBCC');
    expect(normalizeColor('#abc')).toBe('#000000');
    expect(normalizeColor('red')).toBe('#000000');
    expect(normalizeColor('  #FFAA00 ')).toBe('#FFAA00');
  });
});

describe('sanitizeTokens', () => {
  it('mantém só chaves conhecidas com #rrggbb (minúsculo)', () => {
    expect(
      sanitizeTokens({
        brand: '#ABCDEF',
        bg: 'url(https://x.example/p.png)',
        fg: 'var(--x)',
        muted: 42,
        inventado: '#000000',
      }),
    ).toEqual({ brand: '#abcdef' });
    expect(sanitizeTokens(null)).toEqual({});
    expect(sanitizeTokens('x')).toEqual({});
  });
});

describe('parseCustom', () => {
  it('lê o formato v2 completo', () => {
    const light = paletteFromBrand('#2563eb', 'light');
    const dark = paletteFromBrand('#2563eb', 'dark');
    expect(parseCustom({ v: 2, id: 'abc', name: ' Azul ', light, dark })).toEqual({
      v: 2,
      id: 'abc',
      name: 'Azul',
      light,
      dark,
    });
  });

  it('deriva o lado que falta', () => {
    const light = paletteFromBrand('#2563eb', 'light');
    const t = parseCustom({ light })!;
    expect(t.name).toBe(DEFAULT_NAME);
    expect(t.light).toEqual(light);
    expect(Object.keys(t.dark).sort()).toEqual([...TOKEN_KEYS].sort());
    expect(luminance(t.dark.bg)).toBeLessThan(0.05);

    const soEscuro = parseCustom({ dark: { brand: '#ff2ec4' } })!;
    expect(luminance(soEscuro.light.bg)).toBeGreaterThan(0.7);
  });

  it('converte o formato antigo (um lado só) mantendo as cores dele', () => {
    const antigo = { bg: '#101418', brand: '#ff0066', fg: '#eeeeee' };
    const t = parseCustom(antigo)!;
    expect(customScheme(antigo)).toBe('dark');
    expect(t.dark.bg).toBe('#101418');
    expect(t.dark.brand).toBe('#ff0066');
    expect(Object.keys(t.dark).sort()).toEqual([...TOKEN_KEYS].sort());
    expect(luminance(t.light.bg)).toBeGreaterThan(0.7);
  });

  it('corta o nome em 40 caracteres e ignora id vazio', () => {
    const t = parseCustom({ name: 'x'.repeat(60), id: '', light: { brand: '#123456' } })!;
    expect(t.name).toHaveLength(40);
    expect(t).not.toHaveProperty('id');
  });

  it('devolve null sem nenhuma cor válida', () => {
    expect(parseCustom(null)).toBeNull();
    expect(parseCustom({ x: 'y' })).toBeNull();
    expect(parseCustom({ light: { bg: 'red' }, dark: {} })).toBeNull();
  });
});

describe('save/load/clear', () => {
  it('guarda e lê o v2', () => {
    expect(loadCustom()).toBeNull();
    const t = fromOneSide({ brand: '#123456' }, 'light', 'Teste');
    saveCustom(t);
    expect(loadCustom()).toEqual(t);
    clearStoredCustom();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadCustom()).toBeNull();
  });

  it('migra o antigo ao ler e tolera JSON corrompido', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bg: '#fafafa', brand: '#d91748' }));
    expect(loadCustom()?.light.bg).toBe('#fafafa');
    localStorage.setItem(STORAGE_KEY, '{nao-json');
    expect(loadCustom()).toBeNull();
  });
});

describe('fromOneSide', () => {
  it('usa o lado dado e deriva o outro', () => {
    const light = paletteFromBrand('#00707a', 'light');
    const t = fromOneSide(light, 'light', 'Mar');
    expect(t).toMatchObject({ v: 2, name: 'Mar', light });
    expect(t.dark).not.toEqual(light);
    expect(luminance(t.dark.bg)).toBeLessThan(0.05);
  });
});

describe('validateCustomJson / exportCustomJson', () => {
  it('aceita antigo e v2, rejeita lixo', () => {
    expect(validateCustomJson('{"brand":"#111111","desconhecido":"#fff"}').light.brand).toBe(
      '#111111',
    );
    expect(() => validateCustomJson('{"x":"y"}')).toThrow('Nenhum token válido');
    expect(() => validateCustomJson('não é json')).toThrow('JSON inválido');
    expect(() => validateCustomJson('42')).toThrow('JSON inválido');
  });

  it('exporta sem o id do servidor e reimporta igual', () => {
    const t = { ...fromOneSide({ brand: '#abcdef' }, 'dark', 'Gelo'), id: 'srv1' };
    const json = exportCustomJson(t);
    expect(json).not.toContain('srv1');
    const { id: _id, ...semId } = t;
    expect(validateCustomJson(json)).toEqual(semId);
  });
});

describe('aplicação no DOM', () => {
  it('applyCustomTheme aplica só hex e clearCustomInlineStyles remove', () => {
    applyCustomTheme({ brand: '#ABCDEF', bg: 'url(x)', unknown: '#000000' });
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--brand')).toBe('#abcdef');
    expect(style.getPropertyValue('--bg')).toBe('');
    expect(style.getPropertyValue('--unknown')).toBe('');
    clearCustomInlineStyles();
    expect(style.getPropertyValue('--brand')).toBe('');
  });

  it('tokensStyle vira variáveis CSS seguras para prévias', () => {
    expect(tokensStyle({ brand: '#ABCDEF', bg: 'url(x)' })).toEqual({ '--brand': '#abcdef' });
  });
});
