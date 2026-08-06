// Catálogo de minigames (Fase 3, issue #18). A definição vive no código — no
// banco guardamos apenas as pontuações (GameScore). Cada jogo declara sua
// chave, nome, descrição, regras resumidas e como o XP é calculado a partir do
// score.

export interface GameDefinition {
  key: string;
  name: string;
  description: string;
  /** Como o score é computado (legível, para exibir nas regras). */
  scoring: string;
  /** Dificuldades/níveis disponíveis. */
  levels: { key: string; label: string }[];
}

export const GAMES: readonly GameDefinition[] = [
  {
    key: 'calculo-mental',
    name: 'Cálculo Mental',
    description:
      'Resolva operações aritméticas o mais rápido possível. Cada acerto em sequência vale mais — erre e a sequência zera.',
    scoring:
      'Score = acertos consecutivos (combo) + bônus por velocidade. Acertar em < 3s dobra os pontos da rodada.',
    levels: [
      { key: 'facil', label: 'Fácil' },
      { key: 'medio', label: 'Médio' },
      { key: 'dificil', label: 'Difícil' },
    ],
  },
] as const;

export function findGame(key: string): GameDefinition | undefined {
  return GAMES.find((g) => g.key === key);
}

/**
 * XP concedido por uma partida de minigame (issue #18). Base por participar +
 * 1 XP a cada 5 pontos de score, com teto de 60 XP por partida para não inflar.
 */
export function xpForGameScore(score: number): number {
  const base = 5;
  const perScore = Math.floor(score / 5);
  return Math.min(60, base + perScore);
}
