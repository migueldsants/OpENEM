import { PerformanceService } from './performance.service';

// Mock mínimo do PrismaService — só o que o overview() usa (answer.findMany).
function makePrismaMock() {
  return {
    answer: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  return { service: new PerformanceService(prisma), prisma };
}

describe('PerformanceService.overview() — filtro de período', () => {
  it('period=7d restringe answers a createdAt >= agora-7d', async () => {
    const { service, prisma } = makeService();
    await service.overview('u-1', '7d');
    const where = prisma.answer.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u-1');
    expect(where.createdAt).toBeDefined();
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    const ageMs = Date.now() - where.createdAt.gte.getTime();
    expect(ageMs).toBeGreaterThan(6 * 86_400_000);
    expect(ageMs).toBeLessThan(8 * 86_400_000);
  });

  it('period=30d restringe answers a createdAt >= agora-30d', async () => {
    const { service, prisma } = makeService();
    await service.overview('u-1', '30d');
    const where = prisma.answer.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    const ageMs = Date.now() - where.createdAt.gte.getTime();
    expect(ageMs).toBeGreaterThan(29 * 86_400_000);
    expect(ageMs).toBeLessThan(31 * 86_400_000);
  });

  it('period=all NÃO restringe createdAt', async () => {
    const { service, prisma } = makeService();
    await service.overview('u-1', 'all');
    const where = prisma.answer.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u-1');
    expect(where.createdAt).toBeUndefined();
  });

  it('retorna estrutura vazia coerente quando não há respostas', async () => {
    const { service } = makeService();
    const result = await service.overview('u-1', '7d');
    expect(result.overall.total).toBe(0);
    expect(result.bySubject).toEqual([]);
    expect(result.timeline).toEqual([]);
  });

  // ---- Agregação (issue #47: mata mutantes do sumarizador) ----

  const SUBJECT = { id: 's1', name: 'Matemática' };
  const TOPIC = { id: 't1', name: 'Funções', subject: SUBJECT };
  const TOPIC2 = { id: 't2', name: 'Probabilidade', subject: SUBJECT };

  function answer(
    correct: boolean,
    topic: typeof TOPIC,
    iso: string,
  ) {
    return {
      isCorrect: correct,
      createdAt: new Date(iso),
      question: { topic },
    };
  }

  it('agrega overall/bySubject/byTopic com precisão arredondada', async () => {
    const { service, prisma } = makeService();
    prisma.answer.findMany.mockResolvedValue([
      answer(true, TOPIC, '2026-09-01T10:00:00Z'),
      answer(true, TOPIC, '2026-09-01T11:00:00Z'),
      answer(false, TOPIC2, '2026-09-01T12:00:00Z'),
      answer(false, TOPIC2, '2026-09-01T12:30:00Z'),
    ]);

    const res = await service.overview('u-1', 'all');
    // Overall: 2/4 = 50%.
    expect(res.overall).toEqual({ total: 4, correct: 2, accuracy: 50 });
    // Matéria: 2/4 = 50%.
    expect(res.bySubject).toEqual([
      { id: 's1', name: 'Matemática', total: 4, correct: 2, accuracy: 50 },
    ]);
    // Tópicos: Funções 100%, Probabilidade 0%.
    const funcoes = res.byTopic.find((t) => t.id === 't1');
    const prob = res.byTopic.find((t) => t.id === 't2');
    expect(funcoes).toMatchObject({ total: 2, correct: 2, accuracy: 100 });
    expect(prob).toMatchObject({ total: 2, correct: 0, accuracy: 0 });
    // Weakest: o de menor precisão primeiro.
    expect(res.weakestTopics[0].id).toBe('t2');
    expect(res.weakestTopics).toHaveLength(2);
    // Recent (últimas 20): todas as 4.
    expect(res.recent).toEqual({ total: 4, correct: 2, accuracy: 50 });
  });

  it('timeline agrupa por dia com precisão diária', async () => {
    const { service, prisma } = makeService();
    prisma.answer.findMany.mockResolvedValue([
      answer(true, TOPIC, '2026-09-01T10:00:00Z'),
      answer(false, TOPIC, '2026-09-01T20:00:00Z'),
      answer(true, TOPIC, '2026-09-02T10:00:00Z'),
    ]);

    const res = await service.overview('u-1', 'all');
    expect(res.timeline).toEqual([
      { date: '2026-09-01', total: 2, correct: 1, accuracy: 50 },
      { date: '2026-09-02', total: 1, correct: 1, accuracy: 100 },
    ]);
  });

  it('accuracy com 0 tentativas é 0 (sem divisão por zero)', async () => {
    const { service } = makeService();
    const res = await service.overview('u-1', 'all');
    expect(res.overall.accuracy).toBe(0);
    expect(res.recent.accuracy).toBe(0);
  });
});
