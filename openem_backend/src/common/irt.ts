// Teoria de Resposta ao Item (TRI) — modelo logístico de 3 parâmetros (3PL).
// Ver docs/PRD.md §6 C1 (nota TRI dos simulados, Fase 2).
//
// A nota TRI só é calculada quando todas as questões respondidas estão
// calibradas (parâmetros a, b, c presentes). A habilidade θ é estimada por
// EAP (Expected A Posteriori) sobre uma grade, com prior normal padrão — método
// robusto a padrões todo-certo/todo-errado, sem divergência numérica.

export interface CalibratedItem {
  a: number; // discriminação
  b: number; // dificuldade
  c: number; // acerto ao acaso (0..1)
  correct: boolean; // resposta do estudante
}

/** Probabilidade de acerto no 3PL para uma habilidade θ. */
export function probability3PL(
  theta: number,
  a: number,
  b: number,
  c: number,
): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

/** Estima θ por EAP. Retorna null se não houver itens. */
export function estimateTheta(items: CalibratedItem[]): number | null {
  if (items.length === 0) return null;

  const MIN = -4;
  const MAX = 4;
  const STEP = 0.05;

  let weightedSum = 0;
  let norm = 0;
  for (let theta = MIN; theta <= MAX + 1e-9; theta += STEP) {
    const prior = Math.exp(-(theta * theta) / 2); // ∝ normal padrão
    let likelihood = 1;
    for (const item of items) {
      const p = probability3PL(theta, item.a, item.b, item.c);
      likelihood *= item.correct ? p : 1 - p;
    }
    const w = prior * likelihood;
    weightedSum += theta * w;
    norm += w;
  }

  if (norm === 0) return null;
  return weightedSum / norm;
}

/** Converte θ para a escala do ENEM (média 500, desvio 100), limitada a 0..1000. */
export function thetaToEnemScore(theta: number): number {
  const score = 500 + 100 * theta;
  return Math.round(Math.max(0, Math.min(1000, score)));
}

/**
 * Nota TRI de um conjunto de respostas calibradas, ou null se a lista estiver
 * vazia (caller deve garantir que todos os itens estão calibrados).
 */
export function triScoreFromItems(items: CalibratedItem[]): number | null {
  const theta = estimateTheta(items);
  return theta === null ? null : thetaToEnemScore(theta);
}
