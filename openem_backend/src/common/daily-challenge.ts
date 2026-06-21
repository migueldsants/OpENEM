// Desafio diário (Fase 3): uma meta de prática que se renova a cada dia.
// O conteúdo é determinístico a partir da data (mesmo desafio para todos no dia),
// então não precisa ser persistido — só registramos o resgate da recompensa.

/** Dia de calendário (UTC) no formato YYYY-MM-DD, usado como chave do desafio. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Hash determinístico simples (FNV-1a) para semear o desafio a partir do dia. */
function seedFromDay(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface DailyChallengeSpec {
  day: string;
  /** Número de questões a responder no dia. */
  goal: number;
  /** XP de recompensa ao concluir. */
  xpReward: number;
}

// Metas possíveis (variam por dia para não ficar repetitivo).
const GOALS = [5, 8, 10] as const;

/** Gera o desafio do dia de forma determinística. */
export function dailyChallengeFor(date: Date = new Date()): DailyChallengeSpec {
  const day = dayKey(date);
  const seed = seedFromDay(day);
  const goal = GOALS[seed % GOALS.length];
  // Recompensa proporcional ao esforço, com um piso.
  const xpReward = 20 + goal * 5;
  return { day, goal, xpReward };
}

export interface DailyChallengeStatus extends DailyChallengeSpec {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

/** Combina o desafio do dia com o progresso e o resgate do usuário. */
export function dailyChallengeStatus(
  spec: DailyChallengeSpec,
  answeredToday: number,
  claimed: boolean,
): DailyChallengeStatus {
  const progress = Math.min(answeredToday, spec.goal);
  return {
    ...spec,
    progress,
    completed: answeredToday >= spec.goal,
    claimed,
  };
}
