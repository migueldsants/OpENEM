/**
 * "Quanto você sabe" (discussão #122): domínio de cada assunto a partir das
 * respostas do aluno, e a média ponderada pelo quanto o assunto cai. Lógica
 * pura; quem lê as respostas é `src/performance/topic-answers.ts`.
 *
 * A regra cabe numa frase, para a tela poder explicá-la: domínio é o acerto
 * nas últimas 10 respostas do assunto; com menos de 3 respostas ele ainda não
 * foi visto e vale zero.
 */

/** Quantas respostas recentes contam no domínio. */
export const MASTERY_RECENT = 10;
/** Abaixo disso o assunto é "não visto" e vale zero. */
export const MASTERY_MIN_ANSWERS = 3;
/** Para "dominado": volume mínimo e acerto mínimo nas recentes. */
export const MASTERED_MIN_ANSWERS = 5;
export const MASTERED_ACCURACY = 0.7;
/** Respostas com assunto a partir das quais a tela mostra a porcentagem geral. */
export const OVERALL_MIN_ANSWERS = 30;

export type MasteryState = 'nao-visto' | 'praticando' | 'dominado';

export interface TopicAnswers {
  total: number;
  correct: number;
  /** As respostas mais novas primeiro, no máximo `MASTERY_RECENT`. */
  recent: boolean[];
}

export interface TopicMastery {
  state: MasteryState;
  /** 0..1; zero enquanto o assunto não foi visto. */
  mastery: number;
  answered: number;
  /** Acerto nas recentes, 0..100; null sem resposta. */
  accuracy: number | null;
}

export interface AnswerForMastery {
  topicId: string | null;
  isCorrect: boolean;
}

/**
 * Junta as respostas por assunto. Espera as respostas da mais nova para a
 * mais antiga, para `recent` guardar só as últimas. Resposta sem assunto fica
 * de fora (não tem onde cair).
 */
export function foldTopicAnswers(
  answers: Iterable<AnswerForMastery>,
): Map<string, TopicAnswers> {
  const out = new Map<string, TopicAnswers>();
  for (const a of answers) {
    if (!a.topicId) continue;
    const t = out.get(a.topicId) ?? { total: 0, correct: 0, recent: [] };
    t.total += 1;
    if (a.isCorrect) t.correct += 1;
    if (t.recent.length < MASTERY_RECENT) t.recent.push(a.isCorrect);
    out.set(a.topicId, t);
  }
  return out;
}

export function topicMastery(a: TopicAnswers | undefined): TopicMastery {
  if (!a || a.total === 0 || a.recent.length === 0) {
    return { state: 'nao-visto', mastery: 0, answered: 0, accuracy: null };
  }
  const recentAccuracy =
    a.recent.filter(Boolean).length / Math.min(a.recent.length, MASTERY_RECENT);
  const accuracy = Math.round(recentAccuracy * 100);
  if (a.total < MASTERY_MIN_ANSWERS) {
    return { state: 'nao-visto', mastery: 0, answered: a.total, accuracy };
  }
  const state: MasteryState =
    a.total >= MASTERED_MIN_ANSWERS && recentAccuracy >= MASTERED_ACCURACY
      ? 'dominado'
      : 'praticando';
  return { state, mastery: recentAccuracy, answered: a.total, accuracy };
}

/**
 * Média do domínio ponderada pelo peso (questões por prova). Sem peso nenhum
 * (banco sem provas regulares, como o de demonstração), cai na média simples
 * para a tela continuar dizendo alguma coisa.
 */
export function weightedMastery(
  items: readonly { weight: number; mastery: number }[],
): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (totalWeight === 0) {
    return items.reduce((s, i) => s + i.mastery, 0) / items.length;
  }
  return (
    items.reduce((s, i) => s + Math.max(0, i.weight) * i.mastery, 0) /
    totalWeight
  );
}

export function toPercent(x: number): number {
  return Math.round(Math.min(1, Math.max(0, x)) * 100);
}
