import { findGame, GAMES, xpForGameScore } from './games';

describe('games catalog', () => {
  it('exposes pelo menos o Cálculo Mental', () => {
    expect(GAMES.length).toBeGreaterThan(0);
    expect(findGame('calculo-mental')?.name).toBe('Cálculo Mental');
  });

  it('findGame retorna undefined para chave desconhecida', () => {
    expect(findGame('nao-existe')).toBeUndefined();
  });
});

describe('xpForGameScore', () => {
  it('base + 1 XP a cada 5 pontos, com teto de 60', () => {
    expect(xpForGameScore(0)).toBe(5);
    expect(xpForGameScore(10)).toBe(7);
    expect(xpForGameScore(50)).toBe(15);
    expect(xpForGameScore(1000)).toBe(60); // teto
  });
});
