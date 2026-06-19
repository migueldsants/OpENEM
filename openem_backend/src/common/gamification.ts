// Gamificação (Fase 3): pontos, sequência diária (streak) e conquistas.
// Funções puras para facilitar testes; o estado é persistido em GamificationStat.
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

// ---- Pontos ----

export const POINTS = {
  correctAnswer: 10,
  wrongAnswer: 2, // participação: errar ainda é estudar
} as const;

export function pointsForAnswer(isCorrect: boolean): number {
  return isCorrect ? POINTS.correctAnswer : POINTS.wrongAnswer;
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
    description: 'Acumule 500 pontos.',
  },
  {
    code: 'POINTS_2000',
    name: 'Veterano',
    description: 'Acumule 2000 pontos.',
  },
] as const;

export interface GamificationSnapshot {
  points: number;
  currentStreak: number;
  answersCount: number;
  correctCount: number;
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
