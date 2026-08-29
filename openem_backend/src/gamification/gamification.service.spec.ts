import { GamificationService } from './gamification.service';

function makePrismaMock() {
  const tx = {
    gamificationStat: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    xpLog: { create: jest.fn().mockResolvedValue({}) },
    dailyChallengeLog: { create: jest.fn().mockResolvedValue({}) },
    answer: { count: jest.fn() },
  };
  return {
    profile: { findUnique: jest.fn() },
    gamificationStat: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    xpLog: { findMany: jest.fn().mockResolvedValue([]) },
    dailyChallengeLog: { findUnique: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  const service = new GamificationService(prisma);
  return { service, prisma, tx: prisma.__tx };
}

const STAT = {
  id: 'gs1',
  userId: 'u1',
  points: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActivityOn: null,
  answersCount: 0,
  correctCount: 0,
  simulationsCount: 0,
  essaysCount: 0,
  highScoreEssays: 0,
  reviewsCount: 0,
  sessionsDone: 0,
};

describe('GamificationService', () => {
  describe('recordAnswer()', () => {
    it('é no-op quando a gamificação está desativada no perfil', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: false,
      });
      expect(await service.recordAnswer('u1', true)).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('credita XP, incrementa streak no 1º dia e loga no XpLog', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.gamificationStat.upsert.mockResolvedValue({ ...STAT });

      const delta = await service.recordAnswer(
        'u1',
        true,
        new Date('2026-08-29T12:00:00Z'),
      );

      // 10 XP base * combo 1.0 + bônus diário 15 (streak 1) = 25.
      expect(delta!.xpGained).toBe(25);
      expect(delta!.breakdown).toEqual({
        base: 10,
        comboMultiplier: 1,
        dailyBonus: 15,
      });
      expect(delta!.streakIncremented).toBe(true);
      expect(delta!.currentStreak).toBe(1);
      expect(tx.gamificationStat.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: expect.objectContaining({ points: 25, currentStreak: 1 }),
      });
      expect(tx.xpLog.create).toHaveBeenCalledWith({
        data: { userId: 'u1', action: 'ANSWER', xpGained: 25, detail: null },
      });
    });

    it('desbloqueia conquistas atingidas e as retorna no delta', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.gamificationStat.upsert.mockResolvedValue({ ...STAT });
      tx.userAchievement.findMany.mockResolvedValue([]);

      const delta = await service.recordAnswer('u1', true);

      const codes = delta!.newAchievements.map((a) => a.code);
      expect(codes).toContain('FIRST_ANSWER');
      expect(tx.userAchievement.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ code: 'FIRST_ANSWER' }),
        ]),
      });
    });

    it('aplica combo de streak no XP de resposta', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      // Streak 5 -> combo 1.4; mesmo dia (sem bônus).
      tx.gamificationStat.upsert.mockResolvedValue({
        ...STAT,
        points: 400,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityOn: new Date('2026-08-29T00:00:00Z'),
        answersCount: 10,
        correctCount: 10,
      });

      const delta = await service.recordAnswer(
        'u1',
        true,
        new Date('2026-08-29T15:00:00Z'),
      );

      // 10 * 1.4 = 14 (arredondado).
      expect(delta!.xpGained).toBe(14);
      expect(delta!.streakIncremented).toBe(false);
      expect(delta!.currentStreak).toBe(5);
    });
  });

  describe('claimDailyChallenge()', () => {
    it('recusa quando o objetivo do dia não foi atingido', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.answer.count.mockResolvedValue(0);

      const res = await service.claimDailyChallenge('u1', new Date());
      expect(res).toMatchObject({
        claimed: false,
        reason: 'incompleto',
        xpAwarded: 0,
      });
    });

    it('credita XP e marca o resgate uma vez por dia', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.answer.count.mockResolvedValue(999);
      tx.gamificationStat.upsert.mockResolvedValue({ ...STAT, points: 100 });

      const res = await service.claimDailyChallenge('u1', new Date());
      expect(res).toMatchObject({
        claimed: true,
        xpAwarded: expect.any(Number),
      });
      expect(tx.dailyChallengeLog.create).toHaveBeenCalled();
    });

    it('segundo resgate no mesmo dia responde ja_resgatado sem creditar XP', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.answer.count.mockResolvedValue(999);
      tx.dailyChallengeLog.create.mockRejectedValue({ code: 'P2002' });

      const res = await service.claimDailyChallenge('u1', new Date());
      expect(res).toMatchObject({
        claimed: true,
        reason: 'ja_resgatado',
        xpAwarded: 0,
      });
      // O upsert do stat só ocorre com log criado — aqui não deve ter sido chamado.
      expect(tx.gamificationStat.upsert).toHaveBeenCalledTimes(0);
    });

    it('erro de banco que não seja P2002 é propagado (issue #49)', async () => {
      const { service, prisma, tx } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      tx.answer.count.mockResolvedValue(999);
      tx.dailyChallengeLog.create.mockRejectedValue(
        new Error('database is locked'),
      );

      await expect(
        service.claimDailyChallenge('u1', new Date()),
      ).rejects.toThrow('database is locked');
    });
  });

  describe('leaderboard()', () => {
    it('escopo global usa take no banco e inclui o solicitante', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u2', points: 500 },
        { userId: 'u3', points: 100 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u2', profile: { displayName: 'Ana' } },
        { id: 'u3', profile: { displayName: 'Bia' } },
        { id: 'u1', profile: { displayName: 'Eu' } },
      ]);

      const res = await service.leaderboard('u1', 'global', 10);

      expect(prisma.gamificationStat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
      expect(res.entries.map((e) => e.userId)).toEqual(['u2', 'u3', 'u1']);
    });

    it('escopo de liga filtra no banco pela faixa de XP da liga (issue #49)', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: true,
      });
      // Solicitante com 1000 XP -> nível 7 -> liga Prata (níveis 5..9).
      prisma.gamificationStat.findUnique.mockResolvedValue({ points: 1000 });
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u1', points: 1000 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', profile: { displayName: 'Eu' } },
      ]);

      const res = await service.leaderboard('u1', 'league', 10);

      const arg = prisma.gamificationStat.findMany.mock.calls[0][0];
      expect(arg.where).toBeDefined();
      // Prata: XP >= 25*(5-1)^2 = 400; Ouro começa em 25*(10-1)^2 = 2025.
      expect(arg.where.points.gte).toBe(400);
      expect(arg.where.points.lt).toBe(2025);
      expect(res.league).toBe('Prata');
    });
  });
});
