// Testes das libs puras (issue #47): areas. O tema custom está em theme-custom.test.ts.
import { describe, it, expect } from 'vitest';
import {
  areaKey,
  shortArea,
  AREAS,
  AREA_DOT,
  AREA_TEXT,
} from './areas';

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
