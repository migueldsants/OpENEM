/** Intervalos fixos por nota (decisão de produto): Esqueci = imediato (hoje),
 *  Difícil = 1 dia, Bom = 3 dias, Fácil = 7 dias. Sem crescimento por repetição. */
const FIXED_INTERVAL_D: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 1,
  4: 3,
  5: 7,
};

export interface FlashcardQueueItem {
  flashcardId: string;
  front: string;
  back: string;
  deckTitle: string;
  deckIcon: string;
  deckTopic?: string;
  deckSubtheme?: string;
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
): FlashcardQueueItem[] {
  return [...items].sort((a, b) => {
    // 1. Vencidos à frente.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    // 2. Maior peso (Pareto) à frente.
    if (a.weight !== b.weight) return b.weight - a.weight;
    // 3. Mais antigo (venceu há mais tempo ou vence antes) à frente.
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
}

/**
 * Agenda a próxima revisão com os intervalos fixos por nota (FIXED_INTERVAL_D).
 * O easeFactor continua sendo atualizado no modelo SM-2 apenas como sinal de
 * dificuldade do card (dashboard/stats); ele NÃO influencia o intervalo.
 */
export function reviewFlashcard(
  item: Pick<FlashcardQueueItem, 'easeFactor' | 'intervalD' | 'repetition'>,
  quality: number,
  now: Date = new Date(),
) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const intervalD = FIXED_INTERVAL_D[q];
  const repetition = q >= 3 ? item.repetition + 1 : 0;
  // Ajuste de facilidade do SM-2 (só para telemetria — intervalo é fixo).
  const easeFactor = Math.max(
    1.3,
    item.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );
  return {
    easeFactor,
    intervalD,
    repetition,
    dueAt: new Date(now.getTime() + intervalD * DAY_MS),
  };
}

export { DAY_MS };
