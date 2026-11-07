import {
  foldTopicAnswers,
  MASTERY_RECENT,
  toPercent,
  topicMastery,
  weightedMastery,
} from './mastery';

const answers = (...seq: boolean[]) => ({
  total: seq.length,
  correct: seq.filter(Boolean).length,
  recent: seq.slice(0, MASTERY_RECENT),
});

describe('foldTopicAnswers', () => {
  it('agrupa por assunto, guarda as 10 mais recentes e pula resposta sem assunto', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => ({
        topicId: 't',
        isCorrect: i < 2,
      })),
      { topicId: null, isCorrect: true },
    ];
    const t = foldTopicAnswers(rows).get('t')!;
    expect(t.total).toBe(12);
    expect(t.correct).toBe(2);
    expect(t.recent).toHaveLength(MASTERY_RECENT);
    // As duas primeiras (mais novas) são as certas.
    expect(t.recent.slice(0, 3)).toEqual([true, true, false]);
    expect(foldTopicAnswers(rows).size).toBe(1);
  });
});

describe('topicMastery', () => {
  it('sem resposta é não visto e vale zero', () => {
    expect(topicMastery(undefined)).toEqual({
      state: 'nao-visto',
      mastery: 0,
      answered: 0,
      accuracy: null,
    });
  });

  it('com menos de 3 respostas ainda é não visto, mas mostra o acerto', () => {
    const m = topicMastery(answers(true, true));
    expect(m.state).toBe('nao-visto');
    expect(m.mastery).toBe(0);
    expect(m.accuracy).toBe(100);
  });

  it('3 ou 4 respostas é praticando, mesmo acertando tudo', () => {
    expect(topicMastery(answers(true, true, true, true)).state).toBe(
      'praticando',
    );
  });

  it('dominado pede 5 respostas e 70% nas recentes', () => {
    expect(topicMastery(answers(true, true, true, true, false)).state).toBe(
      'dominado',
    );
    expect(topicMastery(answers(true, true, true, false, false)).state).toBe(
      'praticando',
    );
  });

  it('só as 10 mais recentes contam: errar no começo não prende o aluno', () => {
    const seq = [...Array(10).fill(true), ...Array(20).fill(false)];
    const m = topicMastery(answers(...seq));
    expect(m.mastery).toBe(1);
    expect(m.state).toBe('dominado');
    expect(m.answered).toBe(30);
  });
});

describe('weightedMastery', () => {
  it('pondera pelo peso', () => {
    expect(
      weightedMastery([
        { weight: 3, mastery: 1 },
        { weight: 1, mastery: 0 },
      ]),
    ).toBe(0.75);
  });

  it('sem peso cai na média simples; sem itens é zero', () => {
    expect(
      weightedMastery([
        { weight: 0, mastery: 1 },
        { weight: 0, mastery: 0 },
      ]),
    ).toBe(0.5);
    expect(weightedMastery([])).toBe(0);
  });

  it('toPercent limita a 0..100', () => {
    expect(toPercent(0.314)).toBe(31);
    expect(toPercent(2)).toBe(100);
    expect(toPercent(-1)).toBe(0);
  });
});
