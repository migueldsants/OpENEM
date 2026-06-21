// Motor de recomendação (Fase 3): prioriza os assuntos onde o estudante mais
// erra para sugerir questões semelhantes às que errou. Lógica pura e testável;
// o serviço apenas alimenta as estatísticas e busca as questões.

export interface TopicStat {
  topicId: string;
  attempts: number;
  correct: number;
}

export interface RankedTopic {
  topicId: string;
  accuracy: number; // 0..1
  attempts: number;
  /** Quanto menor a precisão (com peso por volume), maior a prioridade. */
  priority: number;
}

/**
 * Ordena os assuntos por necessidade de reforço: menor precisão primeiro,
 * dando um empurrão a quem já tem volume de tentativas (sinal mais confiável).
 * Assuntos sem tentativas são ignorados (o serviço cuida da cobertura nova).
 */
export function rankTopicsForReinforcement(stats: TopicStat[]): RankedTopic[] {
  return stats
    .filter((s) => s.attempts > 0)
    .map((s) => {
      const accuracy = s.correct / s.attempts;
      // Prioridade: erro (1 - acc) ponderado por um fator de confiança que
      // cresce e satura com o número de tentativas.
      const confidence = s.attempts / (s.attempts + 3);
      return {
        topicId: s.topicId,
        accuracy,
        attempts: s.attempts,
        priority: (1 - accuracy) * confidence,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.attempts - a.attempts);
}

/** Mensagem curta de porquê a questão foi recomendada. */
export function reinforcementReason(accuracy: number): string {
  const pct = Math.round(accuracy * 100);
  if (pct === 0) return 'Você ainda não acertou questões deste assunto';
  return `Você acertou ${pct}% neste assunto`;
}
