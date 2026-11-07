import {
  deriveWeights,
  MIN_EXAMS_FOR_WEIGHTS,
  weightFromPerExam,
} from './topic-weight';

describe('weightFromPerExam', () => {
  it.each([
    [12.3, 5],
    [3, 5],
    [2.99, 4],
    [1.5, 4],
    [1.49, 3],
    [0.8, 3],
    [0.79, 2],
    [0.3, 2],
    [0.29, 1],
    [0, 1],
  ])('%p questão(ões) por prova → peso %p', (perExam, weight) => {
    expect(weightFromPerExam(perExam)).toBe(weight);
  });
});

describe('deriveWeights', () => {
  it('não mexe com poucas provas no banco', () => {
    expect(
      deriveWeights(MIN_EXAMS_FOR_WEIGHTS - 1, ['t'], { t: { perExam: 9 } }),
    ).toBeNull();
  });

  it('assunto que não caiu fica com peso 1', () => {
    const w = deriveWeights(10, ['muito', 'nunca'], {
      muito: { perExam: 4.8 },
    });
    expect(w?.get('muito')).toBe(5);
    expect(w?.get('nunca')).toBe(1);
  });
});
