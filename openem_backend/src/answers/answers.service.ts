import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  explanation: string | null;
  /** Origem do comentário ("ai:<provedor>" quando gerado por IA). */
  explanationSource: string | null;
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
        explanationSource: true,
        alternatives: { select: { id: true, isCorrect: true } },
      },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }

    // Validação de posse do simulado (issue #49): sem isso qualquer usuário
    // poderia contaminar as métricas de um simulado alheio (ou inexistente).
    if (dto.simulationId) {
      const simulation = await this.prisma.simulation.findUnique({
        where: { id: dto.simulationId },
        select: {
          userId: true,
          finishedAt: true,
          // Basta saber se o simulado tem a lista e se a questão está nela.
          _count: { select: { questions: true } },
          questions: {
            where: { questionId: question.id },
            select: { id: true },
          },
        },
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
      // Simulados anteriores à lista de questões não a têm e seguem aceitando
      // qualquer questão; os demais só aceitam as próprias.
      if (
        simulation._count.questions > 0 &&
        simulation.questions.length === 0
      ) {
        throw new BadRequestException('Esta questão não faz parte do simulado');
      }
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

    // Questão ainda sem assunto classificado (as oficiais entram só com a área)
    // não alimenta a revisão espaçada — não há assunto que se possa reagendar.
    if (question.topicId) {
      await this.review.recordOutcome(userId, question.topicId, isCorrect);
    }
    const gamification = await this.gamification.recordAnswer(
      userId,
      isCorrect,
    );

    return {
      isCorrect,
      correctAlternativeId: correct?.id ?? null,
      explanation: question.explanation,
      explanationSource: question.explanationSource ?? null,
      ...(gamification ? { gamification } : {}),
    };
  }
}
