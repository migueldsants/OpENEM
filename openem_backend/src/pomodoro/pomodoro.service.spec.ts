import { NotFoundException } from '@nestjs/common';
import { PomodoroService, xpForFocusSession } from './pomodoro.service';

function makeService() {
  const prisma = {
    subject: { findUnique: jest.fn().mockResolvedValue({ id: 's1' }) },
    focusSession: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { durationSec: null } }),
    },
  } as any;
  const gamification = { recordActivity: jest.fn().mockResolvedValue(null) };
  const service = new PomodoroService(prisma, gamification);
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
  describe('complete()', () => {
    it('registra a sessão e credita XP proporcional', async () => {
      const { service, prisma, gamification } = makeService();
      prisma.focusSession.create.mockResolvedValue({
        id: 'fs1',
        subjectId: 's1',
        subject: { name: 'Matemática' },
        durationSec: 1500,
        startedAt: new Date('2026-09-01T10:00:00Z'),
        completedAt: new Date('2026-09-01T10:25:00Z'),
      });

      const res = await service.complete('u1', {
        durationSec: 1500,
        startedAt: '2026-09-01T10:00:00Z',
        subjectId: 's1',
      });

      expect(res.subjectName).toBe('Matemática');
      expect(prisma.focusSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          subjectId: 's1',
          durationSec: 1500,
          startedAt: new Date('2026-09-01T10:00:00Z'),
        }),
        include: { subject: { select: { name: true } } },
      });
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'STUDY_SESSION',
        12,
        expect.stringContaining('25 min'),
        expect.any(Date),
        { sessionsDone: 1 },
      );
    });

    it('aceita sessão sem matéria', async () => {
      const { service, prisma } = makeService();
      prisma.focusSession.create.mockResolvedValue({
        id: 'fs2',
        subjectId: null,
        subject: null,
        durationSec: 300,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const res = await service.complete('u1', {
        durationSec: 300,
        startedAt: new Date().toISOString(),
      });
      expect(res.subjectName).toBeNull();
    });

    it('404 para matéria inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.subject.findUnique.mockResolvedValue(null);
      await expect(
        service.complete('u1', {
          durationSec: 300,
          startedAt: new Date().toISOString(),
          subjectId: 'nao-existe',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.focusSession.create).not.toHaveBeenCalled();
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
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const res = await service.history('u1', 7);
      expect(res.sessions).toHaveLength(1);
      expect(res.totalMinutes).toBe(25);
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
