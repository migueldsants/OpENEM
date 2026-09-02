// Testes da lib de gamificação do frontend (issue #47).
import { describe, it, expect } from 'vitest';
import { leagueStyle, LEAGUE_STYLE } from './gamification';

describe('leagueStyle (issue #47)', () => {
  it('devolve o estilo por chave de liga', () => {
    for (const key of Object.keys(LEAGUE_STYLE)) {
      expect(leagueStyle(key)).toBe(LEAGUE_STYLE[key]);
    }
  });

  it('caí no Bronze para chave desconhecida', () => {
    expect(leagueStyle('NAO_EXISTE')).toBe(LEAGUE_STYLE.BRONZE);
  });
});