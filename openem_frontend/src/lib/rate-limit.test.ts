import { describe, expect, it } from 'vitest';
import { countdown, parseRetryAfter, rateLimitMessage } from './rate-limit';

describe('parseRetryAfter', () => {
  it('lê segundos', () => {
    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter(' 900 ')).toBe(900);
  });

  it('nunca menos de 1', () => {
    expect(parseRetryAfter('0')).toBe(1);
  });

  it('lê data HTTP', () => {
    const agora = Date.parse('2026-10-22T12:00:00Z');
    expect(parseRetryAfter('Thu, 22 Oct 2026 12:01:30 GMT', agora)).toBe(90);
    // Data no passado vale como "já".
    expect(parseRetryAfter('Thu, 22 Oct 2026 11:00:00 GMT', agora)).toBe(1);
  });

  it.each([[null], [undefined], [''], ['logo'], ['-5'], ['1.5']])(
    '%p não dá para ler',
    (h) => {
      expect(parseRetryAfter(h)).toBeNull();
    },
  );
});

describe('rateLimitMessage', () => {
  it('em segundos e em minutos, como o backend', () => {
    expect(rateLimitMessage(45)).toBe(
      'Muitas tentativas. Tente de novo em 45 s.',
    );
    expect(rateLimitMessage(900)).toBe(
      'Muitas tentativas. Tente de novo em 15 min.',
    );
  });

  it('sem o tempo, "em instantes"', () => {
    expect(rateLimitMessage(null)).toBe(
      'Muitas tentativas. Tente de novo em instantes.',
    );
  });
});

describe('countdown', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [900, '15:00'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [-3, '0:00'],
    [4.2, '0:05'],
  ])('%p s → %p', (s, esperado) => {
    expect(countdown(s)).toBe(esperado);
  });
});
