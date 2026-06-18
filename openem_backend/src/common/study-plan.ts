// Gerador de cronograma de estudos (ver docs/PRD.md §6 E1).
// Distribui blocos de estudo por dia, priorizando os assuntos mais fracos e
// respeitando o orçamento diário de minutos do estudante.

export interface PlanTopic {
  id: string;
  name: string;
  subjectName?: string;
}

export interface PlanSession {
  topicId: string;
  topicName: string;
  subjectName?: string;
  dayIndex: number;
  minutes: number;
}

export interface StudyPlanOptions {
  days?: number; // horizonte do plano (default 7)
  blockMinutes?: number; // duração-alvo de cada bloco (default 30)
}

/**
 * Monta as sessões de estudo. Os assuntos devem vir ordenados por prioridade
 * (mais fracos primeiro); eles são distribuídos ciclicamente, então os
 * primeiros aparecem mais cedo (e, se houver folga, com mais frequência).
 */
export function buildStudyPlan(
  topics: PlanTopic[],
  minutesPerDay: number,
  options: StudyPlanOptions = {},
): PlanSession[] {
  const days = options.days ?? 7;
  if (topics.length === 0 || minutesPerDay <= 0 || days <= 0) return [];

  const targetBlock = Math.max(1, options.blockMinutes ?? 30);
  const blocksPerDay = Math.max(1, Math.floor(minutesPerDay / targetBlock));
  const base = Math.floor(minutesPerDay / blocksPerDay);
  const remainder = minutesPerDay - base * blocksPerDay;

  const sessions: PlanSession[] = [];
  let cursor = 0;
  for (let day = 0; day < days; day++) {
    // Os minutos que sobram da divisão vão para os primeiros blocos do dia,
    // de modo que a soma diária seja exatamente `minutesPerDay`.
    let extra = remainder;
    for (let b = 0; b < blocksPerDay; b++) {
      const topic = topics[cursor % topics.length];
      cursor += 1;
      const minutes = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      sessions.push({
        topicId: topic.id,
        topicName: topic.name,
        subjectName: topic.subjectName,
        dayIndex: day,
        minutes,
      });
    }
  }
  return sessions;
}
