import {
  computeNextReview,
  qualityFromCorrectness,
  ReviewState,
} from './spaced-repetition';

const fresh: ReviewState = { easeFactor: 2.5, intervalD: 0, repetition: 0 };
const now = new Date('2026-01-01T00:00:00Z');

describe('computeNextReview (SM-2)', () => {
  it('primeira lembrança boa agenda para 1 dia', () => {
    const next = computeNextReview(fresh, 5, now);
    expect(next.repetition).toBe(1);
    expect(next.intervalD).toBe(1);
    expect(next.dueAt.getTime()).toBe(now.getTime() + 1 * 24 * 3600 * 1000);
  });

  it('segunda lembrança boa agenda para 6 dias', () => {
    const after1 = computeNextReview(fresh, 5, now);
    const after2 = computeNextReview(after1, 5, now);
    expect(after2.repetition).toBe(2);
    expect(after2.intervalD).toBe(6);
  });

  it('terceira lembrança usa intervalo × fator de facilidade', () => {
    const after1 = computeNextReview(fresh, 5, now);
    const after2 = computeNextReview(after1, 5, now);
    const after3 = computeNextReview(after2, 5, now);
    expect(after3.repetition).toBe(3);
    // O intervalo usa o fator de facilidade ANTES da atualização desta chamada.
    expect(after3.intervalD).toBe(
      Math.round(after2.intervalD * after2.easeFactor),
    );
  });

  it('erro reinicia o ciclo para 1 dia', () => {
    const learned = computeNextReview(
      { easeFactor: 2.5, intervalD: 30, repetition: 5 },
      2,
      now,
    );
    expect(learned.repetition).toBe(0);
    expect(learned.intervalD).toBe(1);
  });

  it('fator de facilidade nunca fica abaixo de 1.3', () => {
    let s: ReviewState = { easeFactor: 1.3, intervalD: 1, repetition: 1 };
    for (let i = 0; i < 10; i++) {
      s = computeNextReview(s, 0, now);
    }
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('qualityFromCorrectness mapeia acerto/erro', () => {
    expect(qualityFromCorrectness(true)).toBeGreaterThanOrEqual(3);
    expect(qualityFromCorrectness(false)).toBeLessThan(3);
  });
});
