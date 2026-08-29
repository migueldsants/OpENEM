import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

function makePrisma() {
  return {
    question: { findUnique: jest.fn() },
    favorite: { upsert: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
  };
}

describe('FavoritesService', () => {
  it('add() valida a questão antes de favoritar', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue(null);
    const service = new FavoritesService(prisma);

    await expect(service.add('u1', 'nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('add() é idempotente (upsert)', async () => {
    const prisma = makePrisma() as any;
    prisma.question.findUnique.mockResolvedValue({ id: 'q1' });
    prisma.favorite.upsert.mockResolvedValue({ id: 'f1' });
    const service = new FavoritesService(prisma);

    await service.add('u1', 'q1');
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: { userId_questionId: { userId: 'u1', questionId: 'q1' } },
      create: { userId: 'u1', questionId: 'q1' },
      update: {},
    });
  });

  it('list() lista favoritos do usuário sem gabarito', async () => {
    const prisma = makePrisma() as any;
    prisma.favorite.findMany.mockResolvedValue([]);
    const service = new FavoritesService(prisma);

    await service.list('u1');
    const arg = prisma.favorite.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1' });
    expect(JSON.stringify(arg.select)).not.toContain('isCorrect');
  });

  it('remove() é idempotente', async () => {
    const prisma = makePrisma() as any;
    prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
    const service = new FavoritesService(prisma);

    const res = await service.remove('u1', 'q1');
    expect(res).toEqual({ removed: true });
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', questionId: 'q1' },
    });
  });
});
