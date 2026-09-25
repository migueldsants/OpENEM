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

  // Os testes acima usam b = 0, onde "θ - b" e "θ + b" dão o mesmo número:
  // trocar o sinal da dificuldade passava despercebido (mutation testing).
  it('o ponto médio acompanha a dificuldade (θ = b ≠ 0)', () => {
    expect(probability3PL(1.5, 1, 1.5, 0.2)).toBeCloseTo(0.6, 5);
    expect(probability3PL(-2, 1.3, -2, 0.25)).toBeCloseTo(0.625, 5);
  });

  it('questão mais difícil tem menos chance de acerto para o mesmo aluno', () => {
    const facil = probability3PL(0, 1, -2, 0.2);
    const media = probability3PL(0, 1, 0, 0.2);
    const dificil = probability3PL(0, 1, 2, 0.2);
    expect(facil).toBeGreaterThan(media);
    expect(media).toBeGreaterThan(dificil);
  });

  it('discriminação maior separa mais quem está acima e abaixo de b', () => {
    const acimaForte = probability3PL(1, 2.5, 0, 0.2);
    const acimaFraca = probability3PL(1, 0.5, 0, 0.2);
    expect(acimaForte).toBeGreaterThan(acimaFraca);
    const abaixoForte = probability3PL(-1, 2.5, 0, 0.2);
    const abaixoFraca = probability3PL(-1, 0.5, 0, 0.2);
    expect(abaixoForte).toBeLessThan(abaixoFraca);
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

  it('coerência: acertar as fáceis vale mais que acertar só as difíceis', () => {
    // Mesmo número de acertos (2 de 5), nota diferente — é a "coerência
    // pedagógica" do ENEM. Quem erra as fáceis e acerta as difíceis tem os
    // acertos creditados ao chute (c), e os erros nas fáceis pesam mais.
    const faceis = estimateTheta(items([true, true, false, false, false]))!;
    const dificeis = estimateTheta(items([false, false, false, true, true]))!;
    expect(faceis).toBeGreaterThan(dificeis);
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
