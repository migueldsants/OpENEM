import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  const performance = { overview: jest.fn() };
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new StudyPlanService(prisma, performance, gamification);
  return { service, prisma, performance, gamification };
}

describe('StudyPlanService', () => {
  describe('generate()', () => {
    it('prioriza as matérias dos assuntos fracos e completa com o resto', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue({ minutesPerDay: 120 });
      performance.overview.mockResolvedValue({
        weakestTopics: [{ id: 't1', name: 'Óptica', subjectName: 'Física' }],
      });
      prisma.studyPlan.deleteMany.mockResolvedValue({ count: 1 });
      prisma.studyPlan.create.mockResolvedValue({});
      prisma.studyPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        minutesPerDay: 120,
        sessions: [],
      });

      const res = await service.generate('u1');
      expect(res.id).toBe('plan-1');
      const createArg = prisma.studyPlan.create.mock.calls[0][0];
      // 120 min/dia em blocos de 60 = 2 blocos × 7 dias.
      expect(createArg.data.sessions.create).toHaveLength(14);
      // Física é a matéria mais fraca, então abre a semana.
      expect(createArg.data.sessions.create[0].label).toBe('Física');
      expect(createArg.data.sessions.create[0].subjectId).toBe('fis');
    });

    it('sem histórico cobre todas as matérias do catálogo', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue(null); // default 60 min
      performance.overview.mockResolvedValue({ weakestTopics: [] });
      prisma.studyPlan.deleteMany.mockResolvedValue({ count: 0 });
      prisma.studyPlan.create.mockResolvedValue({});
      prisma.studyPlan.findUnique.mockResolvedValue({
        id: 'plan-2',
        minutesPerDay: 60,
        sessions: [],
      });

      await service.generate('u1');
      const blocks = prisma.studyPlan.create.mock.calls[0][0].data.sessions
        .create as { label: string }[];
      // Regressão: antes a semana inteira caía em duas ou três matérias.
      expect(new Set(blocks.map((b) => b.label)).size).toBe(SUBJECTS.length);
    });

    it('sem matérias no banco recusa gerar', async () => {
      const { service, prisma, performance } = makeService();
      prisma.profile.findUnique.mockResolvedValue({ minutesPerDay: 60 });
      prisma.subject.findMany.mockResolvedValue([]);
      performance.overview.mockResolvedValue({ weakestTopics: [] });

      await expect(service.generate('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

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
    it('esvazia os blocos mas mantém o plano', async () => {
      const { service, prisma } = makeService();
      prisma.studyPlan.findUnique
        .mockResolvedValueOnce({ id: 'plan-1' })
        .mockResolvedValueOnce({
          id: 'plan-1',
          minutesPerDay: 60,
          sessions: [],
        });
      prisma.studySession.deleteMany.mockResolvedValue({ count: 14 });

      const res = await service.clear('u1');
      expect(prisma.studySession.deleteMany).toHaveBeenCalledWith({
        where: { planId: 'plan-1' },
      });
      expect(res.sessions).toEqual([]);
    });
  });
});
