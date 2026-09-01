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
 *
 * Distribuição por matéria (issue #46): os blocos de um dia são agrupados em
 * UMA matéria dominante — "hoje é dia de Biologia" — e as matérias rotacionam
 * entre os dias (round-robin pelas matérias únicas dos tópicos priorizados).
 * Dentro da matéria do dia, os tópicos seguem a ordem de prioridade.
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

  // Matérias únicas na ordem de prioridade (primeira aparição vence).
  const subjects: string[] = [];
  for (const t of topics) {
    const s = t.subjectName ?? 'Geral';
    if (!subjects.includes(s)) subjects.push(s);
  }
  // Tópicos agrupados por matéria, preservando prioridade dentro de cada uma.
  const bySubject = new Map<string, PlanTopic[]>();
  for (const t of topics) {
    const s = t.subjectName ?? 'Geral';
    bySubject.set(s, [...(bySubject.get(s) ?? []), t]);
  }
  // Cursor de tópico por matéria (avança conforme a matéria é usada).
  const cursorBySubject = new Map<string, number>(
    subjects.map((s) => [s, 0]),
  );

  const sessions: PlanSession[] = [];
  for (let day = 0; day < days; day++) {
    // Matéria dominante do dia: round-robin entre as matérias.
    const subject = subjects[day % subjects.length];
    const topicList = bySubject.get(subject) ?? [];
    const start = cursorBySubject.get(subject) ?? 0;
    // Os minutos que sobram da divisão vão para os primeiros blocos do dia,
    // de modo que a soma diária seja exatamente `minutesPerDay`.
    let extra = remainder;
    for (let b = 0; b < blocksPerDay; b++) {
      // Blocos do dia cobrem tópicos distintos (janela deslizante na
      // prioridade); com menos tópicos que blocos, o ciclo se repete.
      const topic = topicList[(start + b) % topicList.length];
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
    // O próximo dia desta matéria continua de onde parou (janela avança).
    cursorBySubject.set(
      subject,
      topicList.length > 0 ? (start + blocksPerDay) % topicList.length : 0,
    );
  }
  return sessions;
}
