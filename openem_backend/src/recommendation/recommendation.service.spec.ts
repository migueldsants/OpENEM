import { RecommendationService } from './recommendation.service';

function makePrisma() {
  return {
    answer: { findMany: jest.fn() },
    // count = 1: há uma questão nova disponível para os fillers sortearem.
    question: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(1) },
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
    // A busca exclui as já respondidas por anti-join, não por lista de ids —
    // o `notIn` antigo crescia com o histórico do aluno.
    const where = prisma.question.findMany.mock.calls[0][0].where;
    expect(where.topicId).toBe('t-fraco');
    expect(where.answers).toEqual({ none: { userId: 'u1' } });
    expect(where.id).toBeUndefined();
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

describe('RecommendationService — respostas sem assunto classificado', () => {
  it('ignora topicId nulo no ranking e cai nos fillers', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([
      { questionId: 'q1', isCorrect: false, question: { topicId: null } },
      { questionId: 'q2', isCorrect: false, question: { topicId: null } },
    ]);
    // Sem assunto no ranking, a única chamada é a de cobertura.
    prisma.question.findMany.mockResolvedValueOnce([
      { id: 'filler', statement: 'b', topic: null },
    ]);
    const service = new RecommendationService(prisma);

    const res = await service.next('u1', 1);

    expect(res).toHaveLength(1);
    expect(prisma.question.findMany).toHaveBeenCalledTimes(1);
    // Sem where.topicId: é a busca de cobertura, não a de reforço.
    const where = prisma.question.findMany.mock.calls[0][0].where;
    expect(where.topicId).toBeUndefined();
    expect(where.answers).toEqual({ none: { userId: 'u1' } });
  });
});

describe('RecommendationService — janela de histórico', () => {
  it('lê só as respostas recentes, com teto', async () => {
    const prisma = makePrisma() as any;
    prisma.answer.findMany.mockResolvedValue([]);
    prisma.question.findMany.mockResolvedValueOnce([]);
    const service = new RecommendationService(prisma);

    await service.next('u1', 3);

    const args = prisma.answer.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe('u1');
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.take).toBeGreaterThan(0);
  });
});
