import { describe, expect, it } from 'vitest';
import type { StudyResource } from '../api';
import {
  agrupar,
  dataCurta,
  filtrar,
  hostDe,
  linkSeguro,
  materiasComMaterial,
} from './onde-estudar';

function material(extra: Partial<StudyResource>): StudyResource {
  return {
    id: 'x',
    title: 'Material',
    url: 'https://pt.khanacademy.org/math',
    types: ['curso'],
    subjects: ['Matemática'],
    topics: [],
    description: 'Descrição do material.',
    language: 'pt',
    checkedAt: '2026-11-13',
    provider: { id: 'khan', name: 'Khan Academy', kind: 'sem-fins-lucrativos', about: '...' },
    ...extra,
  };
}

const provas = material({ id: 'provas', title: 'Provas do ENEM', subjects: [] });
const algebra = material({ id: 'algebra', title: 'Álgebra', topics: ['Função afim'] });
const fisica = material({ id: 'fisica', title: 'Física', subjects: ['Física'] });
const brasiliana = material({
  id: 'brasiliana',
  title: 'Brasiliana',
  subjects: ['Literatura', 'História'],
  provider: { id: 'usp', name: 'Biblioteca Brasiliana (USP)', kind: 'publico', about: '...' },
});
const todos = [provas, algebra, fisica, brasiliana];

describe('linkSeguro', () => {
  it('aceita só https sem credencial', () => {
    expect(linkSeguro('https://pt.khanacademy.org/math')).toBe('https://pt.khanacademy.org/math');
    expect(linkSeguro('http://pt.khanacademy.org/math')).toBeNull();
    expect(linkSeguro('javascript:alert(1)')).toBeNull();
    expect(linkSeguro('https://a@b.com/')).toBeNull();
    expect(linkSeguro('nada')).toBeNull();
  });
});

describe('hostDe e dataCurta', () => {
  it('mostra o host sem www e a data em dd/mm/aaaa', () => {
    expect(hostDe('https://www.gov.br/inep/x')).toBe('gov.br');
    expect(hostDe('https://pt.khanacademy.org/math')).toBe('pt.khanacademy.org');
    expect(dataCurta('2026-11-13')).toBe('13/11/2026');
  });
});

describe('materiasComMaterial', () => {
  it('segue a ordem das áreas, não a alfabética', () => {
    expect(materiasComMaterial(todos)).toEqual(['Matemática', 'Física', 'História', 'Literatura']);
  });
});

describe('filtrar', () => {
  it('busca sem acento e com todas as palavras', () => {
    expect(filtrar(todos, { termo: 'algebra', materia: '' }).map((r) => r.id)).toEqual(['algebra']);
    expect(filtrar(todos, { termo: 'funcao afim', materia: '' }).map((r) => r.id)).toEqual([
      'algebra',
    ]);
    expect(filtrar(todos, { termo: 'usp historia', materia: '' }).map((r) => r.id)).toEqual([
      'brasiliana',
    ]);
  });

  it('a matéria escolhida mantém o material de todas as matérias', () => {
    expect(filtrar(todos, { termo: '', materia: 'Física' }).map((r) => r.id)).toEqual([
      'provas',
      'fisica',
    ]);
  });
});

describe('agrupar', () => {
  it('"para todas" primeiro e material de duas matérias nas duas', () => {
    const grupos = agrupar(todos);
    expect(grupos.map((g) => g.materia)).toEqual([null, 'Matemática', 'Física', 'História', 'Literatura']);
    expect(grupos.find((g) => g.materia === 'História')?.recursos.map((r) => r.id)).toEqual([
      'brasiliana',
    ]);
  });

  it('com matéria escolhida, só o grupo dela', () => {
    expect(agrupar(filtrar(todos, { termo: '', materia: 'História' }), 'História').map((g) => g.materia)).toEqual([
      null,
      'História',
    ]);
  });
});
