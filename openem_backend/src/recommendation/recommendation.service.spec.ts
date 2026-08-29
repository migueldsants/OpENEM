import { RecommendationService } from './recommendation.service';

function makePrisma() {
  return {
    answer: { findMany: jest.fn() },
    question: { findMany: jest.fn() },
  };
}

describe('RecommendationService', () => {
  it('prioriza questões novas dos assuntos com mais erros', async () => {
    const prisma = makePrisma() as any;
    // Usuário errou 2 de 2 em t-fraco e acertou 1 de 1 em t-forte.
    prisma.answer.findMany.mockResolvedValue([
      { questionId: 'q1', isCorrect: false, question: { topicId: 't-fraco' } },
      { questionId: 'q2', isCorrect: false, question: { topicId: 't-fraco' } },
      { questionId: 'q3', isCorrect: true, question: { topicId: 't-forte' } },
    ]);
    prisma.question.findMany
      .mockResolvedValueOnce([
        { id: 'q-nova-1', statement: 'a', topic: { id: 't-fraco' } },
      ]) // busca do tópico fraco
      .mockResolvedValueOnce([]); // fillers (não necessário)
    const service = new RecommendationService(prisma);

    const res = await service.next('u1', 1);

    expect(res).toHaveLength(1);
    expect((res[0].question as { id: string }).id).toBe('q-nova-1');
    expect(typeof res[0].reason).toBe('string');
    // A busca exclui as questões já respondidas.
    const where = prisma.question.findMany.mock.calls[0][0].where;
    expect(where.topicId).toBe('t-fraco');
    expect(where.id.notIn).toContain('q1');
  });

  it('completa com fillers de qualquer assunto quando faltam', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([]);
    // Sem tópicos fracos: a única chamada é a de fillers.
    prisma.question.findMany.mockResolvedValueOnce([
      { id: 'filler', statement: 'b', topic: { id: 't-x' } },
    ]);
    const service = new RecommendationService(prisma);

    const res = await service.next('u1', 5);
    expect(res).toHaveLength(1);
    expect((res[0].question as { id: string }).id).toBe('filler');
    expect(res[0].reason).toBe('Para ampliar seu repertório');
  });

  it('sem histórico recomenda qualquer questão nova', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([]);
    prisma.question.findMany.mockResolvedValueOnce([
      { id: 'q9', statement: 'c', topic: { id: 't-9' } },
    ]);
    const service = new RecommendationService(prisma);

    const res = await service.next('u1', 3);
    expect(res).toHaveLength(1);
    expect((res[0].question as { id: string }).id).toBe('q9');
  });
});
