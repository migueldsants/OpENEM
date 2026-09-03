import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewService } from './review.service';

// Mock mínimo do PrismaService — só o que o ReviewService usa.
function makePrismaMock() {
  return {
    reviewItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    gamification: { recordActivity: jest.fn() },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new ReviewService(prisma, gamification);
  return { service, prisma, gamification };
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

describe('ReviewService.queue()', () => {
  it('lista itens vencidos (dueAt <= agora), do mais atrasado primeiro', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findMany = jest.fn().mockResolvedValue([]);
    await service.queue('u-1');
    const args = (prisma.reviewItem.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.userId).toBe('u-1');
    expect(args.where.dueAt.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ dueAt: 'asc' });
  });
});

describe('ReviewService.recordOutcome() — SM-2', () => {
  it('primeira tentativa cria o item com ease/intervalo do SM-2', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findUnique.mockResolvedValue(null); // sem item prévio

    await service.recordOutcome('u-1', 't-1', true);

    const arg = prisma.reviewItem.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({
      userId_topicId: { userId: 'u-1', topicId: 't-1' },
    });
    // quality 5 (acerto) na 1ª repetição: SM-2 dá bônus ao ease (2.5→2.6),
    // repetição 1 e intervalo de 1 dia.
    expect(arg.create).toMatchObject({
      userId: 'u-1',
      topicId: 't-1',
      easeFactor: 2.6,
      repetition: 1,
    });
  });

  it('erro (quality baixa) zera a repetição mas mantém o histórico', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findUnique.mockResolvedValue({
      userId: 'u-1',
      topicId: 't-1',
      easeFactor: 2.6,
      intervalD: 6,
      repetition: 3,
    });

    await service.recordOutcome('u-1', 't-1', false);

    const arg = prisma.reviewItem.upsert.mock.calls[0][0];
    // Erro: repetição volta a 0 e o intervalo reinicia.
    expect(arg.update).toMatchObject({ repetition: 0, intervalD: 1 });
    expect(arg.update.easeFactor).toBeLessThan(2.6); // ease penalizado
  });
});

describe('ReviewService.grade()', () => {
  const ITEM = {
    id: 'r-1',
    userId: 'u-1',
    topicId: 't-1',
    easeFactor: 2.5,
    intervalD: 0,
    repetition: 0,
  };

  it('retorna 404 para item inexistente', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findUnique.mockResolvedValue(null);
    await expect(service.grade('u-1', 'x', 4)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('retorna 403 para item de outro usuário', async () => {
    const { service, prisma } = makeService();
    prisma.reviewItem.findUnique.mockResolvedValue({
      ...ITEM,
      userId: 'outro',
    });
    await expect(service.grade('u-1', 'r-1', 4)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reagenda com a qualidade dada e credita XP de revisão', async () => {
    const { service, prisma, gamification } = makeService();
    prisma.reviewItem.findUnique.mockResolvedValue(ITEM);
    prisma.reviewItem.update = jest.fn().mockResolvedValue({
      ...ITEM,
      repetition: 1,
    });

    const res = await service.grade('u-1', 'r-1', 4);

    expect(prisma.reviewItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r-1' } }),
    );
    expect(gamification.recordActivity).toHaveBeenCalledWith(
      'u-1',
      'REVIEW',
      5, // POINTS.reviewGrade
      'Autoavaliação de revisão',
      expect.any(Date),
      { reviewsCount: 1 },
    );
    expect(res.repetition).toBe(1);
  });
});
