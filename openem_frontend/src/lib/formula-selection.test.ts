import { describe, expect, it } from 'vitest';
import type { Formula } from '../api';
import {
  groupBySubject,
  selectedFormulas,
  subjectState,
  toggleSubject,
  topicKey,
} from './formula-selection';

const f = (id: string, over: Partial<Formula> = {}): Formula => ({
  id,
  title: id,
  latex: 'x',
  description: null,
  subjectId: 'mat',
  subjectName: 'Matemática',
  topicId: 't1',
  topicName: 'Funções',
  isBuiltIn: true,
  favorited: false,
  symbols: [],
  ...over,
});

const LISTA = [
  f('a'),
  f('b', { topicId: 't2', topicName: 'Porcentagem', favorited: true }),
  f('c', { topicId: null, topicName: null }),
  f('d', { subjectId: 'fis', subjectName: 'Física', topicId: 't3', topicName: 'Cinemática' }),
];

describe('formula-selection', () => {
  it('agrupa por matéria e assunto, com assunto-fantasma para quem não tem', () => {
    const g = groupBySubject(LISTA);
    expect(g.map((s) => [s.name, s.total])).toEqual([
      ['Matemática', 3],
      ['Física', 1],
    ]);
    expect(g[0].topics.map((t) => t.name)).toEqual([
      'Funções',
      'Porcentagem',
      'Outras fórmulas',
    ]);
    expect(topicKey(LISTA[2])).toBe('sem-assunto:mat');
  });

  it('fórmulas do mesmo assunto ficam no mesmo grupo', () => {
    const g = groupBySubject([f('x'), f('y'), f('z', { topicId: 't2', topicName: 'Porcentagem' })]);
    expect(g[0].topics.map((t) => [t.name, t.formulas.map((x) => x.id)])).toEqual([
      ['Funções', ['x', 'y']],
      ['Porcentagem', ['z']],
    ]);
  });

  it('marcar a matéria liga todos os assuntos; de novo, desliga', () => {
    const [mat] = groupBySubject(LISTA);
    let sel = toggleSubject(mat, new Set());
    expect(subjectState(mat, sel)).toBe('all');
    sel = toggleSubject(mat, sel);
    expect(subjectState(mat, sel)).toBe('none');
  });

  it('matéria com parte dos assuntos fica "some" e o clique completa', () => {
    const [mat] = groupBySubject(LISTA);
    const parcial = new Set(['t1']);
    expect(subjectState(mat, parcial)).toBe('some');
    expect(subjectState(mat, toggleSubject(mat, parcial))).toBe('all');
  });

  it('seleção final: assuntos, depois favoritas, depois as tiradas à mão', () => {
    const todos = new Set(LISTA.map(topicKey));
    expect(selectedFormulas(LISTA, todos, false, new Set()).map((x) => x.id)).toEqual([
      'a', 'b', 'c', 'd',
    ]);
    expect(selectedFormulas(LISTA, todos, true, new Set()).map((x) => x.id)).toEqual(['b']);
    expect(selectedFormulas(LISTA, todos, false, new Set(['a', 'd'])).map((x) => x.id)).toEqual([
      'b', 'c',
    ]);
    expect(selectedFormulas(LISTA, new Set(['t3']), false, new Set()).map((x) => x.id)).toEqual([
      'd',
    ]);
  });
});
