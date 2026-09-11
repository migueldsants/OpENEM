import { describe, expect, it } from 'vitest';
import {
  areaSourceName,
  codeLabel,
  hasCalibratedDifficulty,
  normalizeCodeQuery,
  subjectLabel,
  topicLabel,
} from './question';

const TOPICO = {
  id: 't1',
  name: 'Funções',
  subject: { id: 's1', name: 'Matemática' },
};
const AREA = { id: 'a1', name: 'Matemática e suas Tecnologias' };
const PROVA = { year: 2023, slug: '2023', label: 'ENEM 2023' };

describe('rótulos da questão', () => {
  it('usa a matéria quando a questão já está classificada', () => {
    const q = { topic: TOPICO, subjectArea: AREA };
    expect(subjectLabel(q)).toBe('Matemática');
    expect(topicLabel(q)).toBe('Funções');
    expect(areaSourceName(q)).toBe('Matemática');
  });

  it('cai na área quando não há matéria — o caso do banco oficial', () => {
    const q = { topic: null, subjectArea: AREA, examYear: PROVA };
    // "e suas Tecnologias" só ocupa espaço no celular.
    expect(subjectLabel(q)).toBe('Matemática');
    expect(topicLabel(q)).toBeNull();
    expect(areaSourceName(q)).toBe('Matemática e suas Tecnologias');
  });

  it('não quebra sem matéria, área nem prova', () => {
    const q = { topic: null, subjectArea: null };
    expect(subjectLabel(q)).toBe('Sem matéria');
    expect(topicLabel(q)).toBeNull();
    expect(areaSourceName(q)).toBe('');
  });
});

describe('hasCalibratedDifficulty', () => {
  it('é falso nas questões oficiais, que entram todas no nível padrão', () => {
    expect(
      hasCalibratedDifficulty({ source: 'ENEM_DEV', difficulty: 3 }),
    ).toBe(false);
  });

  it('é verdadeiro nas questões autorais, que têm nível atribuído', () => {
    expect(hasCalibratedDifficulty({ source: 'AUTORAL', difficulty: 2 })).toBe(
      true,
    );
  });
});

describe('codeLabel', () => {
  it('prefere o código oficial e cai no nome da prova', () => {
    expect(codeLabel({ code: 'ENEM-2023-136', examYear: PROVA })).toBe(
      'ENEM-2023-136',
    );
    expect(codeLabel({ code: null, examYear: PROVA })).toBe('ENEM 2023');
    expect(codeLabel({ code: null, examYear: null })).toBeNull();
  });
});

describe('normalizeCodeQuery', () => {
  it.each([
    ['2023 136', 'ENEM-2023-136'],
    ['enem 2023 7', 'ENEM-2023-007'],
    ['ENEM-2023-001-ING', 'ENEM-2023-001-ING'],
    ['2023r', 'ENEM-2023R'],
  ])('%j vira %j', (entrada, esperado) => {
    expect(normalizeCodeQuery(entrada)).toBe(esperado);
  });
});
