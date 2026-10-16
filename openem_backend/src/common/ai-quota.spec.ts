import {
  AI_QUOTA_DEFAULTS,
  aiQuotaLimitsFromEnv,
  quotaExceeded,
} from './ai-quota';

describe('aiQuotaLimitsFromEnv', () => {
  it('sem variáveis: 5 redações e 30 comentários por aluno, sem teto global', () => {
    expect(aiQuotaLimitsFromEnv({})).toEqual({
      perUser: { essay: 5, explanation: 30 },
      global: 0,
    });
  });

  it('lê os três tetos do ambiente', () => {
    expect(
      aiQuotaLimitsFromEnv({
        AI_ESSAY_DAILY_LIMIT: '2',
        AI_EXPLANATION_DAILY_LIMIT: '0',
        AI_DAILY_LIMIT: '500',
      }),
    ).toEqual({ perUser: { essay: 2, explanation: 0 }, global: 500 });
  });

  it('valor inválido cai no padrão', () => {
    expect(
      aiQuotaLimitsFromEnv({
        AI_ESSAY_DAILY_LIMIT: 'cinco',
        AI_EXPLANATION_DAILY_LIMIT: '-1',
        AI_DAILY_LIMIT: '2.5',
      }),
    ).toEqual(AI_QUOTA_DEFAULTS);
    expect(aiQuotaLimitsFromEnv({ AI_DAILY_LIMIT: ' ' })).toEqual(
      AI_QUOTA_DEFAULTS,
    );
  });
});

describe('quotaExceeded', () => {
  const limites = { perUser: { essay: 2, explanation: 3 }, global: 10 };

  it('dentro da cota, inclusive na última vaga', () => {
    expect(quotaExceeded('essay', { user: 2, global: 10 }, limites)).toBeNull();
  });

  it('passou da cota do aluno', () => {
    expect(quotaExceeded('essay', { user: 3, global: 5 }, limites)).toBe(
      'user',
    );
  });

  it('cada recurso tem a própria cota', () => {
    expect(
      quotaExceeded('explanation', { user: 3, global: 5 }, limites),
    ).toBeNull();
  });

  it('passou do teto global', () => {
    expect(quotaExceeded('essay', { user: 1, global: 11 }, limites)).toBe(
      'global',
    );
  });

  it('zero desliga o teto', () => {
    const sem = { perUser: { essay: 0, explanation: 0 }, global: 0 };
    expect(quotaExceeded('essay', { user: 1000, global: 1e6 }, sem)).toBeNull();
  });
});
