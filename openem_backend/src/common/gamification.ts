// Gamificação (Fase 3): XP/níveis, ligas, sequência diária (streak), combo,
// bônus diário e conquistas. Funções puras para facilitar testes; o estado é
// persistido em GamificationStat (o campo `points` é o XP total acumulado).
// O design segue o PRD §5 (Fase 3): "calibrada para não infantilizar — toggle".

const DAY_MS = 24 * 60 * 60 * 1000;

/** Início do dia (UTC) em milissegundos — a sequência conta por dia de calendário. */
function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityOn: Date | null;
}

export interface StreakUpdate extends StreakState {
  /** true quando hoje ainda não contava para a sequência (houve incremento/reset). */
  incremented: boolean;
}

/**
 * Atualiza a sequência diária a partir de uma nova atividade.
 * - Primeira atividade ou retomada após lacuna: sequência reinicia em 1.
 * - Mesmo dia da última atividade: sem alteração.
 * - Dia consecutivo: sequência +1.
 */
export function updateStreak(
  state: StreakState,
  now: Date = new Date(),
): StreakUpdate {
  const today = startOfDayUtc(now);

  if (!state.lastActivityOn) {
    const currentStreak = 1;
    return {
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastActivityOn: new Date(today),
      incremented: true,
    };
  }

  const last = startOfDayUtc(state.lastActivityOn);
  const diffDays = Math.round((today - last) / DAY_MS);

  if (diffDays <= 0) {
    // Mesmo dia (ou relógio atrasado): mantém o estado.
    return { ...state, incremented: false };
  }

  const currentStreak = diffDays === 1 ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    lastActivityOn: new Date(today),
    incremented: true,
  };
}

// ---- XP (os "pontos" acumulados são o XP total que sobe de nível) ----

export const POINTS = {
  correctAnswer: 10,
  wrongAnswer: 2, // participação: errar ainda é estudar
  // Ações não-resposta (issue #17):XP fixo por participação + bônus por desempenho.
  reviewGrade: 5, // autoavaliação SM-2
  studySession: 8, // sessão de cronograma concluída
  essaySubmit: 15, // enviar redação
  essayHighScore: 40, // bônus: nota >= 800
  essayGoodScore: 20, // bônus: nota >= 600
  simulationBase: 20, // concluir um simulado
  simulationPerCorrect: 3, // +XP por acerto
  simulationSpeedBonus: 30, // bônus por terminar em < 60% do tempo limite
} as const;

/** XP base de uma resposta, antes de combo e bônus. */
export function pointsForAnswer(isCorrect: boolean): number {
  return isCorrect ? POINTS.correctAnswer : POINTS.wrongAnswer;
}

/**
 * XP de um simulado concluído: base + por acerto, com bônus de velocidade opcional.
 * `fractionOfLimit` é a fração do tempo limite usada (0..1); < 0.6 dá bônus.
 */
export function xpForSimulation(
  correct: number,
  fractionOfLimit: number | null,
): number {
  const base = POINTS.simulationBase + correct * POINTS.simulationPerCorrect;
  const speed =
    fractionOfLimit != null && fractionOfLimit < 0.6
      ? POINTS.simulationSpeedBonus
      : 0;
  return base + speed;
}

/** XP de uma redação avaliada: envio + bônus por nota (total 0..1000). */
export function xpForEssay(totalScore: number | null): number {
  if (totalScore == null) return POINTS.essaySubmit;
  let bonus = 0;
  if (totalScore >= 800) bonus = POINTS.essayHighScore;
  else if (totalScore >= 600) bonus = POINTS.essayGoodScore;
  return POINTS.essaySubmit + bonus;
}

/**
 * Multiplicador de combo pela sequência diária: quanto maior a streak, mais XP
 * por questão. +10% por dia, com teto de 1.6× (streak >= 7). Recompensa hábito.
 */
export function comboMultiplierForStreak(streak: number): number {
  const steps = Math.max(0, Math.min(streak - 1, 6));
  return Number((1 + steps * 0.1).toFixed(2));
}

/** XP de uma resposta já com o combo da streak aplicado (arredondado). */
export function xpForAnswer(isCorrect: boolean, streak: number): number {
  return Math.round(
    pointsForAnswer(isCorrect) * comboMultiplierForStreak(streak),
  );
}

/**
 * Bônus de XP da 1ª atividade do dia (login diário), escalando com a streak.
 * Começa em 15 e cresce 5 por dia, com teto de 60 (streak >= 10).
 */
export function dailyBonusXp(streak: number): number {
  return 15 + Math.max(0, Math.min(streak - 1, 9)) * 5;
}

// ---- Níveis (curva quadrática: rápido no início, encarece depois) ----

const XP_LEVEL_FACTOR = 25;

/** XP total necessário para alcançar um nível (nível 1 = 0 XP). */
export function xpToReachLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return XP_LEVEL_FACTOR * (l - 1) * (l - 1);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number; // XP já acumulado dentro do nível atual
  xpForNextLevel: number; // XP necessário para subir de nível
  progress: number; // 0..1
}

/** Deriva o nível e o progresso a partir do XP total acumulado. */
export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safeXp / XP_LEVEL_FACTOR)) + 1;
  const base = xpToReachLevel(level);
  const next = xpToReachLevel(level + 1);
  const span = next - base;
  const xpIntoLevel = safeXp - base;
  return {
    level,
    xpIntoLevel,
    xpForNextLevel: span,
    progress: span > 0 ? Number((xpIntoLevel / span).toFixed(4)) : 0,
  };
}

// ---- Ligas / tiers (faixas de status por nível) ----

export interface LeagueDef {
  key: string;
  name: string;
  minLevel: number;
}

export const LEAGUES: readonly LeagueDef[] = [
  { key: 'BRONZE', name: 'Bronze', minLevel: 1 },
  { key: 'PRATA', name: 'Prata', minLevel: 5 },
  { key: 'OURO', name: 'Ouro', minLevel: 10 },
  { key: 'PLATINA', name: 'Platina', minLevel: 20 },
  { key: 'DIAMANTE', name: 'Diamante', minLevel: 35 },
] as const;

/** Liga correspondente a um nível (a de maior `minLevel` que ele alcança). */
export function leagueForLevel(level: number): LeagueDef {
  let current = LEAGUES[0];
  for (const league of LEAGUES) {
    if (level >= league.minLevel) current = league;
  }
  return current;
}

// ---- Conquistas ----

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
}

/** Catálogo (fonte da verdade). Persistimos só o que cada usuário desbloqueou. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    code: 'FIRST_ANSWER',
    name: 'Primeiro passo',
    description: 'Responda sua primeira questão.',
  },
  {
    code: 'TEN_ANSWERS',
    name: 'Aquecendo',
    description: 'Responda 10 questões.',
  },
  {
    code: 'HUNDRED_ANSWERS',
    name: 'Maratonista',
    description: 'Responda 100 questões.',
  },
  {
    code: 'TEN_CORRECT',
    name: 'Na mira',
    description: 'Acerte 10 questões.',
  },
  {
    code: 'STREAK_3',
    name: 'Pegando o ritmo',
    description: 'Estude 3 dias seguidos.',
  },
  {
    code: 'STREAK_7',
    name: 'Semana cheia',
    description: 'Estude 7 dias seguidos.',
  },
  {
    code: 'STREAK_30',
    name: 'Disciplina de ferro',
    description: 'Estude 30 dias seguidos.',
  },
  {
    code: 'POINTS_500',
    name: 'Meio milhar',
    description: 'Acumule 500 de XP.',
  },
  {
    code: 'POINTS_2000',
    name: 'Veterano',
    description: 'Acumule 2000 de XP.',
  },
  {
    code: 'REACH_LEVEL_5',
    name: 'Subindo de liga',
    description: 'Chegue ao nível 5 (liga Prata).',
  },
  {
    code: 'REACH_LEVEL_10',
    name: 'Ouro puro',
    description: 'Chegue ao nível 10 (liga Ouro).',
  },
  {
    code: 'REACH_LEVEL_20',
    name: 'Elite',
    description: 'Chegue ao nível 20 (liga Platina).',
  },
  // ---- Ações além de questões (issue #17) ----
  {
    code: 'FIRST_SIMULATION',
    name: 'Prova de fogo',
    description: 'Conclua seu primeiro simulado.',
  },
  {
    code: 'FIVE_SIMULATIONS',
    name: 'Simulador dedicado',
    description: 'Conclua 5 simulados.',
  },
  {
    code: 'FIRST_ESSAY',
    name: 'Primeira redação',
    description: 'Envie sua primeira redação.',
  },
  {
    code: 'HIGH_SCORE_ESSAY',
    name: 'Tirou onda',
    description: 'Tire 800+ em uma redação.',
  },
  {
    code: 'FIRST_REVIEW',
    name: 'Revisão ativa',
    description: 'Faça sua primeira autoavaliação de revisão.',
  },
  {
    code: 'TEN_REVIEWS',
    name: 'Memória de elefante',
    description: 'Faça 10 autoavaliações de revisão.',
  },
  {
    code: 'FIRST_SESSION',
    name: 'No cronograma',
    description: 'Conclua sua primeira sessão de estudo.',
  },
  {
    code: 'TEN_SESSIONS',
    name: 'Constância',
    description: 'Conclua 10 sessões de estudo.',
  },
] as const;

export interface GamificationSnapshot {
  points: number;
  currentStreak: number;
  answersCount: number;
  correctCount: number;
  simulationsCount: number;
  essaysCount: number;
  highScoreEssays: number;
  reviewsCount: number;
  sessionsDone: number;
}

const ACHIEVEMENT_RULES: Record<string, (s: GamificationSnapshot) => boolean> =
  {
    FIRST_ANSWER: (s) => s.answersCount >= 1,
    TEN_ANSWERS: (s) => s.answersCount >= 10,
    HUNDRED_ANSWERS: (s) => s.answersCount >= 100,
    TEN_CORRECT: (s) => s.correctCount >= 10,
    STREAK_3: (s) => s.currentStreak >= 3,
    STREAK_7: (s) => s.currentStreak >= 7,
    STREAK_30: (s) => s.currentStreak >= 30,
    POINTS_500: (s) => s.points >= 500,
    POINTS_2000: (s) => s.points >= 2000,
    REACH_LEVEL_5: (s) => levelFromXp(s.points).level >= 5,
    REACH_LEVEL_10: (s) => levelFromXp(s.points).level >= 10,
    REACH_LEVEL_20: (s) => levelFromXp(s.points).level >= 20,
    FIRST_SIMULATION: (s) => s.simulationsCount >= 1,
    FIVE_SIMULATIONS: (s) => s.simulationsCount >= 5,
    FIRST_ESSAY: (s) => s.essaysCount >= 1,
    HIGH_SCORE_ESSAY: (s) => s.highScoreEssays >= 1,
    FIRST_REVIEW: (s) => s.reviewsCount >= 1,
    TEN_REVIEWS: (s) => s.reviewsCount >= 10,
    FIRST_SESSION: (s) => s.sessionsDone >= 1,
    TEN_SESSIONS: (s) => s.sessionsDone >= 10,
  };

/**
 * Retorna os códigos de conquistas que o snapshot satisfaz mas que ainda não
 * estão em `unlocked`. Determinístico e idempotente.
 */
export function evaluateAchievements(
  snapshot: GamificationSnapshot,
  unlocked: readonly string[] = [],
): string[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter(
    (a) => !have.has(a.code) && ACHIEVEMENT_RULES[a.code]?.(snapshot),
  ).map((a) => a.code);
}
