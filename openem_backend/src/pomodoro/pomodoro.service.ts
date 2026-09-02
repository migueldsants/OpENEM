import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteFocusSessionDto } from './dto/complete-focus-session.dto';

export interface FocusSessionView {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  durationSec: number;
  startedAt: Date;
  completedAt: Date;
}

/** XP por sessão de foco: 1 XP a cada 2 minutos, teto 40 (issue #41). */
export function xpForFocusSession(durationSec: number): number {
  return Math.min(40, Math.floor(durationSec / 120));
}

@Injectable()
export class PomodoroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  /**
   * Registra uma sessão de foco concluída (issue #41). O cliente controla o
   * timer; o servidor valida a duração e credita XP proporcional.
   */
  async complete(
    userId: string,
    dto: CompleteFocusSessionDto,
  ): Promise<FocusSessionView & { gamification?: GamificationDelta }> {
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Matéria não encontrada');
    }

    const session = await this.prisma.focusSession.create({
      data: {
        userId,
        subjectId: dto.subjectId ?? null,
        durationSec: dto.durationSec,
        startedAt: new Date(dto.startedAt),
      },
      include: { subject: { select: { name: true } } },
    });

    const baseXp = xpForFocusSession(dto.durationSec);
    const gamification = await this.gamification.recordActivity(
      userId,
      'STUDY_SESSION',
      baseXp,
      `Sessão de foco de ${Math.round(dto.durationSec / 60)} min`,
      new Date(),
      { sessionsDone: 1 },
    );

    return {
      id: session.id,
      subjectId: session.subjectId,
      subjectName: session.subject?.name ?? null,
      durationSec: session.durationSec,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      ...(gamification ? { gamification } : {}),
    };
  }

  /**
   * Histórico de sessões do usuário (mais recentes primeiro) com total de
   * minutos dos últimos N dias.
   */
  async history(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const sessions = await this.prisma.focusSession.findMany({
      where: { userId, completedAt: { gte: since } },
      orderBy: { completedAt: 'desc' },
      take: 100,
      include: { subject: { select: { name: true } } },
    });
    const totalMinutes = Math.round(
      sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60,
    );
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        subjectId: s.subjectId,
        subjectName: s.subject?.name ?? null,
        durationSec: s.durationSec,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      totalMinutes,
    };
  }

  /** Minutos por matéria nos últimos N dias — alimenta o gráfico (issue #41). */
  async minutesBySubject(userId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const sessions = await this.prisma.focusSession.findMany({
      where: { userId, completedAt: { gte: since } },
      select: {
        durationSec: true,
        subject: { select: { id: true, name: true } },
      },
    });
    const bySubject = new Map<string, { name: string; minutes: number }>();
    for (const s of sessions) {
      const key = s.subject?.id ?? 'geral';
      const entry = bySubject.get(key) ?? {
        name: s.subject?.name ?? 'Sem matéria',
        minutes: 0,
      };
      entry.minutes += s.durationSec / 60;
      bySubject.set(key, entry);
    }
    return [...bySubject.entries()]
      .map(([id, { name, minutes }]) => ({
        subjectId: id === 'geral' ? null : id,
        subjectName: name,
        minutes: Math.round(minutes),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  /** Resumo para o widget do Pomodoro (meta diária do onboarding). */
  async todayMinutes(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const agg = await this.prisma.focusSession.aggregate({
      where: { userId, completedAt: { gte: startOfDay } },
      _sum: { durationSec: true },
    });
    return { minutes: Math.round((agg._sum.durationSec ?? 0) / 60) };
  }
}
