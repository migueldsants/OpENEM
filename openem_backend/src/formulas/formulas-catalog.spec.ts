import {
  FORMULA_SYMBOLS,
  FORMULA_TOPICS,
  FORMULAS,
} from '../../prisma/seed-formulas-lib';
import { TAXONOMY } from '../common/taxonomy';
import { MAX_FORMULAS_PER_PDF } from './formulas.service';

/** Assuntos de cada matéria, achatando as áreas da taxonomia. */
const assuntosDa = new Map<string, Set<string>>();
for (const materias of Object.values(TAXONOMY)) {
  for (const [materia, assuntos] of Object.entries(materias)) {
    const set = assuntosDa.get(materia) ?? new Set<string>();
    for (const [nome] of assuntos) set.add(nome);
    assuntosDa.set(materia, set);
  }
}

describe('catálogo de fórmulas', () => {
  const titulos = FORMULAS.map((f) => f.title);

  it('não repete título', () => {
    const repetidos = titulos.filter((t, i) => titulos.indexOf(t) !== i);
    expect(repetidos).toEqual([]);
  });

  it('formerTitle não colide com o título de outra fórmula', () => {
    const colisoes = FORMULAS.filter(
      (f) => f.formerTitle && titulos.includes(f.formerTitle),
    ).map((f) => f.title);
    expect(colisoes).toEqual([]);
  });

  it('toda matéria existe na taxonomia', () => {
    const faltando = FORMULAS.filter((f) => !assuntosDa.has(f.subject)).map(
      (f) => `${f.title}: ${f.subject}`,
    );
    expect(faltando).toEqual([]);
  });

  it('toda fórmula tem um assunto que existe na matéria dela', () => {
    // O seed ignora em silêncio o assunto que não existe: a fórmula ficaria
    // fora do agrupamento da tela.
    const errados = FORMULAS.filter(
      (f) => !assuntosDa.get(f.subject)?.has(FORMULA_TOPICS[f.title]),
    ).map((f) => `${f.title}: ${FORMULA_TOPICS[f.title]}`);
    expect(errados).toEqual([]);
  });

  it('toda fórmula tem legenda (menos o atalho de Redação)', () => {
    const semLegenda = FORMULAS.filter(
      (f) => f.subject !== 'Redação' && !FORMULA_SYMBOLS[f.title]?.length,
    ).map((f) => f.title);
    expect(semLegenda).toEqual([]);
  });

  it('legenda e assunto não apontam para fórmula que não existe', () => {
    const soltos = [
      ...Object.keys(FORMULA_SYMBOLS),
      ...Object.keys(FORMULA_TOPICS),
    ].filter((t) => !titulos.includes(t));
    expect(soltos).toEqual([]);
  });

  it('o catálogo inteiro cabe num caderno em PDF', () => {
    expect(FORMULAS.length).toBeLessThanOrEqual(MAX_FORMULAS_PER_PDF);
  });
});
