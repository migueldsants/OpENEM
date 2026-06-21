import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewService } from '../review/review.service';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { CreateAnswerDto } from './dto/create-answer.dto';

export interface AnswerResult {
  isCorrect: boolean;
  correctAlternativeId: string | null;
  explanation: string;
  gamification?: GamificationDelta;
}

@Injectable()
export class AnswersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
    private readonly gamification: GamificationService,
  ) {}

  async create(userId: string, dto: CreateAnswerDto): Promise<AnswerResult> {
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: {
        id: true,
        topicId: true,
        explanation: true,
        alternatives: { select: { id: true, isCorrect: true } },
      },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }

    const correct = question.alternatives.find((a) => a.isCorrect) ?? null;
    const isCorrect = !!dto.chosenId && dto.chosenId === correct?.id;

    await this.prisma.answer.create({
      data: {
        userId,
        questionId: question.id,
        chosenId: dto.chosenId,
        isCorrect,
        timeSpentSec: dto.timeSpentSec,
        simulationId: dto.simulationId,
      },
    });

    await this.review.recordOutcome(userId, question.topicId, isCorrect);
    const gamification = await this.gamification.recordAnswer(
      userId,
      isCorrect,
    );

    return {
      isCorrect,
      correctAlternativeId: correct?.id ?? null,
      explanation: question.explanation,
      ...(gamification ? { gamification } : {}),
    };
  }
}
