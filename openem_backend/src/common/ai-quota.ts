/**
 * Cota das chamadas pagas à IA.
 *
 * O rate limit por IP não segura custo: cadastro é livre e cada conta nova
 * ganha o próprio limite. Aqui a conta é por aluno, numa janela móvel de 24 h,
 * mais um teto global opcional para o projeto inteiro. Zero desliga o teto.
 */

export type AiFeature = 'explanation';

export interface AiQuotaLimits {
  /** Chamadas por aluno em 24 h, por recurso. */
  perUser: Record<AiFeature, number>;
  /** Chamadas de todos os alunos em 24 h, somando os recursos. */
  global: number;
}

export const AI_QUOTA_DEFAULTS: AiQuotaLimits = {
  perUser: { explanation: 30 },
  global: 0,
};

/** Janela da cota. */
export const AI_QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;

export function aiQuotaLimitsFromEnv(
  env: Record<string, string | undefined>,
): AiQuotaLimits {
  const naoNegativo = (raw: string | undefined, padrao: number) => {
    const n = Number(raw);
    return raw?.trim() && Number.isInteger(n) && n >= 0 ? n : padrao;
  };
  return {
    perUser: {
      explanation: naoNegativo(
        env.AI_EXPLANATION_DAILY_LIMIT,
        AI_QUOTA_DEFAULTS.perUser.explanation,
      ),
    },
    global: naoNegativo(env.AI_DAILY_LIMIT, AI_QUOTA_DEFAULTS.global),
  };
}

/**
 * Qual teto a chamada estourou, contando ela mesma (a linha de uso é gravada
 * antes da contagem). `null` = dentro da cota.
 */
export function quotaExceeded(
  feature: AiFeature,
  counts: { user: number; global: number },
  limits: AiQuotaLimits,
): 'user' | 'global' | null {
  const porAluno = limits.perUser[feature];
  if (porAluno > 0 && counts.user > porAluno) return 'user';
  if (limits.global > 0 && counts.global > limits.global) return 'global';
  return null;
}
