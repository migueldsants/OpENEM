import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildStudyPlan, PlanTopic } from '../common/study-plan';
import { PerformanceService } from '../performance/performance.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performance: PerformanceService,
  ) {}

  /** Gera (ou regenera) o cronograma do usuário a partir do desempenho e do perfil. */
  async generate(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { minutesPerDay: true },
    });
    const minutesPerDay = profile?.minutesPerDay ?? 60;

    const overview = await this.performance.overview(userId);
    let topics: PlanTopic[] = overview.weakestTopics.map((t) => ({
      id: t.id,
      name: t.name,
      subjectName: t.subjectName,
    }));

    // Sem histórico ainda: usa uma amostra de assuntos do banco.
    if (topics.length === 0) {
      const sample = await this.prisma.topic.findMany({
        take: 5,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          subject: { select: { name: true } },
        },
      });
      topics = sample.map((t) => ({
        id: t.id,
        name: t.name,
        subjectName: t.subject.name,
      }));
    }

    if (topics.length === 0) {
      throw new BadRequestException(
        'Não há assuntos disponíveis para montar um cronograma',
      );
    }

    const sessions = buildStudyPlan(topics, minutesPerDay);

    // Um plano ativo por usuário: recria do zero.
    await this.prisma.studyPlan.deleteMany({ where: { userId } });
    await this.prisma.studyPlan.create({
      data: {
        userId,
        minutesPerDay,
        sessions: {
          create: sessions.map((s) => ({
            topicId: s.topicId,
            dayIndex: s.dayIndex,
            minutes: s.minutes,
          })),
        },
      },
    });

    return this.get(userId);
  }

  /** Retorna o cronograma atual com as sessões ordenadas por dia. */
  async get(userId: string) {
    const plan = await this.prisma.studyPlan.findUnique({
      where: { userId },
      select: {
        id: true,
        minutesPerDay: true,
        createdAt: true,
        sessions: {
          orderBy: [{ dayIndex: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            dayIndex: true,
            minutes: true,
            done: true,
            topic: {
              select: {
                id: true,
                name: true,
                subject: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Nenhum cronograma gerado ainda');
    }
    return plan;
  }

  /** Marca uma sessão como concluída/pendente (valida posse via o plano). */
  async setSessionDone(userId: string, sessionId: string, done: boolean) {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
      select: { id: true, plan: { select: { userId: true } } },
    });
    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }
    if (session.plan.userId !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.studySession.update({
      where: { id: sessionId },
      data: { done },
    });
  }
}
