// Testes das libs puras (issue #47): areas e tema custom.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  areaKey,
  shortArea,
  AREAS,
  AREA_DOT,
  AREA_TEXT,
} from './areas';
import {
  normalizeColor,
  loadCustom,
  saveCustom,
  clearStoredCustom,
  validateCustomJson,
  applyCustomTheme,
  clearCustomInlineStyles,
  STORAGE_KEY,
} from '../theme-custom';

describe('lib/areas', () => {
  it('mapeia matérias canônicas para áreas', () => {
    expect(areaKey('Matemática')).toBe('mat');
    expect(areaKey('Biologia')).toBe('nat');
    expect(areaKey('Física')).toBe('nat');
    expect(areaKey('Química')).toBe('nat');
    expect(areaKey('História')).toBe('hum');
    expect(areaKey('Geografia')).toBe('hum');
    expect(areaKey('Filosofia')).toBe('hum');
    expect(areaKey('Sociologia')).toBe('hum');
    expect(areaKey('Língua Portuguesa')).toBe('lin');
    expect(areaKey('Literatura')).toBe('lin');
    expect(areaKey('Redação')).toBe('lin');
  });

  it('normaliza nomes longos ("... e suas Tecnologias") via fallback', () => {
    expect(areaKey('Matemática e suas Tecnologias')).toBe('mat');
    expect(areaKey('Ciências da Natureza e suas Tecnologias')).toBe('nat');
    expect(areaKey('Ciências Humanas e suas Tecnologias')).toBe('hum');
    expect(areaKey('Linguagens, Códigos e suas Tecnologias')).toBe('lin');
  });

  it('retorna default para desconhecidos/vazios', () => {
    expect(areaKey('')).toBe('default');
    expect(areaKey(undefined)).toBe('default');
    expect(areaKey('Matéria do futuro')).toBe('default');
  });

  it('shortArea devolve o rótulo curto', () => {
    expect(shortArea('Matemática')).toBe('Matemática');
    expect(shortArea('Biologia')).toBe('Natureza');
    expect(shortArea('História')).toBe('Humanas');
    expect(shortArea('X')).toBe('Geral'); // default não está em AREAS
  });

  it('AREAS não expõe Redação como área própria', () => {
    expect(AREAS.map((a) => a.key)).not.toContain('red');
    expect(AREA_DOT).toHaveProperty('red');
    expect(AREA_TEXT).toHaveProperty('red');
  });
});

describe('theme-custom', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
  });

  it('normalizeColor aceita apenas #rrggbb', () => {
    expect(normalizeColor('#AABBCC')).toBe('#AABBCC');
    expect(normalizeColor('#abc')).toBe('#000000');
    expect(normalizeColor('red')).toBe('#000000');
    expect(normalizeColor('  #FFAA00 ')).toBe('#FFAA00');
  });

  it('save/load/clear de tema custom', () => {
    expect(loadCustom()).toBeNull();
    saveCustom({ brand: '#123456' });
    expect(loadCustom()).toEqual({ brand: '#123456' });
    clearStoredCustom();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadCustom()).toBeNull();
  });

  it('loadCustom tolera JSON corrompido', () => {
    localStorage.setItem(STORAGE_KEY, '{nao-json');
    expect(loadCustom()).toBeNull();
  });

  it('validateCustomJson mantém só tokens válidos e rejeita vazio', () => {
    expect(
      validateCustomJson('{"brand":"#111111","desconhecido":"#fff","bg":42}'),
    ).toEqual({ brand: '#111111' });
    expect(() => validateCustomJson('{"x":"y"}')).toThrow('Nenhum token válido');
    expect(() => validateCustomJson('não é json')).toThrow();
  });

  it('applyCustomTheme aplica e clearCustomInlineStyles remove', () => {
    applyCustomTheme({ brand: '#ABCDEF', unknown: '#000' });
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe(
      '#ABCDEF',
    );
    clearCustomInlineStyles();
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe('');
  });
});