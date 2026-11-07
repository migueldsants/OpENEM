// Desempenho semana a semana (issue #90): o aluno vê a semana atual aberta,
// contra a própria meta de minutos, e as anteriores com a variação de acerto.
// Lógica pura; o serviço só busca respostas, sessões de foco e o perfil.
//
// Dia e semana são contados no fuso de Brasília. Em UTC o dia virava às 21h e
// quem estuda à noite via a questão das 22h cair no dia seguinte.

import { rankTopicsForReinforcement } from './recommendation';
import { addDays, studyDay, weekStart } from './study-day';

// Os helpers de dia vivem em study-day.ts, que a gamificação também usa.
export { STUDY_TIME_ZONE, addDays, studyDay, weekStart } from './study-day';

export type AreaKey = 'mat' | 'nat' | 'hum' | 'lin';
export const AREA_KEYS: AreaKey[] = ['mat', 'nat', 'hum', 'lin'];

export interface WeeklyAnswer {
  createdAt: Date;
  isCorrect: boolean;
  /** Nome da área da questão (ou da matéria do assunto, quando a questão não tem área). */
  areaName: string | null;
  topic: {
    id: string;
    name: string;
    weight: number;
    subjectName: string;
    /** Para o link "Ver na trilha"; opcional nos testes antigos. */
    subjectId?: string;
  } | null;
}

export interface WeeklyFocus {
  completedAt: Date;
  durationSec: number;
}

export interface WeekDay {
  date: string;
  answers: number;
  correct: number;
  minutes: number;
  studied: boolean;
}

export interface WeekArea {
  area: AreaKey;
  answers: number;
  correct: number;
  /** 0..100, ou null quando a área não teve resposta na semana. */
  accuracy: number | null;
}

export interface Week {
  start: string;
  end: string;
  days: WeekDay[];
  answers: number;
  correct: number;
  accuracy: number | null;
  minutes: number;
  daysStudied: number;
  areas: WeekArea[];
  /** Pontos de acerto contra a semana anterior; null se uma das duas não tem resposta. */
  delta: number | null;
}

export interface Priority {
  topicId: string;
  topic: string;
  subject: string;
  /** Matéria do assunto, para abrir a trilha dela; null em dado antigo. */
  subjectId: string | null;
  area: AreaKey | null;
  answers: number;
  correct: number;
  accuracy: number;
  weight: number;
}

export interface WeeklySummary {
  today: string;
  weeks: Week[];
  priorities: Priority[];
  /** Respostas da janela das prioridades que ainda não têm assunto classificado. */
  unclassified: number;
  /** Dias seguidos de estudo terminando hoje (ou ontem, se hoje ainda não houve). */
  streak: number;
}

/** Janela das prioridades: o que o aluno errou no último mês, não no ano. */
export const PRIORITY_WINDOW_DAYS = 30;
/** Uma resposta só não diz nada sobre o assunto. */
export const PRIORITY_MIN_ANSWERS = 2;
export const PRIORITY_LIMIT = 3;

/** Área do ENEM pelo nome da área ou da matéria; Redação conta em Linguagens. */
export function areaKeyFromName(
  name: string | null | undefined,
): AreaKey | null {
  const n = (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!n) return null;
  if (n.includes('matem')) return 'mat';
  if (n.includes('natureza') || /biologia|fisica|quimica/.test(n)) return 'nat';
  if (
    n.includes('humanas') ||
    /historia|geografia|filosofia|sociologia/.test(n)
  )
    return 'hum';
  if (/linguage|lingua|literatura|artes|educacao fisica|redac/.test(n))
    return 'lin';
  return null;
}

function percent(correct: number, total: number): number | null {
  return total ? Math.round((correct / total) * 100) : null;
}

/** Dias seguidos com estudo terminando hoje, ou ontem quando hoje ainda está em branco. */
export function currentStreak(studiedDays: Set<string>, today: string): number {
  let day = studiedDays.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (studiedDays.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export function buildWeeklySummary(
  answers: WeeklyAnswer[],
  focus: WeeklyFocus[],
  now: Date,
  weekCount: number,
): WeeklySummary {
  const today = studyDay(now);
  const firstWeek = addDays(weekStart(today), -7 * (weekCount - 1));

  const perDay = new Map<
    string,
    { answers: number; correct: number; seconds: number }
  >();
  const perWeekArea = new Map<string, { answers: number; correct: number }>();
  const studied = new Set<string>();
  const dayOf = (key: string) => {
    let d = perDay.get(key);
    if (!d) {
      d = { answers: 0, correct: 0, seconds: 0 };
      perDay.set(key, d);
    }
    return d;
  };

  for (const a of answers) {
    const day = studyDay(a.createdAt);
    studied.add(day);
    const d = dayOf(day);
    d.answers += 1;
    if (a.isCorrect) d.correct += 1;
    const area = areaKeyFromName(a.areaName);
    if (area) {
      const key = `${weekStart(day)}|${area}`;
      const w = perWeekArea.get(key) ?? { answers: 0, correct: 0 };
      w.answers += 1;
      if (a.isCorrect) w.correct += 1;
      perWeekArea.set(key, w);
    }
  }
  for (const f of focus) {
    if (f.durationSec <= 0) continue;
    const day = studyDay(f.completedAt);
    studied.add(day);
    dayOf(day).seconds += f.durationSec;
  }

  const weeks: Week[] = [];
  for (let i = 0; i < weekCount; i++) {
    const start = addDays(firstWeek, 7 * i);
    const days: WeekDay[] = [];
    for (let j = 0; j < 7; j++) {
      const date = addDays(start, j);
      const d = perDay.get(date);
      days.push({
        date,
        answers: d?.answers ?? 0,
        correct: d?.correct ?? 0,
        minutes: Math.round((d?.seconds ?? 0) / 60),
        studied: studied.has(date),
      });
    }
    const total = days.reduce((s, d) => s + d.answers, 0);
    const correct = days.reduce((s, d) => s + d.correct, 0);
    const seconds = days.reduce(
      (s, d) => s + (perDay.get(d.date)?.seconds ?? 0),
      0,
    );
    weeks.push({
      start,
      end: addDays(start, 6),
      days,
      answers: total,
      correct,
      accuracy: percent(correct, total),
      minutes: Math.round(seconds / 60),
      daysStudied: days.filter((d) => d.studied).length,
      areas: AREA_KEYS.map((area) => {
        const w = perWeekArea.get(`${start}|${area}`) ?? {
          answers: 0,
          correct: 0,
        };
        return {
          area,
          answers: w.answers,
          correct: w.correct,
          accuracy: percent(w.correct, w.answers),
        };
      }),
      delta: null,
    });
  }
  for (let i = 1; i < weeks.length; i++) {
    const [prev, cur] = [weeks[i - 1], weeks[i]];
    cur.delta =
      prev.accuracy !== null && cur.accuracy !== null
        ? cur.accuracy - prev.accuracy
        : null;
  }

  // Prioridades: erro no último mês, com peso pela confiança (volume) e pela
  // incidência do assunto na prova (Topic.weight, 1 a 5).
  const windowStart = addDays(today, -(PRIORITY_WINDOW_DAYS - 1));
  const topics = new Map<
    string,
    {
      attempts: number;
      correct: number;
      topic: NonNullable<WeeklyAnswer['topic']>;
      areaName: string | null;
    }
  >();
  let unclassified = 0;
  for (const a of answers) {
    if (studyDay(a.createdAt) < windowStart) continue;
    if (!a.topic) {
      unclassified += 1;
      continue;
    }
    const t = topics.get(a.topic.id) ?? {
      attempts: 0,
      correct: 0,
      topic: a.topic,
      areaName: a.areaName,
    };
    t.attempts += 1;
    if (a.isCorrect) t.correct += 1;
    topics.set(a.topic.id, t);
  }
  const ranked = rankTopicsForReinforcement(
    [...topics.entries()]
      .filter(
        ([, t]) => t.attempts >= PRIORITY_MIN_ANSWERS && t.correct < t.attempts,
      )
      .map(([topicId, t]) => ({
        topicId,
        attempts: t.attempts,
        correct: t.correct,
      })),
  )
    .map((r) => ({
      ...r,
      score: r.priority * (topics.get(r.topicId)!.topic.weight / 3),
    }))
    .sort((a, b) => b.score - a.score || b.attempts - a.attempts)
    .slice(0, PRIORITY_LIMIT);

  const priorities: Priority[] = ranked.map((r) => {
    const t = topics.get(r.topicId)!;
    return {
      topicId: r.topicId,
      topic: t.topic.name,
      subject: t.topic.subjectName,
      subjectId: t.topic.subjectId ?? null,
      area: areaKeyFromName(t.areaName) ?? areaKeyFromName(t.topic.subjectName),
      answers: t.attempts,
      correct: t.correct,
      accuracy: Math.round((t.correct / t.attempts) * 100),
      weight: t.topic.weight,
    };
  });

  return {
    today,
    weeks: weeks.reverse(),
    priorities,
    unclassified,
    streak: currentStreak(studied, today),
  };
}
