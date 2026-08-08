import { ReviewService } from './review.service';

// Mock mínimo do PrismaService — só o que o ReviewService.next() usa.
function makePrismaMock() {
  return {
    reviewItem: {
      findFirst: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  // O construtor injeta PrismaService + GamificationService; o next() só usa
  // o prisma, então passamos undefined para o gamification.
  return { service: new ReviewService(prisma, undefined as any), prisma };
}

describe('ReviewService.next()', () => {
  it('busca o item com dueAt > agora, ordenado por dueAt asc', async () => {
    const { service, prisma } = makeService();
    const future = new Date(Date.now() + 86_400_000);
    prisma.reviewItem.findFirst.mockResolvedValue({
      id: 'r-1',
      topicId: 't-1',
      intervalD: 1,
      repetition: 1,
      dueAt: future,
      topic: {
        id: 't-1',
        name: 'Funções',
        subject: { id: 's-1', name: 'Matemática' },
      },
    });

    const result = await service.next('u-1');

    expect(prisma.reviewItem.findFirst).toHaveBeenCalledTimes(1);
    const args = prisma.reviewItem.findFirst.mock.calls[0][0];
    expect(args.orderBy).toEqual({ dueAt: 'asc' });
    expect(args.where.userId).toBe('u-1');
    expect(args.where.dueAt.gt).toBeInstanceOf(Date);
    expect(args.where.dueAt.gt.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(result?.id).toBe('r-1');
    expect(result?.topic.name).toBe('Funções');
  });

  it('retorna null quando não há revisão futura agendada', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findFirst.mockResolvedValue(null);
    const result = await service.next('u-1');
    expect(result).toBeNull();
  });
});
