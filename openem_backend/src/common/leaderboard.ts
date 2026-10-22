// Ranking de XP (issue #19): monta as linhas com a posição real de cada aluno.
// A lista vem do banco ordenada por XP (desc) e, no empate, por userId (asc);
// a posição de quem ficou fora do top é 1 + quantos estão à frente nessa mesma
// ordem. Antes, o aluno fora do top aparecia como "11º" qualquer que fosse a
// posição dele.

export interface LeaderboardRow {
  userId: string;
  xp: number;
}

export interface RankedRow extends LeaderboardRow {
  rank: number;
  isMe: boolean;
}

/**
 * Filtro "à frente de" na ordem do ranking: mais XP, ou o mesmo XP e userId
 * menor (o desempate da lista). Contar quem casa com ele dá a posição - 1.
 */
export function aheadOf(xp: number, userId: string) {
  return {
    OR: [{ points: { gt: xp } }, { points: xp, userId: { lt: userId } }],
  };
}

/**
 * Linhas do ranking: o top na ordem recebida (posição 1, 2, 3…) e, se o aluno
 * não está nele, uma linha a mais com a posição real dele (`ahead` + 1).
 */
export function rankRows(
  top: readonly LeaderboardRow[],
  me: LeaderboardRow & { ahead: number },
): RankedRow[] {
  const rows = top.map((row, i) => ({
    ...row,
    rank: i + 1,
    isMe: row.userId === me.userId,
  }));
  if (!rows.some((r) => r.isMe)) {
    rows.push({
      userId: me.userId,
      xp: me.xp,
      rank: me.ahead + 1,
      isMe: true,
    });
  }
  return rows;
}
