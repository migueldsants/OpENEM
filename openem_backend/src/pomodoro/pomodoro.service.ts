import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StartFocusSessionDto } from './dto/start-focus-session.dto';

/** Folga para o relógio do cliente fechar o ciclo e a requisição chegar. */
export const FOCUS_COMPLETE_TOLERANCE_MS = 5_000;

export interface StartedFocusSessionView {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  durationSec: number;
  startedAt: Date;
}

export interface FocusSessionView extends StartedFocusSessionView {
  completedAt: Date;
}

/** XP por sessão de foco: 1 XP a cada 2 minutos, teto 40 (issue #41). */
export function xpForFocusSession(durationSec: number): number {
  return Math.min(40, Math.floor(durationSec / 120));
}

@Injectable()
export class PomodoroService {
  /** Relógio do servidor; os testes trocam. */
  now: () => number = Date.now;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  /**
   * Abre a sessão no servidor. O cliente não decide quando ela começou: o
   * `startedAt` é gravado aqui, e o `complete` só aceita depois de o tempo
   * real ter passado. Só existe uma sessão aberta por aluno; começar outra
   * descarta a anterior (timer órfão de outra aba/aparelho).
   */
  async start(
    userId: string,
    dto: StartFocusSessionDto,
  ): Promise<StartedFocusSessionView> {
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { id: true },
      });
      if (!subject) throw new NotFoundException('Matéria não encontrada');
    }

    await this.prisma.focusSession.deleteMany({
      where: { userId, completedAt: null },
    });

    const session = await this.prisma.focusSession.create({
      data: {
        userId,
        subjectId: dto.subjectId ?? null,
        durationSec: dto.durationSec,
        startedAt: new Date(this.now()),
        completedAt: null,
      },
      include: { subject: { select: { name: true } } },
    });

    return this.toStartedView(session);
  }

  /**
   * Fecha a sessão aberta depois de conferir o tempo real decorrido e credita
   * o XP. O `updateMany` com `completedAt: null` garante uso único mesmo com
   * duas requisições simultâneas.
   */
  async complete(
    userId: string,
    id: string,
  ): Promise<FocusSessionView & { gamification?: GamificationDelta }> {
    const session = await this.prisma.focusSession.findUnique({
      where: { id },
      include: { subject: { select: { name: true } } },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Sessão de foco não encontrada');
    }
    if (session.completedAt !== null) {
      throw new BadRequestException('Sessão de foco já concluída');
    }

    const agora = new Date(this.now());
    const decorridoMs = agora.getTime() - session.startedAt.getTime();
    if (
      decorridoMs + FOCUS_COMPLETE_TOLERANCE_MS <
      session.durationSec * 1000
    ) {
      throw new BadRequestException(
        'A sessão ainda não terminou; aguarde o cronômetro.',
      );
    }

    const { count } = await this.prisma.focusSession.updateMany({
      where: { id, userId, completedAt: null },
      data: { completedAt: agora },
    });
    if (count === 0) {
      throw new BadRequestException('Sessão de foco já concluída');
    }

    const baseXp = xpForFocusSession(session.durationSec);
    const gamification = await this.gamification.recordActivity(
      userId,
      'STUDY_SESSION',
      baseXp,
      `Sessão de foco de ${Math.round(session.durationSec / 60)} min`,
      agora,
      { sessionsDone: 1 },
    );

    return {
      ...this.toStartedView(session),
      completedAt: agora,
      ...(gamification ? { gamification } : {}),
    };
  }

  private toStartedView(session: {
    id: string;
    subjectId: string | null;
    subject: { name: string } | null;
    durationSec: number;
    startedAt: Date;
  }): StartedFocusSessionView {
    return {
      id: session.id,
      subjectId: session.subjectId,
      subjectName: session.subject?.name ?? null,
      durationSec: session.durationSec,
      startedAt: session.startedAt,
    };
  }

  /**
   * Histórico de sessões concluídas do usuário (mais recentes primeiro) com
   * total de minutos dos últimos N dias.
   */
  async history(userId: string, days = 30) {
    const since = new Date(this.now() - days * 86_400_000);
    const sessions = await this.prisma.focusSession.findMany({
      where: { userId, completedAt: { not: null, gte: since } },
      orderBy: { completedAt: 'desc' },
      take: 100,
      include: { subject: { select: { name: true } } },
    });
    const totalMinutes = Math.round(
      sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60,
    );
    return {
      sessions: sessions.map((s) => ({
        ...this.toStartedView(s),
        completedAt: s.completedAt ?? s.startedAt,
      })),
      totalMinutes,
    };
  }

  /** Minutos por matéria nos últimos N dias — alimenta o gráfico (issue #41). */
  async minutesBySubject(userId: string, days = 30) {
    const since = new Date(this.now() - days * 86_400_000);
    const sessions = await this.prisma.focusSession.findMany({
      where: { userId, completedAt: { not: null, gte: since } },
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
    const startOfDay = new Date(this.now());
    startOfDay.setHours(0, 0, 0, 0);
    const agg = await this.prisma.focusSession.aggregate({
      where: {
        userId,
        completedAt: { not: null, gte: startOfDay },
      },
      _sum: { durationSec: true },
    });
    return { minutes: Math.round((agg._sum.durationSec ?? 0) / 60) };
  }
}
