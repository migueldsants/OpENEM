// SM-2 simplificado para a revisão inteligente (ver docs/PRD.md §6 D2).

export interface ReviewState {
  easeFactor: number;
  intervalD: number;
  repetition: number;
}

export interface NextReview extends ReviewState {
  dueAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcula o próximo agendamento de revisão.
 * @param state estado atual (fator de facilidade, intervalo em dias, repetições)
 * @param quality qualidade da lembrança, 0..5 (>=3 = acerto)
 */
export function computeNextReview(
  state: ReviewState,
  quality: number,
  now: Date = new Date(),
): NextReview {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easeFactor, intervalD, repetition } = state;

  if (q < 3) {
    // Errou: reinicia o ciclo, revisa no dia seguinte.
    repetition = 0;
    intervalD = 1;
  } else {
    repetition += 1;
    if (repetition === 1) {
      intervalD = 1;
    } else if (repetition === 2) {
      intervalD = 6;
    } else {
      intervalD = Math.round(intervalD * easeFactor);
    }
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  return {
    easeFactor,
    intervalD,
    repetition,
    dueAt: new Date(now.getTime() + intervalD * DAY_MS),
  };
}

/** Converte acerto/erro em uma nota de qualidade para o SM-2. */
export function qualityFromCorrectness(isCorrect: boolean): number {
  return isCorrect ? 5 : 2;
}
