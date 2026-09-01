import { BadRequestException, NotFoundException } from '@nestjs/common';
import { weekStartOf, WeeklyGoalsService } from './weekly-goals.service';

function makePrisma() {
  return {
    weeklyGoal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    answer: { count: jest.fn().mockResolvedValue(0) },
    studySession: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { minutes: null } }),
    },
  };
}

function makeService() {
  const prisma = makePrisma() as any;
  const service = new WeeklyGoalsService(prisma);
  return { service, prisma };
}

describe('WeeklyGoalsService (issue #44)', () => {
  describe('weekStartOf()', () => {
    it('retorna a segunda-feira 00:00 UTC da semana', () => {
      // Quarta-feira 02/09/2026 → segunda 31/08/2026.
      const monday = weekStartOf(new Date('2026-09-02T15:30:00Z'));
      expect(monday.toISOString().slice(0, 10)).toBe('2026-08-31');
      expect(monday.getUTCDay()).toBe(1); // segunda
      expect(monday.toISOString().slice(11)).toBe('00:00:00.000Z');
    });

    it('domingo volta para a segunda anterior', () => {
      const sunday = weekStartOf(new Date('2026-09-06T10:00:00Z')); // domingo
      expect(sunday.toISOString().slice(0, 10)).toBe('2026-08-31');
    });
  });

  describe('create()', () => {
    it('rejeita meta sem nenhum alvo', async () => {
      const { service } = makeService();
      await expect(
        service.create('u1', { subjectId: 's1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cria meta com weekStart da semana corrente', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.create.mockResolvedValue({
        id: 'g1',
        subjectAreaId: null,
        subjectId: null,
        topicId: null,
        targetMinutes: 120,
        targetQuestions: 0,
        weekStart: new Date('2026-08-31'),
      });

      const res = await service.create(
        'u1',
        { targetMinutes: 120 },
        new Date('2026-09-02T15:00:00Z'),
      );

      expect(prisma.weeklyGoal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          targetMinutes: 120,
          weekStart: new Date('2026-08-31T00:00:00.000Z'),
        }),
      });
      expect(res.id).toBe('g1');
      expect(res.completed).toBe(false);
    });
  });

  describe('withProgress()', () => {
    const GOAL = {
      id: 'g1',
      subjectAreaId: null,
      subjectId: 'subj-mat',
      topicId: null,
      targetMinutes: 120,
      targetQuestions: 10,
      weekStart: new Date('2026-08-31T00:00:00Z'),
      subjectArea: null,
      subject: { name: 'Matemática' },
      topic: null,
    };

    it('calcula progresso e completed quando ambos os alvos batem', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findMany.mockResolvedValue([GOAL]);
      prisma.answer.count.mockResolvedValue(10);
      prisma.studySession.aggregate.mockResolvedValue({
        _sum: { minutes: 130 },
      });

      const res = await service.listCurrentWeek('u1', new Date('2026-09-01'));

      expect(prisma.weeklyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            weekStart: new Date('2026-08-31T00:00:00.000Z'),
          },
        }),
      );
      expect(res[0].questionsDone).toBe(10);
      expect(res[0].minutesDone).toBe(130);
      expect(res[0].completed).toBe(true);
    });

    it('incompleto quando falta um dos alvos', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findMany.mockResolvedValue([GOAL]);
      prisma.answer.count.mockResolvedValue(7); // meta: 10
      prisma.studySession.aggregate.mockResolvedValue({
        _sum: { minutes: 500 },
      });

      const res = await service.listCurrentWeek('u1', new Date('2026-09-01'));
      expect(res[0].completed).toBe(false);
    });

    it('filtra respostas pelo escopo da meta (subjectId)', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findMany.mockResolvedValue([]);
      prisma.answer.count.mockResolvedValue(0);

      await service.listCurrentWeek('u1', new Date('2026-09-01'));
      // (vazio: nenhum goal para inspecionar o where — o teste abaixo cobre)
      expect(prisma.weeklyGoal.findMany).toHaveBeenCalled();

      // Agora com a meta: o where do count usa o escopo de matéria.
      prisma.weeklyGoal.findMany.mockResolvedValue([GOAL]);
      await service.listCurrentWeek('u1', new Date('2026-09-01'));
      const where = prisma.answer.count.mock.calls[0][0].where;
      expect(where.question).toEqual({ topic: { subjectId: 'subj-mat' } });
      expect(where.createdAt.gte).toEqual(new Date('2026-08-31T00:00:00Z'));
    });
  });

  describe('update()/remove()', () => {
    it('404 para meta inexistente ou de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findUnique.mockResolvedValue(null);
      await expect(
        service.update('u1', 'nao-existe', { targetMinutes: 60 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.weeklyGoal.findUnique.mockResolvedValue({ userId: 'outro' });
      await expect(
        service.update('u1', 'g1', { targetMinutes: 60 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove('u1', 'g1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('atualiza alvos de meta própria', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findUnique.mockResolvedValue({ userId: 'u1' });
      prisma.weeklyGoal.update.mockResolvedValue({
        id: 'g1',
        subjectAreaId: null,
        subjectId: null,
        topicId: null,
        targetMinutes: 90,
        targetQuestions: 0,
        weekStart: new Date('2026-08-31'),
      });

      const res = await service.update('u1', 'g1', { targetMinutes: 90 });
      expect(prisma.weeklyGoal.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { targetMinutes: 90 },
      });
      expect(res.targetMinutes).toBe(90);
    });

    it('remove meta própria (idempotente)', async () => {
      const { service, prisma } = makeService();
      prisma.weeklyGoal.findUnique.mockResolvedValue({ userId: 'u1' });

      const res = await service.remove('u1', 'g1');
      expect(res).toEqual({ removed: true });
      expect(prisma.weeklyGoal.delete).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
    });
  });
});
