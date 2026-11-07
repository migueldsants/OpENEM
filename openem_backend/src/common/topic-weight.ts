/**
 * Peso Pareto do assunto (`Topic.weight`, 1..5) derivado da incidência
 * (discussão #122). O peso alimenta o sorteio Pareto dos simulados, as
 * prioridades do Desempenho e o mapa de calor; antes era curado à mão e
 * divergia do banco (Estatística tinha 5 e cai 0,4 por prova).
 *
 * Os cortes são os mesmos para todas as matérias, porque as prioridades do
 * Desempenho comparam assuntos de matérias diferentes.
 */

/** [mínimo de questões por prova, peso], do maior para o menor. */
export const WEIGHT_CUTS: readonly (readonly [number, number])[] = [
  [3, 5],
  [1.5, 4],
  [0.8, 3],
  [0.3, 2],
];

/**
 * Com menos provas regulares que isso a média não diz nada (banco de
 * demonstração, e2e): o peso curado do seed fica.
 */
export const MIN_EXAMS_FOR_WEIGHTS = 5;

export function weightFromPerExam(perExam: number): number {
  for (const [min, weight] of WEIGHT_CUTS) {
    if (perExam >= min) return weight;
  }
  return 1;
}

/**
 * Peso de cada assunto; null quando a janela é curta demais para mexer.
 * Assunto que não caiu na janela fica com peso 1 e continua na taxonomia:
 * o que não caiu em 10 anos ainda pode cair.
 */
export function deriveWeights(
  exams: number,
  topicIds: readonly string[],
  incidence: Readonly<Record<string, { perExam: number } | undefined>>,
): Map<string, number> | null {
  if (exams < MIN_EXAMS_FOR_WEIGHTS) return null;
  return new Map(
    topicIds.map((id) => [id, weightFromPerExam(incidence[id]?.perExam ?? 0)]),
  );
}
