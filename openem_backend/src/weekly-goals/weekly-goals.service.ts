import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  addDays,
  dayLabelDate,
  startOfStudyDay,
  studyDay,
  weekStart,
} from '../common/study-day';
import { weekMinutes } from '../common/weekly-goal-minutes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeeklyGoalDto } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalDto } from './dto/update-weekly-goal.dto';

/**
 * Semana da data de referência, como `WeeklyGoal.weekStart`: a segunda-feira
 * (em Brasília) gravada como meia-noite UTC daquela data. É um rótulo; a semana
 * em si vai da segunda 00:00 ao domingo 23:59 de Brasília.
 */
export function weekStartOf(now: Date = new Date()): Date {
  return dayLabelDate(weekStart(studyDay(now)));
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
  /** Progresso real da semana: blocos concluídos + Pomodoro, no escopo. */
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
   * Calcula o progresso real da meta na semana: questões respondidas e
   * minutos estudados, filtrados pelo escopo (área/matéria/tópico da meta).
   * `completed` quando TODOS os alvos definidos (min > 0 e/ou questões > 0)
   * foram atingidos.
   *
   * Minutos (`weekMinutes`): blocos concluídos do cronograma que caem na
   * semana (o bloco não tem data própria; o dia é o início do plano +
   * `dayIndex`) mais as sessões de foco do Pomodoro terminadas nela.
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
    // A semana de Brasília: da segunda 00:00 à segunda seguinte 00:00.
    const week = goal.weekStart.toISOString().slice(0, 10);
    const since = startOfStudyDay(week);
    const until = startOfStudyDay(addDays(week, 7));

    // Escopo das respostas: tópico > matéria > área > geral.
    const topicScope = goal.topicId
      ? { topicId: goal.topicId }
      : goal.subjectId
        ? { topic: { subjectId: goal.subjectId } }
        : goal.subjectAreaId
          ? {
              // A questao oficial do ENEM guarda a area direto, e so ganha
              // matéria/assunto depois da classificação. Sem o OR, a meta por
              // área nunca contaria nenhuma delas.
              OR: [
                { subjectAreaId: goal.subjectAreaId },
                { topic: { subject: { subjectAreaId: goal.subjectAreaId } } },
              ],
            }
          : {};

    // O bloco do cronograma e a sessão de foco são por MATÉRIA (issue #46),
    // não por subtópico: uma meta de minutos por tópico é contada pelo tempo
    // da matéria à qual esse tópico pertence.
    const subjectScope: Prisma.SubjectWhereInput | undefined = goal.topicId
      ? { topics: { some: { id: goal.topicId } } }
      : goal.subjectId
        ? { id: goal.subjectId }
        : goal.subjectAreaId
          ? { subjectAreaId: goal.subjectAreaId }
          : undefined;

    const hasMinutesGoal = goal.targetMinutes > 0;
    const [answers, minutesDone] = await Promise.all([
      this.prisma.answer.count({
        where: {
          userId,
          createdAt: { gte: since, lt: until },
          question: topicScope,
        },
      }),
      hasMinutesGoal
        ? this.minutesInWeek(userId, subjectScope, week, since, until)
        : Promise.resolve(0),
    ]);

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

  /** Minutos da semana no escopo: blocos concluídos que caem nela + Pomodoro. */
  private async minutesInWeek(
    userId: string,
    subject: Prisma.SubjectWhereInput | undefined,
    week: string,
    since: Date,
    until: Date,
  ): Promise<number> {
    const [blocks, focus] = await Promise.all([
      // Sem filtro de data: o bloco não tem data própria, e o dia dele sai do
      // início do plano + dayIndex (`weekMinutes`).
      this.prisma.studySession.findMany({
        where: { done: true, plan: { userId }, subject },
        select: {
          dayIndex: true,
          minutes: true,
          plan: { select: { createdAt: true } },
        },
      }),
      this.prisma.focusSession.findMany({
        where: { userId, completedAt: { gte: since, lt: until }, subject },
        select: { completedAt: true, durationSec: true },
      }),
    ]);
    return weekMinutes(
      blocks.map((b) => ({
        planCreatedAt: b.plan.createdAt,
        dayIndex: b.dayIndex,
        minutes: b.minutes,
      })),
      focus,
      week,
    );
  }
}
