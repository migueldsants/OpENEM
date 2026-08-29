import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';

function makeService() {
  const prisma = {
    profile: { findUnique: jest.fn() },
    topic: { findMany: jest.fn() },
    studyPlan: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    studySession: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  } as any;
  const performance = { overview: jest.fn() };
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new StudyPlanService(prisma, performance, gamification);
  return { service, prisma, performance, gamification };
}

describe('StudyPlanService', () => {
  describe('generate()', () => {
    it('usa minutesPerDay do perfil e tópicos fracos do desempenho', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue({ minutesPerDay: 90 });
      performance.overview.mockResolvedValue({
        weakestTopics: [
          { id: 't1', name: 'Funções', subjectName: 'Matemática' },
        ],
      });
      prisma.studyPlan.deleteMany.mockResolvedValue({ count: 1 });
      prisma.studyPlan.create.mockResolvedValue({});
      prisma.studyPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        minutesPerDay: 90,
        sessions: [],
      });

      const res = await service.generate('u1');
      expect(res.id).toBe('plan-1');
      expect(performance.overview).toHaveBeenCalledWith('u1');
      const createArg = prisma.studyPlan.create.mock.calls[0][0];
      expect(createArg.data.minutesPerDay).toBe(90);
      // 90 min/dia em blocos de 30 = 3 blocos/dia × 7 dias = 21 sessões.
      expect(createArg.data.sessions.create).toHaveLength(21);
      expect(createArg.data.userId).toBe('u1');
    });

    it('sem histórico amostra tópicos do banco', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue(null); // default 60 min
      performance.overview.mockResolvedValue({ weakestTopics: [] });
      prisma.topic.findMany.mockResolvedValue([
        { id: 't1', name: 'A', subject: { name: 'S' } },
      ]);
      prisma.studyPlan.findUnique.mockResolvedValue({
        id: 'plan-2',
        sessions: [],
      });

      await service.generate('u1');
      expect(prisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
      expect(prisma.studyPlan.create.mock.calls[0][0].data.minutesPerDay).toBe(
        60,
      );
    });

    it('retorna 400 quando não há assuntos disponíveis', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue(null);
      performance.overview.mockResolvedValue({ weakestTopics: [] });
      prisma.topic.findMany.mockResolvedValue([]);

      await expect(service.generate('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('get()', () => {
    it('retorna 404 quando não há cronograma', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique.mockResolvedValue(null);
      await expect(service.get('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setSessionDone()', () => {
    it('retorna 404 para sessão inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue(null);
      await expect(
        service.setSessionDone('u1', 's1', true),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna 403 para sessão de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'outro' },
      });
      await expect(
        service.setSessionDone('u1', 's1', true),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('conclui sessão e credita XP apenas na 1ª conclusão', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'u1' },
      });
      prisma.studySession.update.mockResolvedValue({ id: 's1', done: true });

      const res = await service.setSessionDone('u1', 's1', true);
      expect(res.done).toBe(true);
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'STUDY_SESSION',
        8,
        'Sessão de estudo concluída',
        expect.any(Date),
        { sessionsDone: 1 },
      );

      // Desmarcar não credita XP de novo.
      gamification.recordActivity.mockClear();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: true,
        plan: { userId: 'u1' },
      });
      await service.setSessionDone('u1', 's1', false);
      expect(gamification.recordActivity).not.toHaveBeenCalled();
    });
  });
});
