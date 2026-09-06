import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildStudyPlan, PlanSubject } from '../common/study-plan';
import { POINTS } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PerformanceService } from '../performance/performance.service';
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
    private readonly performance: PerformanceService,
    private readonly gamification: GamificationService,
  ) {}

  /**
   * Matérias em ordem de prioridade: primeiro as dos assuntos mais fracos,
   * depois todas as demais — assim a semana cobre o currículo inteiro em vez
   * de repetir as duas primeiras.
   */
  private async prioritizedSubjects(userId: string): Promise<PlanSubject[]> {
    const all = await this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    if (all.length === 0) return [];

    const overview = await this.performance.overview(userId);
    const weakFirst: PlanSubject[] = [];
    const seen = new Set<string>();
    for (const topic of overview.weakestTopics) {
      const match = all.find((s) => s.name === topic.subjectName);
      if (match && !seen.has(match.id)) {
        seen.add(match.id);
        weakFirst.push(match);
      }
    }
    for (const s of all) {
      if (!seen.has(s.id)) weakFirst.push(s);
    }
    return weakFirst;
  }

  /** Gera (ou regenera) o cronograma do usuário. É só um ponto de partida. */
  async generate(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { minutesPerDay: true },
    });
    const minutesPerDay = profile?.minutesPerDay ?? 60;

    const subjects = await this.prioritizedSubjects(userId);
    if (subjects.length === 0) {
      throw new BadRequestException(
        'Não há matérias disponíveis para montar um cronograma',
      );
    }

    const blocks = buildStudyPlan(subjects, minutesPerDay);

    // Um plano ativo por usuário: recria do zero, atomicamente, para que uma
    // falha não deixe o usuário sem plano e regenerações concorrentes serializem.
    await this.prisma.$transaction([
      this.prisma.studyPlan.deleteMany({ where: { userId } }),
      this.prisma.studyPlan.create({
        data: {
          userId,
          minutesPerDay,
          sessions: { create: blocks },
        },
      }),
    ]);

    return this.get(userId);
  }

  /** Retorna o cronograma atual com as sessões ordenadas por dia e posição. */
  async get(userId: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { userId },
      select: PLAN_SELECT,
    });
    if (!plan) {
      throw new NotFoundException('Nenhum cronograma gerado ainda');
    }
    return plan;
  }

  /**
   * Plano do usuário, criado sob demanda: dá para montar o calendário do zero,
   * sem passar pela geração automática.
   */
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

  /** Esvazia o cronograma, mantendo o plano para edição manual. */
  async clear(userId: string) {
    const plan = await this.ensurePlan(userId);
    await this.prisma.studySession.deleteMany({ where: { planId: plan.id } });
    return this.get(userId);
  }
}
