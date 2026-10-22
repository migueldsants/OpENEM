import { aheadOf, rankRows } from './leaderboard';

const top = Array.from({ length: 10 }, (_, i) => ({
  userId: `u${String(i).padStart(2, '0')}`,
  xp: 1000 - i * 10,
}));

describe('rankRows', () => {
  it('numera o top na ordem recebida e marca o aluno', () => {
    const rows = rankRows(top, { userId: 'u03', xp: 970, ahead: 3 });
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(rows.filter((r) => r.isMe).map((r) => r.userId)).toEqual(['u03']);
  });

  it('aluno fora do top entra no fim com a posição real, não "11º"', () => {
    const rows = rankRows(top, { userId: 'eu', xp: 5, ahead: 236 });
    expect(rows).toHaveLength(11);
    expect(rows[10]).toEqual({ userId: 'eu', xp: 5, rank: 237, isMe: true });
    expect(rows.slice(0, 10).every((r) => !r.isMe)).toBe(true);
  });

  it('ranking vazio: o aluno é o 1º', () => {
    expect(rankRows([], { userId: 'eu', xp: 0, ahead: 0 })).toEqual([
      { userId: 'eu', xp: 0, rank: 1, isMe: true },
    ]);
  });
});

describe('aheadOf', () => {
  it('conta quem tem mais XP ou empata com userId menor (o desempate da lista)', () => {
    expect(aheadOf(120, 'm')).toEqual({
      OR: [{ points: { gt: 120 } }, { points: 120, userId: { lt: 'm' } }],
    });
  });
});
