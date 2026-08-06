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
import {
  computeNextReview,
  qualityFromCorrectness,
} from '../common/spaced-repetition';

export interface ReviewGradeResult {
  id: string;
  userId: string;
  topicId: string;
  easeFactor: number;
  intervalD: number;
  repetition: number;
  dueAt: Date;
  gamification?: GamificationDelta;
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  /** Atualiza (ou cria) o item de revisão de um assunto após uma tentativa. */
  async recordOutcome(
    userId: string,
    topicId: string,
    isCorrect: boolean,
  ): Promise<void> {
    await this.reschedule(userId, topicId, qualityFromCorrectness(isCorrect));
  }

  /** Fila de revisão: assuntos com revisão vencida, do mais atrasado ao mais recente. */
  queue(userId: string) {
    return this.prisma.reviewItem.findMany({
      where: { userId, dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      select: {
        id: true,
        topicId: true,
        intervalD: true,
        repetition: true,
        dueAt: true,
        topic: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  /** Reagenda explicitamente um item (ex.: usuário avalia a própria lembrança 0..5). */
  async grade(
    userId: string,
    reviewItemId: string,
    quality: number,
  ): Promise<ReviewGradeResult> {
    const item = await this.prisma.reviewItem.findUnique({
      where: { id: reviewItemId },
    });
    if (!item) {
      throw new NotFoundException('Item de revisão não encontrado');
    }
    if (item.userId !== userId) {
      throw new ForbiddenException();
    }
    const next = computeNextReview(
      {
        easeFactor: item.easeFactor,
        intervalD: item.intervalD,
        repetition: item.repetition,
      },
      quality,
    );
    const updated = await this.prisma.reviewItem.update({
      where: { id: reviewItemId },
      data: {
        easeFactor: next.easeFactor,
        intervalD: next.intervalD,
        repetition: next.repetition,
        dueAt: next.dueAt,
      },
    });
    // XP por autoavaliação de revisão (issue #17).
    const gamification = await this.gamification.recordActivity(
      userId,
      'REVIEW',
      POINTS.reviewGrade,
      'Autoavaliação de revisão',
      new Date(),
      { reviewsCount: 1 },
    );
    return { ...updated, ...(gamification ? { gamification } : {}) };
  }

  private async reschedule(userId: string, topicId: string, quality: number) {
    const existing = await this.prisma.reviewItem.findUnique({
      where: { userId_topicId: { userId, topicId } },
    });
    const next = computeNextReview(
      existing
        ? {
            easeFactor: existing.easeFactor,
            intervalD: existing.intervalD,
            repetition: existing.repetition,
          }
        : { easeFactor: 2.5, intervalD: 0, repetition: 0 },
      quality,
    );
    await this.prisma.reviewItem.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: {
        userId,
        topicId,
        easeFactor: next.easeFactor,
        intervalD: next.intervalD,
        repetition: next.repetition,
        dueAt: next.dueAt,
      },
      update: {
        easeFactor: next.easeFactor,
        intervalD: next.intervalD,
        repetition: next.repetition,
        dueAt: next.dueAt,
      },
    });
  }
}
