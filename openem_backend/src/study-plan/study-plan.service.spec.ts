import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';

const SUBJECTS = [
  { id: 'mat', name: 'Matemática' },
  { id: 'fis', name: 'Física' },
  { id: 'bio', name: 'Biologia' },
];

function makeService() {
  const prisma = {
    profile: { findUnique: jest.fn() },
    subject: { findMany: jest.fn().mockResolvedValue(SUBJECTS) },
    studyPlan: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    studySession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  } as any;
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new StudyPlanService(prisma, gamification);
  return { service, prisma, gamification };
}

describe('StudyPlanService', () => {
  describe('get()', () => {
    it('404 quando não há plano', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique.mockResolvedValue(null);
      await expect(service.get('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createSession()', () => {
    it('cria bloco livre e casa a matéria do catálogo pelo nome', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.studySession.findFirst.mockResolvedValue({ position: 1 });
      prisma.studySession.create.mockResolvedValue({ id: 's9' });

      await service.createSession('u1', { label: 'matemática', dayIndex: 2 });

      const arg = prisma.studySession.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        planId: 'plan-1',
        label: 'matemática',
        subjectId: 'mat', // casamento é case-insensitive
        dayIndex: 2,
        minutes: 45, // padrão
        position: 2, // depois do último do dia
      });
    });

    it('bloco fora do catálogo fica sem matéria', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique.mockResolvedValue({ id: 'plan-1' });
      prisma.studySession.findFirst.mockResolvedValue(null);
      prisma.studySession.create.mockResolvedValue({ id: 's9' });

      await service.createSession('u1', {
        label: 'Revisar simulado',
        dayIndex: 0,
        minutes: 90,
      });

      const arg = prisma.studySession.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({
        label: 'Revisar simulado',
        subjectId: null,
        minutes: 90,
        position: 0,
      });
    });

    it('cria o plano sob demanda quando ainda não existe', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique.mockResolvedValue(null);
      prisma.profile.findUnique.mockResolvedValue({ minutesPerDay: 75 });
      prisma.studyPlan.create.mockResolvedValue({ id: 'plan-novo' });
      prisma.studySession.findFirst.mockResolvedValue(null);
      prisma.studySession.create.mockResolvedValue({ id: 's1' });

      await service.createSession('u1', { label: 'Inglês', dayIndex: 0 });

      expect(prisma.studyPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'u1', minutesPerDay: 75 },
          select: { id: true },
        }),
      );
    });
  });

  describe('updateSession()', () => {
    it('403 quando a sessão é de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'outro' },
      });
      await expect(
        service.updateSession('u1', 's1', { done: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 quando a sessão não existe', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSession('u1', 's1', { done: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('renomear re-casa a matéria do catálogo', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'u1' },
      });
      prisma.studySession.update.mockResolvedValue({ id: 's1' });

      await service.updateSession('u1', 's1', { label: 'Biologia' });

      expect(prisma.studySession.update.mock.calls[0][0].data).toEqual({
        label: 'Biologia',
        subjectId: 'bio',
      });
    });

    it('credita XP apenas na 1ª conclusão', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'u1' },
      });
      prisma.studySession.update.mockResolvedValue({ id: 's1', done: true });

      await service.updateSession('u1', 's1', { done: true });
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'STUDY_SESSION',
        expect.any(Number),
        expect.any(String),
        expect.any(Date),
        { sessionsDone: 1 },
      );

      // Já concluída: não credita de novo.
      gamification.recordActivity.mockClear();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: true,
        plan: { userId: 'u1' },
      });
      await service.updateSession('u1', 's1', { done: true });
      expect(gamification.recordActivity).not.toHaveBeenCalled();
    });

    it('desmarcar não credita XP', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: true,
        plan: { userId: 'u1' },
      });
      prisma.studySession.update.mockResolvedValue({ id: 's1', done: false });

      await service.updateSession('u1', 's1', { done: false });
      expect(gamification.recordActivity).not.toHaveBeenCalled();
    });
  });

  describe('removeSession()', () => {
    it('remove após validar a posse', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'u1' },
      });
      prisma.studySession.delete.mockResolvedValue({ id: 's1' });

      await expect(service.removeSession('u1', 's1')).resolves.toEqual({
        removed: true,
      });
      expect(prisma.studySession.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });

    it('403 para sessão de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.studySession.findUnique.mockResolvedValue({
        id: 's1',
        done: false,
        plan: { userId: 'outro' },
      });
      await expect(service.removeSession('u1', 's1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.studySession.delete).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('recria o plano vazio, para a semana recomeçar hoje', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue({ minutesPerDay: 90 });
      prisma.studyPlan.deleteMany.mockResolvedValue({ count: 1 });
      prisma.studyPlan.create.mockResolvedValue({});
      prisma.studyPlan.findUnique.mockResolvedValue({
        id: 'plan-novo',
        minutesPerDay: 90,
        sessions: [],
      });

      const res = await service.clear('u1');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.studyPlan.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.studyPlan.create).toHaveBeenCalledWith({
        data: { userId: 'u1', minutesPerDay: 90 },
      });
      expect(res).toMatchObject({ id: 'plan-novo', sessions: [] });
    });

    it('sem perfil usa 60 minutos', async () => {
      const { service, prisma } = makeService();
      prisma.profile.findUnique.mockResolvedValue(null);
      prisma.studyPlan.findUnique.mockResolvedValue({ id: 'p', sessions: [] });

      await service.clear('u1');
      expect(prisma.studyPlan.create).toHaveBeenCalledWith({
        data: { userId: 'u1', minutesPerDay: 60 },
      });
    });
  });
});
