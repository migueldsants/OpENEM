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
});
