import { buildStudyPlan, PlanTopic } from './study-plan';

const topics: PlanTopic[] = [
  { id: 't1', name: 'Funções', subjectName: 'Matemática' },
  { id: 't2', name: 'Cinemática', subjectName: 'Natureza' },
  { id: 't3', name: 'Probabilidade', subjectName: 'Matemática' },
];

describe('buildStudyPlan', () => {
  it('retorna vazio sem assuntos ou sem tempo', () => {
    expect(buildStudyPlan([], 60)).toEqual([]);
    expect(buildStudyPlan(topics, 0)).toEqual([]);
  });

  it('respeita o orçamento diário de minutos', () => {
    const sessions = buildStudyPlan(topics, 90, { days: 7, blockMinutes: 30 });
    for (let day = 0; day < 7; day++) {
      const total = sessions
        .filter((s) => s.dayIndex === day)
        .reduce((sum, s) => sum + s.minutes, 0);
      expect(total).toBe(90);
    }
  });

  it('cobre o número de dias pedido', () => {
    const sessions = buildStudyPlan(topics, 60, { days: 5 });
    const days = new Set(sessions.map((s) => s.dayIndex));
    expect(days.size).toBe(5);
    expect(Math.max(...days)).toBe(4);
  });

  it('prioriza os assuntos mais fracos (primeiros aparecem antes)', () => {
    const sessions = buildStudyPlan(topics, 30, { days: 3, blockMinutes: 30 });
    // 1 bloco por dia: o assunto mais fraco (t1) ocupa o primeiro slot.
    expect(sessions[0].topicId).toBe('t1');
  });

  it('garante ao menos um bloco por dia mesmo com pouco tempo', () => {
    const sessions = buildStudyPlan(topics, 10, { days: 2, blockMinutes: 30 });
    expect(sessions.filter((s) => s.dayIndex === 0)).toHaveLength(1);
    expect(sessions[0].minutes).toBe(10);
  });
});
