import { buildStudyPlan, PlanSubject } from './study-plan';

const SUBJECTS: PlanSubject[] = [
  { id: 'mat', name: 'Matemática' },
  { id: 'fis', name: 'Física' },
  { id: 'bio', name: 'Biologia' },
  { id: 'his', name: 'História' },
];

describe('buildStudyPlan (issue #46 — plano por matéria)', () => {
  it('respeita o horizonte e o orçamento diário de minutos', () => {
    const blocks = buildStudyPlan(SUBJECTS, 90, { days: 7 });
    const days = new Set(blocks.map((b) => b.dayIndex));
    expect(days.size).toBe(7);

    for (const day of days) {
      const total = blocks
        .filter((b) => b.dayIndex === day)
        .reduce((sum, b) => sum + b.minutes, 0);
      expect(total).toBe(90);
    }
  });

  it('não repete a mesma matéria dentro de um dia', () => {
    const blocks = buildStudyPlan(SUBJECTS, 180, { days: 5 });
    for (const day of new Set(blocks.map((b) => b.dayIndex))) {
      const labels = blocks
        .filter((b) => b.dayIndex === day)
        .map((b) => b.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('espalha as matérias pela semana em vez de insistir em duas', () => {
    // Regressão: o gerador antigo pegava os 5 tópicos alfabeticamente
    // primeiros, o que concentrava a semana em poucas matérias.
    const blocks = buildStudyPlan(SUBJECTS, 120, { days: 7 });
    expect(new Set(blocks.map((b) => b.label)).size).toBe(SUBJECTS.length);
  });

  it('carrega o subjectId quando a matéria vem do catálogo', () => {
    const blocks = buildStudyPlan(SUBJECTS, 60, { days: 1 });
    expect(blocks[0].subjectId).toBe('mat');
    expect(blocks[0].label).toBe('Matemática');
    expect(blocks[0].position).toBe(0);
  });

  it('aceita matéria livre, sem id de catálogo', () => {
    const blocks = buildStudyPlan([{ name: 'Inglês' }], 60, { days: 1 });
    expect(blocks[0]).toMatchObject({ label: 'Inglês', subjectId: null });
  });

  it('limita os blocos por dia mesmo com muito tempo disponível', () => {
    const blocks = buildStudyPlan(SUBJECTS, 600, { days: 1 });
    expect(blocks).toHaveLength(4); // maxBlocksPerDay padrão
    expect(blocks.reduce((sum, b) => sum + b.minutes, 0)).toBe(600);
  });

  it('gera ao menos um bloco quando o tempo é menor que um bloco', () => {
    const blocks = buildStudyPlan(SUBJECTS, 20, { days: 2 });
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.minutes === 20)).toBe(true);
  });

  it('retorna vazio para entradas degeneradas', () => {
    expect(buildStudyPlan([], 60)).toEqual([]);
    expect(buildStudyPlan(SUBJECTS, 0)).toEqual([]);
    expect(buildStudyPlan(SUBJECTS, 60, { days: 0 })).toEqual([]);
  });
});
