import { ACHIEVEMENTS } from '../common/gamification';
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
      count: jest.fn().mockResolvedValue(0),
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([]),
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

      // Atividade: 10 * 1.0 + bônus 15 = 25; + FIRST_ANSWER (50 XP, issue
      // #48) desbloqueada na 1ª resposta = 75.
      expect(delta!.breakdown).toEqual({
        base: 10,
        comboMultiplier: 1,
        dailyBonus: 15,
        achievementXp: 50,
      });
      expect(delta!.xpGained).toBe(75);
      expect(delta!.newAchievements.map((a) => a.code)).toContain(
        'FIRST_ANSWER',
      );
      expect(delta!.streakIncremented).toBe(true);
      expect(delta!.currentStreak).toBe(1);
      expect(tx.gamificationStat.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: expect.objectContaining({ points: 75, currentStreak: 1 }),
      });
      expect(tx.xpLog.create).toHaveBeenCalledWith({
        data: { userId: 'u1', action: 'ANSWER', xpGained: 25, detail: null },
      });
      // O bônus de conquista ganha um log ACHIEVEMENT próprio (issue #48).
      expect(tx.xpLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ACHIEVEMENT',
          xpGained: 50,
          detail: expect.stringContaining('Primeiro passo'),
        }),
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
      // Streak 5 -> combo 1.4; mesmo dia (sem bônus). Conquistas de contagem
      // já desbloqueadas — isola o teste do bônus de conquista.
      tx.gamificationStat.upsert.mockResolvedValue({
        ...STAT,
        points: 400,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityOn: new Date('2026-08-29T00:00:00Z'),
        answersCount: 10,
        correctCount: 10,
      });
      tx.userAchievement.findMany.mockResolvedValue([
        { code: 'FIRST_ANSWER' },
        { code: 'TEN_ANSWERS' },
        { code: 'TEN_CORRECT' },
        { code: 'STREAK_3' },
        { code: 'STREAK_7' },
        { code: 'POINTS_500' },
        { code: 'REACH_LEVEL_5' },
      ]);

      const delta = await service.recordAnswer(
        'u1',
        true,
        new Date('2026-08-29T15:00:00Z'),
      );

      // Atividade: 10 * 1.4 = 14; sem novas conquistas.
      expect(delta!.xpGained).toBe(14);
      expect(delta!.breakdown.achievementXp).toBe(0);
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

  describe('desafio diário no dia de Brasília', () => {
    // 22h de 21/10 em Brasília = 01h de 22/10 em UTC.
    const NOITE = new Date('2026-10-22T01:00:00Z');

    it('conta as respostas desde a meia-noite de Brasília e usa a chave do dia local', async () => {
      const { service, prisma } = makeService();
      prisma.answer = { count: jest.fn().mockResolvedValue(3) };
      prisma.dailyChallengeLog.findUnique.mockResolvedValue(null);

      const res = await service.getDailyChallenge('u1', NOITE);

      expect(res).toMatchObject({ day: '2026-10-21', progress: 3 });
      expect(prisma.answer.count).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          createdAt: { gte: new Date('2026-10-21T03:00:00Z') },
        },
      });
      expect(prisma.dailyChallengeLog.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_day: { userId: 'u1', day: '2026-10-21' } },
        }),
      );
    });

    it('o resgate grava a chave do dia de Brasília e o XP no XpLog', async () => {
      const { service, tx } = makeService();
      tx.answer.count.mockResolvedValue(999);
      tx.gamificationStat.upsert.mockResolvedValue({ ...STAT, points: 300 });

      const res = await service.claimDailyChallenge('u1', NOITE);

      expect(tx.dailyChallengeLog.create).toHaveBeenCalledWith({
        data: { userId: 'u1', day: '2026-10-21' },
      });
      const xpAwarded = (res as { xpAwarded: number }).xpAwarded;
      expect(xpAwarded).toBeGreaterThan(0);
      expect(tx.xpLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          action: 'DAILY_CHALLENGE',
          xpGained: xpAwarded,
        }),
      });
    });

    it('resgate repetido não grava outro XpLog', async () => {
      const { service, tx } = makeService();
      tx.answer.count.mockResolvedValue(999);
      tx.dailyChallengeLog.create.mockRejectedValue({ code: 'P2002' });

      await service.claimDailyChallenge('u1', NOITE);
      expect(tx.xpLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getHistory()', () => {
    it('agrupa o XP pelo dia de Brasília', async () => {
      const { service, prisma } = makeService();
      prisma.xpLog.findMany.mockResolvedValue([
        // 22h de 21/10 em Brasília
        { xpGained: 30, createdAt: new Date('2026-10-22T01:00:00Z') },
        { xpGained: 10, createdAt: new Date('2026-10-21T15:00:00Z') },
        // 01h de 22/10 em Brasília
        { xpGained: 5, createdAt: new Date('2026-10-22T04:00:00Z') },
      ]);

      const res = await service.getHistory(
        'u1',
        30,
        new Date('2026-10-22T12:00:00Z'),
      );

      expect(res).toMatchObject({
        byDay: [
          { day: '2026-10-21', xp: 40 },
          { day: '2026-10-22', xp: 5 },
        ],
      });
      const where = prisma.xpLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2026-09-22T03:00:00Z'));
    });
  });

  describe('listAchievements()', () => {
    it('{ enabled: false } com a gamificação desligada', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: false,
      });
      await expect(service.listAchievements('u1')).resolves.toEqual({
        enabled: false,
      });
    });

    it('esconde as de redação de quem não as tem e mantém as já desbloqueadas', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findUnique.mockResolvedValue(STAT);

      const nenhuma = (await service.listAchievements('u1')) as {
        code: string;
      }[];
      expect(nenhuma.map((a) => a.code)).not.toContain('FIRST_ESSAY');

      prisma.userAchievement.findMany.mockResolvedValue([
        { code: 'FIRST_ESSAY', unlockedAt: new Date('2026-01-10') },
      ]);
      const comRedacao = (await service.listAchievements('u1')) as {
        code: string;
        unlocked: boolean;
      }[];
      const essay = comRedacao.find((a) => a.code === 'FIRST_ESSAY');
      expect(essay?.unlocked).toBe(true);
      expect(comRedacao.map((a) => a.code)).not.toContain('HIGH_SCORE_ESSAY');
      expect(comRedacao).toHaveLength(nenhuma.length + 1);
    });
  });

  describe('getSummary()', () => {
    it('o total de conquistas não conta as aposentadas que o aluno não tem', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findUnique.mockResolvedValue(STAT);
      prisma.userAchievement.findMany.mockResolvedValue([
        { code: 'FIRST_ANSWER' },
        { code: 'HIGH_SCORE_ESSAY' },
      ]);

      const res = await service.getSummary('u1');
      expect(res).toMatchObject({
        achievementsUnlocked: 2,
        achievementsTotal: ACHIEVEMENTS.filter((a) => !a.retired).length + 1,
      });
    });
  });

  describe('leaderboard()', () => {
    type Board = {
      league: string | null;
      entries: { userId: string; rank: number; isMe: boolean }[];
    };

    it('{ enabled: false } para quem desligou a gamificação', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue({
        gamificationEnabled: false,
      });
      await expect(service.leaderboard('u1')).resolves.toEqual({
        enabled: false,
      });
      expect(prisma.gamificationStat.findMany).not.toHaveBeenCalled();
    });

    it('escopo global usa take no banco, numera o top e marca o solicitante', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findUnique.mockResolvedValue({ points: 100 });
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u2', points: 500 },
        { userId: 'u1', points: 100 },
      ]);
      prisma.gamificationStat.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u2', profile: { nickname: 'Ana' } },
        { id: 'u1', profile: { nickname: 'Eu' } },
      ]);

      const res = (await service.leaderboard('u1', 'global', 10)) as Board;

      expect(prisma.gamificationStat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: [{ points: 'desc' }, { userId: 'asc' }],
        }),
      );
      expect(res.entries).toEqual([
        expect.objectContaining({
          userId: 'u2',
          nickname: 'Ana',
          rank: 1,
          isMe: false,
        }),
        expect.objectContaining({ userId: 'u1', rank: 2, isMe: true }),
      ]);
    });

    it('fora do top, o solicitante vem no fim com a posição real', async () => {
      const { service, prisma } = makeService();
      prisma.gamificationStat.findUnique.mockResolvedValue({ points: 20 });
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u2', points: 500 },
        { userId: 'u3', points: 300 },
      ]);
      prisma.gamificationStat.count.mockResolvedValue(41);

      const res = (await service.leaderboard('u1', 'global', 2)) as Board;

      expect(res.entries.map((e) => [e.userId, e.rank])).toEqual([
        ['u2', 1],
        ['u3', 2],
        ['u1', 42],
      ]);
      // A posição conta quem está à frente, com o mesmo filtro do ranking.
      const countWhere = prisma.gamificationStat.count.mock.calls[0][0].where;
      expect(countWhere.AND[1]).toEqual({
        OR: [{ points: { gt: 20 } }, { points: 20, userId: { lt: 'u1' } }],
      });
    });

    it('quem desligou a gamificação não entra no ranking dos outros', async () => {
      const { service, prisma } = makeService();
      await service.leaderboard('u1', 'global', 10);
      const where = prisma.gamificationStat.findMany.mock.calls[0][0].where;
      expect(where.NOT).toEqual({
        user: { profile: { is: { gamificationEnabled: false } } },
      });
    });

    it('escopo de liga filtra no banco pela faixa de XP da liga (issue #49)', async () => {
      const { service, prisma } = makeService();
      // Solicitante com 1000 XP -> nível 7 -> liga Prata (níveis 5..9).
      prisma.gamificationStat.findUnique.mockResolvedValue({ points: 1000 });
      prisma.gamificationStat.findMany.mockResolvedValue([
        { userId: 'u1', points: 1000 },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', profile: { nickname: 'Eu' } },
      ]);

      const res = (await service.leaderboard('u1', 'league', 10)) as Board;

      const arg = prisma.gamificationStat.findMany.mock.calls[0][0];
      // Prata: XP >= 25*(5-1)^2 = 400; Ouro começa em 25*(10-1)^2 = 2025.
      expect(arg.where.points.gte).toBe(400);
      expect(arg.where.points.lt).toBe(2025);
      expect(arg.take).toBe(10);
      expect(res.league).toBe('Prata');
      expect(res.entries).toEqual([
        expect.objectContaining({ userId: 'u1', rank: 1, isMe: true }),
      ]);
    });
  });
});
