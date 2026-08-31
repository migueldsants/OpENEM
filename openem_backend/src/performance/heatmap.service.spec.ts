import { HeatmapService } from './heatmap.service';

function makePrisma() {
  return {
    answer: { findMany: jest.fn() },
    subjectArea: { findMany: jest.fn() },
  };
}

describe('HeatmapService (issue #43)', () => {
  it('cobre TODOS os tópicos da taxonomia, mesmo sem respostas', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([
      { isCorrect: true, question: { topicId: 't1' } },
      { isCorrect: false, question: { topicId: 't1' } },
    ]);
    prisma.subjectArea.findMany.mockResolvedValue([
      {
        id: 'area-mat',
        name: 'Matemática e suas Tecnologias',
        subjects: [
          {
            id: 'subj-mat',
            name: 'Matemática',
            topics: [
              { id: 't1', name: 'Funções', weight: 5 },
              { id: 't2', name: 'Probabilidade', weight: 3 },
            ],
          },
        ],
      },
    ]);
    const service = new HeatmapService(prisma);

    const res = await service.heatmap('u1');

    expect(res).toHaveLength(1);
    const area = res[0];
    expect(area.name).toBe('Matemática e suas Tecnologias');
    const topics = area.subjects[0].topics;
    expect(topics).toHaveLength(2);
    // Tópico respondido: 1/2 = 50%.
    expect(topics[0]).toMatchObject({
      id: 't1',
      total: 2,
      correct: 1,
      accuracy: 50,
      weight: 5,
    });
    // Tópico nunca respondido: aparece com 0 (neutro no grid).
    expect(topics[1]).toMatchObject({ id: 't2', total: 0, accuracy: 0 });
  });

  it('consulta apenas as respostas do usuário', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([]);
    prisma.subjectArea.findMany.mockResolvedValue([]);
    const service = new HeatmapService(prisma);

    await service.heatmap('u-qualquer');
    expect(prisma.answer.findMany).toHaveBeenCalledWith({
      where: { userId: 'u-qualquer' },
      select: {
        isCorrect: true,
        question: { select: { topicId: true } },
      },
    });
  });

  it('ordena áreas, matérias e tópicos por nome', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([]);
    prisma.subjectArea.findMany.mockImplementation(
      (args: { orderBy: { name: 'asc' } }) => {
        expect(args.orderBy).toEqual({ name: 'asc' });
        return [];
      },
    );
    const service = new HeatmapService(prisma);
    await expect(service.heatmap('u1')).resolves.toEqual([]);
  });
});
