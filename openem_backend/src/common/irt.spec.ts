import {
  CalibratedItem,
  estimateTheta,
  probability3PL,
  thetaToEnemScore,
  triScoreFromItems,
} from './irt';

describe('probability3PL', () => {
  it('em θ = b, retorna c + (1-c)/2', () => {
    expect(probability3PL(0, 1, 0, 0.2)).toBeCloseTo(0.6, 5);
  });

  it('nunca fica abaixo do acerto ao acaso (c)', () => {
    expect(probability3PL(-10, 1, 0, 0.25)).toBeGreaterThanOrEqual(0.25);
  });

  it('tende a 1 para θ muito acima da dificuldade', () => {
    expect(probability3PL(10, 1, 0, 0.2)).toBeGreaterThan(0.99);
  });
});

describe('estimateTheta (EAP)', () => {
  const items = (pattern: boolean[]): CalibratedItem[] =>
    pattern.map((correct, i) => ({ a: 1, b: i - 2, c: 0.2, correct }));

  it('retorna null sem itens', () => {
    expect(estimateTheta([])).toBeNull();
  });

  it('quem acerta mais tem θ maior que quem acerta menos', () => {
    const high = estimateTheta(items([true, true, true, true, true]))!;
    const low = estimateTheta(items([false, false, false, false, false]))!;
    expect(high).toBeGreaterThan(low);
  });

  it('padrão todo-certo não diverge (θ finito e limitado pela grade)', () => {
    const theta = estimateTheta(items([true, true, true, true, true]))!;
    expect(Number.isFinite(theta)).toBe(true);
    expect(theta).toBeLessThanOrEqual(4);
  });
});

describe('thetaToEnemScore', () => {
  it('mapeia θ = 0 para 500', () => {
    expect(thetaToEnemScore(0)).toBe(500);
  });

  it('limita ao intervalo 0..1000', () => {
    expect(thetaToEnemScore(10)).toBe(1000);
    expect(thetaToEnemScore(-10)).toBe(0);
  });
});

describe('triScoreFromItems', () => {
  it('retorna null para lista vazia', () => {
    expect(triScoreFromItems([])).toBeNull();
  });

  it('produz uma nota na escala do ENEM', () => {
    const score = triScoreFromItems([
      { a: 1, b: 0, c: 0.2, correct: true },
      { a: 1, b: 1, c: 0.2, correct: true },
    ])!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1000);
  });
});
