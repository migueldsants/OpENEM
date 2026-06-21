import {
  rankTopicsForReinforcement,
  reinforcementReason,
} from './recommendation';

describe('recommendation', () => {
  it('ignora assuntos sem tentativas', () => {
    const ranked = rankTopicsForReinforcement([
      { topicId: 'a', attempts: 0, correct: 0 },
    ]);
    expect(ranked).toHaveLength(0);
  });

  it('prioriza menor precisão', () => {
    const ranked = rankTopicsForReinforcement([
      { topicId: 'forte', attempts: 10, correct: 9 },
      { topicId: 'fraco', attempts: 10, correct: 2 },
    ]);
    expect(ranked[0].topicId).toBe('fraco');
  });

  it('com a mesma precisão, prioriza quem tem mais volume (mais confiável)', () => {
    const ranked = rankTopicsForReinforcement([
      { topicId: 'pouco', attempts: 2, correct: 1 },
      { topicId: 'muito', attempts: 20, correct: 10 },
    ]);
    expect(ranked[0].topicId).toBe('muito');
  });

  it('reinforcementReason descreve a precisão', () => {
    expect(reinforcementReason(0)).toMatch(/ainda não acertou/);
    expect(reinforcementReason(0.5)).toBe('Você acertou 50% neste assunto');
  });
});
