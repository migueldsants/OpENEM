import { computeNextReview } from './spaced-repetition';

export interface FlashcardQueueItem {
  flashcardId: string;
  front: string;
  back: string;
  deckTitle: string;
  deckIcon: string;
  /** 5 = maior prioridade (Peso 5), 1 = menor. */
  weight: number;
  easeFactor: number;
  intervalD: number;
  repetition: number;
  dueAt: Date;
  /** true se já venceu (dueAt <= now). */
  overdue: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fila "Estudo Otimizado" (SM-2 + Pareto):
 *
 * 1. **Vencidos primeiro** (SM-2): qualquer flashcard cuja dueAt <= agora entra na fila,
 *    independente do peso — o esquecimento não espera.
 * 2. **Pesos (Pareto)** para desempate e para puxar não-vencidos: decks de tópicos
 *    Peso 5 vêm antes de Peso 4 etc. Quanto maior o peso, mais à frente.
 * 3. **Próximos a vencer** preenchem o restante, ordenados por (weight desc, dueAt asc).
 *
 * Ordenação final: overdue desc, weight desc, dueAt asc.
 */
export function buildStudyQueue(
  items: FlashcardQueueItem[],
  limit = 20,
): FlashcardQueueItem[] {
  return [...items]
    .sort((a, b) => {
      // 1. Vencidos à frente.
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      // 2. Maior peso (Pareto) à frente.
      if (a.weight !== b.weight) return b.weight - a.weight;
      // 3. Mais antigo (venceu há mais tempo ou vence antes) à frente.
      return a.dueAt.getTime() - b.dueAt.getTime();
    })
    .slice(0, limit);
}

/** Aplica SM-2 a um flashcard da fila e devolve o novo estado. */
export function reviewFlashcard(
  item: Pick<FlashcardQueueItem, 'easeFactor' | 'intervalD' | 'repetition'>,
  quality: number,
  now: Date = new Date(),
) {
  return computeNextReview(
    {
      easeFactor: item.easeFactor,
      intervalD: item.intervalD,
      repetition: item.repetition,
    },
    quality,
    now,
  );
}

export { DAY_MS };
