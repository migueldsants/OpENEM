import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { shuffle } from '../common/shuffle';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewService } from '../review/review.service';
import { FinishSimulationDto } from './dto/finish-simulation.dto';
import { StartSimulationDto } from './dto/start-simulation.dto';

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
  ) {}

  async start(userId: string, dto: StartSimulationDto) {
    const template = await this.prisma.simulationTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Template de simulado não encontrado');
    }

    const where: Prisma.QuestionWhereInput =
      template.scope === 'AREA' && template.subjectId
        ? { topic: { subjectId: template.subjectId } }
        : {};

    const pool = await this.prisma.question.findMany({
      where,
      select: { id: true },
    });
    if (pool.length === 0) {
      throw new BadRequestException(
        'Não há questões disponíveis para este simulado',
      );
    }
    const selectedIds = shuffle(pool)
      .slice(0, template.questionCount)
      .map((q) => q.id);

    const simulation = await this.prisma.simulation.create({
      data: { userId, templateId: template.id },
    });

    const questions = await this.prisma.question.findMany({
      where: { id: { in: selectedIds } },
      select: {
        id: true,
        statement: true,
        difficulty: true,
        topic: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true } },
          },
        },
        // Sem gabarito durante a prova.
        alternatives: { select: { id: true, text: true } },
      },
    });

    return {
      id: simulation.id,
      startedAt: simulation.startedAt,
      timeLimitMin: template.timeLimitMin,
      questionCount: questions.length,
      questions,
    };
  }

  async get(userId: string, id: string) {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        startedAt: true,
        finishedAt: true,
        rawScore: true,
        _count: { select: { answers: true } },
      },
    });
    if (!simulation) {
      throw new NotFoundException('Simulado não encontrado');
    }
    if (simulation.userId !== userId) {
      throw new ForbiddenException();
    }
    return {
      id: simulation.id,
      startedAt: simulation.startedAt,
      finishedAt: simulation.finishedAt,
      rawScore: simulation.rawScore,
      answersCount: simulation._count.answers,
    };
  }

  async finish(userId: string, id: string, dto: FinishSimulationDto) {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id },
    });
    if (!simulation) {
      throw new NotFoundException('Simulado não encontrado');
    }
    if (simulation.userId !== userId) {
      throw new ForbiddenException();
    }
    if (simulation.finishedAt) {
      throw new BadRequestException('Simulado já finalizado');
    }

    const questionIds = dto.answers.map((a) => a.questionId);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        topicId: true,
        alternatives: { select: { id: true, isCorrect: true } },
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    const details: {
      questionId: string;
      isCorrect: boolean;
      correctAlternativeId: string | null;
    }[] = [];

    for (const answer of dto.answers) {
      const question = byId.get(answer.questionId);
      if (!question) continue;
      const correct = question.alternatives.find((a) => a.isCorrect) ?? null;
      const isCorrect = !!answer.chosenId && answer.chosenId === correct?.id;
      if (isCorrect) correctCount += 1;

      await this.prisma.answer.create({
        data: {
          userId,
          questionId: question.id,
          chosenId: answer.chosenId,
          isCorrect,
          timeSpentSec: answer.timeSpentSec,
          simulationId: id,
        },
      });
      await this.review.recordOutcome(userId, question.topicId, isCorrect);

      details.push({
        questionId: question.id,
        isCorrect,
        correctAlternativeId: correct?.id ?? null,
      });
    }

    const total = details.length;
    await this.prisma.simulation.update({
      where: { id },
      data: { finishedAt: new Date(), rawScore: correctCount },
    });

    return {
      simulationId: id,
      total,
      correct: correctCount,
      percentage: total ? Math.round((correctCount / total) * 100) : 0,
      details,
    };
  }
}
