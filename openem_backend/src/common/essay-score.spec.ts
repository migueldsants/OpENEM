import { isValidCompetencyScore, totalEssayScore } from './essay-score';

describe('isValidCompetencyScore', () => {
  it('aceita múltiplos de 40 entre 0 e 200', () => {
    [0, 40, 80, 120, 160, 200].forEach((v) =>
      expect(isValidCompetencyScore(v)).toBe(true),
    );
  });

  it('rejeita valores fora da escala', () => {
    [-40, 20, 50, 201, 240].forEach((v) =>
      expect(isValidCompetencyScore(v)).toBe(false),
    );
  });
});

describe('totalEssayScore', () => {
  it('soma as cinco competências', () => {
    expect(
      totalEssayScore({ c1: 200, c2: 200, c3: 200, c4: 200, c5: 200 }),
    ).toBe(1000);
    expect(totalEssayScore({ c1: 120, c2: 80, c3: 160, c4: 40, c5: 200 })).toBe(
      600,
    );
  });

  it('nota mínima é 0', () => {
    expect(totalEssayScore({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 })).toBe(0);
  });
});
