/** Resposta como o cliente entrega no finish() de um simulado. */
export interface SubmittedAnswer {
  questionId: string;
  chosenId?: string;
  timeSpentSec?: number;
}

/**
 * Respostas que entram na correção de um simulado.
 *
 * A mesma questão entregue mais de uma vez conta uma vez só, com a última
 * resposta. Quando o simulado tem a lista de questões gravada
 * (SimulationQuestion), a correção cobre exatamente essa lista, na ordem da
 * prova: questão de fora é descartada e questão não entregue conta como em
 * branco. Aceitar questão de fora permitia entregar centenas de acertos, já
 * que o gabarito é público. Simulados anteriores à lista não a têm e seguem
 * corrigidos pelo que foi entregue.
 */
export function answersToGrade(
  submitted: SubmittedAnswer[],
  simulationQuestionIds: string[],
): SubmittedAnswer[] {
  const latest = new Map<string, SubmittedAnswer>();
  for (const answer of submitted) latest.set(answer.questionId, answer);
  if (simulationQuestionIds.length === 0) return [...latest.values()];
  return simulationQuestionIds.map(
    (questionId) => latest.get(questionId) ?? { questionId },
  );
}
