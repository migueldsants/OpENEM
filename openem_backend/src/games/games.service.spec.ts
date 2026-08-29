import { NotFoundException } from '@nestjs/common';
import { GamesService } from './games.service';

function makeService() {
  const prisma = {
    gameScore: { create: jest.fn(), groupBy: jest.fn() },
    gamificationStat: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  } as any;
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new GamesService(prisma, gamification);
  return { service, prisma, gamification };
}

describe('GamesService', () => {
  it('listGames() expõe o catálogo com níveis', () => {
    const { service } = makeService();
    const res = service.listGames();
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]).toHaveProperty('key');
    expect(Array.isArray(res[0].levels)).toBe(true);
  });

  describe('submitScore()', () => {
    it('retorna 404 para minigame inexistente', async () => {
      const { service } = makeService();
      await expect(
        service.submitScore('u1', {
          gameKey: 'nao-existe',
          score: 10,
          level: 1,
          durationSec: 5,
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('registra o score e credita XP de jogo', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.gameScore.create.mockResolvedValue({
        id: 'g1',
        gameKey: 'calculo-mental',
        score: 42,
        level: 2,
        durationSec: 30,
        createdAt: new Date(),
      });

      const res = await service.submitScore('u1', {
        gameKey: 'calculo-mental',
        score: 42,
        level: 2,
        durationSec: 30,
      } as never);

      expect(res.score).toBe(42);
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'GAME',
        expect.any(Number),
        expect.stringContaining('42'),
        expect.any(Date),
        {},
      );
    });
  });

  describe('leaderboard()', () => {
    it('retorna 404 para minigame inexistente', async () => {
      const { service } = makeService();
      await expect(service.leaderboard('nao-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('agrega melhor score e nº de partidas por usuário', async () => {
      const { service, prisma } = makeService();
      prisma.gameScore.groupBy.mockResolvedValue([
        { userId: 'u1', _max: { score: 100 }, _count: { _all: 3 } },
        { userId: 'u2', _max: { score: 80 }, _count: { _all: 1 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', profile: { displayName: 'Ana' } },
        { id: 'u2', profile: null },
      ]);

      const res = await service.leaderboard('calculo-mental', 10);
      expect(res).toEqual([
        { userId: 'u1', displayName: 'Ana', bestScore: 100, plays: 3 },
        { userId: 'u2', displayName: 'Estudante', bestScore: 80, plays: 1 },
      ]);
    });

    it('retorna vazio sem partidas', async () => {
      const { service, prisma } = makeService();
      prisma.gameScore.groupBy.mockResolvedValue([]);
      expect(await service.leaderboard('calculo-mental')).toEqual([]);
    });
  });

  describe('globalLeaderboard()', () => {
    it('usa points do GamificationStat como score', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u1', points: 1200 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', profile: { displayName: 'Ana' } },
      ]);

      const res = await service.globalLeaderboard(10);
      expect(res).toEqual([
        { userId: 'u1', displayName: 'Ana', bestScore: 1200, plays: 0 },
      ]);
      expect(prisma.gamificationStat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
