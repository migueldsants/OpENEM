import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeeklyGoalDto } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalDto } from './dto/update-weekly-goal.dto';

/** Início da semana (segunda-feira 00:00 UTC) da data de referência. */
export function weekStartOf(now: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  // getUTCDay: dom=0..sáb=6 — segunda=1. Recua até segunda-feira.
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

export interface WeeklyGoalView {
  id: string;
  subjectAreaId: string | null;
  subjectAreaName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  topicId: string | null;
  topicName: string | null;
  targetMinutes: number;
  targetQuestions: number;
  weekStart: Date;
  /** Progresso real da semana: minutos de sessões concluídas no escopo. */
  minutesDone: number;
  /** Progresso real da semana: questões respondidas no escopo. */
  questionsDone: number;
  completed: boolean;
}

@Injectable()
export class WeeklyGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista as metas da semana corrente com o progresso calculado. */
  async listCurrentWeek(userId: string, now: Date = new Date()) {
    const weekStart = weekStartOf(now);
    const goals = await this.prisma.weeklyGoal.findMany({
      where: { userId, weekStart },
      orderBy: { createdAt: 'asc' },
      include: {
        subjectArea: { select: { name: true } },
        subject: { select: { name: true } },
        topic: { select: { name: true } },
      },
    });

    const views = await Promise.all(
      goals.map((g) => this.withProgress(userId, g)),
    );
    return views;
  }

  /** Cria uma meta para a semana corrente (ou da data de referência). */
  async create(
    userId: string,
    dto: CreateWeeklyGoalDto,
    now: Date = new Date(),
  ) {
    if (!dto.targetMinutes && !dto.targetQuestions) {
      throw new BadRequestException(
        'Defina ao menos um alvo (minutos ou questões) para a meta',
      );
    }
    const goal = await this.prisma.weeklyGoal.create({
      data: {
        userId,
        subjectAreaId: dto.subjectAreaId ?? null,
        subjectId: dto.subjectId ?? null,
        topicId: dto.topicId ?? null,
        targetMinutes: dto.targetMinutes ?? 0,
        targetQuestions: dto.targetQuestions ?? 0,
        weekStart: weekStartOf(now),
      },
    });
    return this.withProgress(userId, {
      ...goal,
      subjectArea: null,
      subject: null,
      topic: null,
    });
  }

  /** Atualiza os alvos de uma meta própria. */
  async update(userId: string, id: string, dto: UpdateWeeklyGoalDto) {
    const existing = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Meta não encontrada');
    if (existing.userId !== userId)
      throw new NotFoundException('Meta não encontrada');

    const goal = await this.prisma.weeklyGoal.update({
      where: { id },
      data: {
        ...(dto.targetMinutes !== undefined
          ? { targetMinutes: dto.targetMinutes }
          : {}),
        ...(dto.targetQuestions !== undefined
          ? { targetQuestions: dto.targetQuestions }
          : {}),
      },
    });
    return this.withProgress(userId, {
      ...goal,
      subjectArea: null,
      subject: null,
      topic: null,
    });
  }

  /** Remove uma meta própria (idempotente: 404 se não existe/não é sua). */
  async remove(userId: string, id: string) {
    const existing = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Meta não encontrada');
    }
    await this.prisma.weeklyGoal.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * Calcula o progresso real da meta na semana: questões respondidas e minutos
   * de sessões de cronograma concluídas, filtrados pelo escopo
   * (área/matéria/tópico da meta). `completed` quando TODOS os alvos
   * definidos (min > 0 e/ou questões > 0) foram atingidos.
   *
   * Minutos: sessões concluídas do plano vigente (criado a partir do início
   * da semana da meta) — StudySession não carrega data de conclusão própria,
   * então usamos planos gerados na semana corrente como fonte temporal.
   */
  private async withProgress(
    userId: string,
    goal: {
      id: string;
      subjectAreaId: string | null;
      subjectId: string | null;
      topicId: string | null;
      targetMinutes: number;
      targetQuestions: number;
      weekStart: Date;
      subjectArea?: { name: string } | null;
      subject?: { name: string } | null;
      topic?: { name: string } | null;
    },
  ): Promise<WeeklyGoalView> {
    const since = goal.weekStart;
    const until = new Date(since.getTime() + 7 * 86_400_000);

    // Escopo das respostas: tópico > matéria > área > geral.
    const topicScope = goal.topicId
      ? { topicId: goal.topicId }
      : goal.subjectId
        ? { topic: { subjectId: goal.subjectId } }
        : goal.subjectAreaId
          ? { topic: { subject: { subjectAreaId: goal.subjectAreaId } } }
          : {};

    const [answers, minutesRows] = await Promise.all([
      this.prisma.answer.count({
        where: {
          userId,
          createdAt: { gte: since, lt: until },
          question: topicScope,
        },
      }),
      goal.targetMinutes > 0
        ? this.prisma.studySession.aggregate({
            where: {
              done: true,
              // Planos gerados a partir do início da semana da meta.
              plan: { userId, createdAt: { gte: since } },
              topic: goal.topicId
                ? { id: goal.topicId }
                : goal.subjectId
                  ? { subjectId: goal.subjectId }
                  : goal.subjectAreaId
                    ? { subject: { subjectAreaId: goal.subjectAreaId } }
                    : undefined,
            },
            _sum: { minutes: true },
          })
        : Promise.resolve({ _sum: { minutes: null as number | null } }),
    ]);

    const minutesDone = minutesRows._sum.minutes ?? 0;

    const hasMinutesGoal = goal.targetMinutes > 0;
    const hasQuestionsGoal = goal.targetQuestions > 0;
    const completed =
      (!hasMinutesGoal || minutesDone >= goal.targetMinutes) &&
      (!hasQuestionsGoal || answers >= goal.targetQuestions) &&
      (hasMinutesGoal || hasQuestionsGoal);

    return {
      id: goal.id,
      subjectAreaId: goal.subjectAreaId,
      subjectAreaName: goal.subjectArea?.name ?? null,
      subjectId: goal.subjectId,
      subjectName: goal.subject?.name ?? null,
      topicId: goal.topicId,
      topicName: goal.topic?.name ?? null,
      targetMinutes: goal.targetMinutes,
      targetQuestions: goal.targetQuestions,
      weekStart: goal.weekStart,
      minutesDone,
      questionsDone: answers,
      completed,
    };
  }
}
