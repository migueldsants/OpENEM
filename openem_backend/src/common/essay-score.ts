// Rubrica de correção de redação do ENEM (ver docs/PRD.md §6 F1).
// São 5 competências, cada uma pontuada em múltiplos de 40 no intervalo 0..200;
// a nota final é a soma das competências (0..1000).

export const COMPETENCY_VALUES = [0, 40, 80, 120, 160, 200] as const;
export const COMPETENCY_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;

export type CompetencyKey = (typeof COMPETENCY_KEYS)[number];
export type CompetencyScores = Record<CompetencyKey, number>;

/** Verifica se um valor é uma nota válida de competência (0,40,…,200). */
export function isValidCompetencyScore(value: number): boolean {
  return (COMPETENCY_VALUES as readonly number[]).includes(value);
}

/** Soma as cinco competências (0..1000). Assume valores já validados. */
export function totalEssayScore(scores: CompetencyScores): number {
  return COMPETENCY_KEYS.reduce((sum, key) => sum + scores[key], 0);
}
