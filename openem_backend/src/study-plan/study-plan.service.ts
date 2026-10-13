import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { POINTS } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

const SESSION_SELECT = {
  id: true,
  label: true,
  dayIndex: true,
  minutes: true,
  done: true,
  position: true,
  subject: { select: { id: true, name: true } },
} as const;

const PLAN_SELECT = {
  id: true,
  minutesPerDay: true,
  createdAt: true,
  sessions: {
    orderBy: [
      { dayIndex: 'asc' as const },
      { position: 'asc' as const },
      { id: 'asc' as const },
    ],
    select: SESSION_SELECT,
  },
};

export interface StudySessionResult {
  id: string;
  label: string;
  dayIndex: number;
  minutes: number;
  done: boolean;
  position: number;
  subject: { id: string; name: string } | null;
  gamification?: GamificationDelta;
}

@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  /** Retorna o cronograma atual com as sessões ordenadas por dia e posição. */
  async get(userId: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { userId },
      select: PLAN_SELECT,
    });
    if (!plan) {
      throw new NotFoundException('Nenhum cronograma montado ainda');
    }
    return plan;
  }

  /** Plano do usuário, criado sob demanda no primeiro bloco. */
  private async ensurePlan(userId: string) {
    const existing = await this.prisma.studyPlan.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing;
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { minutesPerDay: true },
    });
    return this.prisma.studyPlan.create({
      data: { userId, minutesPerDay: profile?.minutesPerDay ?? 60 },
      select: { id: true },
    });
  }

  /** Resolve a matéria do ENEM pelo nome digitado (para cor e relatórios). */
  private async matchSubject(label: string): Promise<string | null> {
    const name = label.trim();
    if (!name) return null;
    const subjects = await this.prisma.subject.findMany({
      select: { id: true, name: true },
    });
    const lower = name.toLowerCase();
    const exact = subjects.find((s) => s.name.toLowerCase() === lower);
    return exact?.id ?? null;
  }

  /** Adiciona um bloco livre em um dia. */
  async createSession(
    userId: string,
    dto: CreateSessionDto,
  ): Promise<StudySessionResult> {
    const plan = await this.ensurePlan(userId);
    const last = await this.prisma.studySession.findFirst({
      where: { planId: plan.id, dayIndex: dto.dayIndex },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const session = await this.prisma.studySession.create({
      data: {
        planId: plan.id,
        label: dto.label.trim(),
        subjectId: await this.matchSubject(dto.label),
        dayIndex: dto.dayIndex,
        minutes: dto.minutes ?? 45,
        position: (last?.position ?? -1) + 1,
      },
      select: SESSION_SELECT,
    });
    return session;
  }

  /** Carrega a sessão validando a posse via o plano. */
  private async ownedSession(userId: string, sessionId: string) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { id: true, done: true, plan: { select: { userId: true } } },
    });
    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }
    if (session.plan.userId !== userId) {
      throw new ForbiddenException();
    }
    return session;
  }

  /** Edita um bloco: nome, minutos, dia ou conclusão. */
  async updateSession(
    userId: string,
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<StudySessionResult> {
    const current = await this.ownedSession(userId, sessionId);

    const data: {
      label?: string;
      subjectId?: string | null;
      minutes?: number;
      dayIndex?: number;
      done?: boolean;
    } = {};
    if (dto.label !== undefined) {
      data.label = dto.label.trim();
      data.subjectId = await this.matchSubject(dto.label);
    }
    if (dto.minutes !== undefined) data.minutes = dto.minutes;
    if (dto.dayIndex !== undefined) data.dayIndex = dto.dayIndex;
    if (dto.done !== undefined) data.done = dto.done;

    const updated = await this.prisma.studySession.update({
      where: { id: sessionId },
      data,
      select: SESSION_SELECT,
    });

    // XP apenas ao marcar como concluída (não ao desmarcar), para não inflar.
    let gamification: GamificationDelta | undefined;
    if (dto.done === true && !current.done) {
      const delta = await this.gamification.recordActivity(
        userId,
        'STUDY_SESSION',
        POINTS.studySession,
        'Sessão de estudo concluída',
        new Date(),
        { sessionsDone: 1 },
      );
      gamification = delta ?? undefined;
    }
    return { ...updated, ...(gamification ? { gamification } : {}) };
  }

  /** Remove um bloco do calendário. */
  async removeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ removed: boolean }> {
    await this.ownedSession(userId, sessionId);
    await this.prisma.studySession.delete({ where: { id: sessionId } });
    return { removed: true };
  }

  /**
   * Recomeça o cronograma vazio. O plano é recriado, e não só esvaziado, porque
   * os dias do calendário contam a partir de `createdAt`: a semana nova começa
   * hoje, e não no dia em que o plano antigo foi criado.
   */
  async clear(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { minutesPerDay: true },
    });
    // Atômico: uma falha não deixa o usuário sem plano.
    await this.prisma.$transaction([
      this.prisma.studyPlan.deleteMany({ where: { userId } }),
      this.prisma.studyPlan.create({
        data: { userId, minutesPerDay: profile?.minutesPerDay ?? 60 },
      }),
    ]);
    return this.get(userId);
  }
}
