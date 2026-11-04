import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PomodoroService, xpForFocusSession } from './pomodoro.service';

const NOW = new Date('2026-11-04T12:00:00Z');
const MIN = 60_000;

function makeService(now = NOW) {
  const prisma = {
    subject: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
    focusSession: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { durationSec: null } }),
    },
  } as any;
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new PomodoroService(prisma, gamification);
  service.now = () => now.getTime();
  return { service, prisma, gamification };
}

describe('xpForFocusSession (issue #41)', () => {
  it('1 XP a cada 2 minutos com teto de 40', () => {
    expect(xpForFocusSession(60)).toBe(0); // 1 min
    expect(xpForFocusSession(120)).toBe(1); // 2 min
    expect(xpForFocusSession(1500)).toBe(12); // 25 min
    expect(xpForFocusSession(3600)).toBe(30); // 1h
    expect(xpForFocusSession(99999)).toBe(40); // teto
  });
});

describe('PomodoroService (issue #41)', () => {
  describe('start()', () => {
    it('abre a sessão no servidor e descarta uma sessão aberta anterior', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.create.mockResolvedValue({
        id: 'fs1',
        subjectId: 's1',
        subject: { name: 'Matemática' },
        durationSec: 1500,
        startedAt: NOW,
      });

      const res = await service.start('u1', {
        durationSec: 1500,
        subjectId: 's1',
      });

      expect(prisma.focusSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', completedAt: null },
      });
      expect(prisma.focusSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          subjectId: 's1',
          durationSec: 1500,
          startedAt: NOW,
          completedAt: null,
        },
        include: { subject: { select: { name: true } } },
      });
      expect(res).toEqual({
        id: 'fs1',
        subjectId: 's1',
        subjectName: 'Matemática',
        durationSec: 1500,
        startedAt: NOW,
      });
    });

    it('aceita sessão sem matéria', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.create.mockResolvedValue({
        id: 'fs2',
        subjectId: null,
        subject: null,
        durationSec: 300,
        startedAt: NOW,
      });

      const res = await service.start('u1', { durationSec: 300 });
      expect(res.subjectName).toBeNull();
    });

    it('404 para matéria inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.subject.findUnique.mockResolvedValue(null);
      await expect(
        service.start('u1', { durationSec: 300, subjectId: 'nao-existe' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.focusSession.create).not.toHaveBeenCalled();
    });
  });

  describe('complete()', () => {
    it('conclui a sessão aberta e credita XP proporcional', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.focusSession.findUnique.mockResolvedValue({
        id: 'fs1',
        userId: 'u1',
        subjectId: 's1',
        subject: { name: 'Matemática' },
        durationSec: 1500,
        startedAt: new Date(NOW.getTime() - 25 * MIN),
        completedAt: null,
      });

      const res = await service.complete('u1', 'fs1');

      expect(prisma.focusSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'fs1', userId: 'u1', completedAt: null },
        data: { completedAt: NOW },
      });
      expect(res.completedAt).toEqual(NOW);
      expect(res.subjectName).toBe('Matemática');
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'STUDY_SESSION',
        12,
        expect.stringContaining('25 min'),
        NOW,
        { sessionsDone: 1 },
      );
    });

    it('404 para sessão inexistente ou de outro aluno', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findUnique.mockResolvedValue(null);
      await expect(service.complete('u1', 'fs1')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.focusSession.findUnique.mockResolvedValue({
        id: 'fs1',
        userId: 'outro',
        subject: null,
        durationSec: 1500,
        startedAt: new Date(NOW.getTime() - 25 * MIN),
        completedAt: null,
      });
      await expect(service.complete('u1', 'fs1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.focusSession.updateMany).not.toHaveBeenCalled();
    });

    it('400 se a sessão já foi concluída', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findUnique.mockResolvedValue({
        id: 'fs1',
        userId: 'u1',
        subject: null,
        durationSec: 1500,
        startedAt: new Date(NOW.getTime() - 25 * MIN),
        completedAt: new Date(NOW.getTime() - MIN),
      });

      await expect(service.complete('u1', 'fs1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.focusSession.updateMany).not.toHaveBeenCalled();
    });

    it('400 se o tempo ainda não passou (sessão forjada)', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findUnique.mockResolvedValue({
        id: 'fs1',
        userId: 'u1',
        subject: null,
        durationSec: 4 * 60 * 60,
        startedAt: NOW,
        completedAt: null,
      });

      await expect(service.complete('u1', 'fs1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.focusSession.updateMany).not.toHaveBeenCalled();
      expect(prisma.focusSession.create).not.toHaveBeenCalled();
    });

    it('400 se outra requisição concluiu a sessão primeiro', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findUnique.mockResolvedValue({
        id: 'fs1',
        userId: 'u1',
        subject: null,
        durationSec: 1500,
        startedAt: new Date(NOW.getTime() - 25 * MIN),
        completedAt: null,
      });
      prisma.focusSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.complete('u1', 'fs1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('history()/minutesBySubject()', () => {
    it('histórico com total de minutos', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findMany.mockResolvedValue([
        {
          id: 'fs1',
          subjectId: 's1',
          subject: { name: 'Matemática' },
          durationSec: 1500,
          startedAt: new Date(NOW.getTime() - 25 * MIN),
          completedAt: NOW,
        },
      ]);

      const res = await service.history('u1', 7);
      expect(res.sessions).toHaveLength(1);
      expect(res.totalMinutes).toBe(25);
      expect(res.sessions[0].completedAt).toEqual(NOW);
    });

    it('minutos por matéria agrega e ordena desc', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.findMany.mockResolvedValue([
        { durationSec: 600, subject: { id: 's1', name: 'Matemática' } },
        { durationSec: 1200, subject: { id: 's1', name: 'Matemática' } },
        { durationSec: 300, subject: null },
      ]);

      const res = await service.minutesBySubject('u1', 30);
      expect(res).toEqual([
        { subjectId: 's1', subjectName: 'Matemática', minutes: 30 },
        { subjectId: null, subjectName: 'Sem matéria', minutes: 5 },
      ]);
    });
  });

  it('todayMinutes soma as sessões do dia', async () => {
    const { service, prisma } = makeService();
    prisma.focusSession.aggregate.mockResolvedValue({
      _sum: { durationSec: 1800 },
    });
    const res = await service.todayMinutes('u1');
    expect(res).toEqual({ minutes: 30 });
  });
});
