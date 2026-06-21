import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { gradeEssayWithAi, isAiEssayConfigured } from '../common/essay-ai';
import { totalEssayScore } from '../common/essay-score';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { EvaluateEssayDto } from './dto/evaluate-essay.dto';

@Injectable()
export class EssaysService {
  constructor(private readonly prisma: PrismaService) {}

  listPrompts() {
    return this.prisma.essayPrompt.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        theme: true,
        instructions: true,
        year: true,
      },
    });
  }

  async getPrompt(id: string) {
    const prompt = await this.prisma.essayPrompt.findUnique({ where: { id } });
    if (!prompt) {
      throw new NotFoundException('Tema de redação não encontrado');
    }
    return prompt;
  }

  async submit(userId: string, dto: CreateSubmissionDto) {
    const prompt = await this.prisma.essayPrompt.findUnique({
      where: { id: dto.promptId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundException('Tema de redação não encontrado');
    }
    return this.prisma.essaySubmission.create({
      data: { userId, promptId: dto.promptId, content: dto.content },
      select: { id: true, promptId: true, submittedAt: true },
    });
  }

  listSubmissions(userId: string) {
    return this.prisma.essaySubmission.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        submittedAt: true,
        prompt: { select: { id: true, title: true, theme: true } },
        evaluation: {
          select: {
            total: true,
            c1: true,
            c2: true,
            c3: true,
            c4: true,
            c5: true,
          },
        },
      },
    });
  }

  async getSubmission(userId: string, id: string) {
    const submission = await this.prisma.essaySubmission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        content: true,
        submittedAt: true,
        prompt: {
          select: { id: true, title: true, theme: true, instructions: true },
        },
        evaluation: true,
      },
    });
    if (!submission) {
      throw new NotFoundException('Redação não encontrada');
    }
    if (submission.userId !== userId) {
      throw new ForbiddenException();
    }
    return submission;
  }

  /** Registra a correção por rubrica (uma avaliação por redação). */
  async evaluate(userId: string, id: string, dto: EvaluateEssayDto) {
    const submission = await this.prisma.essaySubmission.findUnique({
      where: { id },
      select: { id: true, userId: true, evaluation: { select: { id: true } } },
    });
    if (!submission) {
      throw new NotFoundException('Redação não encontrada');
    }
    if (submission.userId !== userId) {
      throw new ForbiddenException();
    }
    if (submission.evaluation) {
      throw new ConflictException('Esta redação já foi avaliada');
    }

    const total = totalEssayScore(dto);
    try {
      return await this.prisma.essayEvaluation.create({
        data: {
          submissionId: id,
          c1: dto.c1,
          c2: dto.c2,
          c3: dto.c3,
          c4: dto.c4,
          c5: dto.c5,
          total,
          feedback: dto.feedback,
        },
      });
    } catch (e) {
      // Corrida: o índice único de submissionId garante uma avaliação por redação.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Esta redação já foi avaliada');
      }
      throw e;
    }
  }

  /** Indica se a correção por IA está habilitada (chave de API configurada). */
  aiAvailable() {
    return { available: isAiEssayConfigured() };
  }

  /** Corrige a redação por IA (Claude) e persiste a avaliação. */
  async evaluateWithAi(userId: string, id: string) {
    if (!isAiEssayConfigured()) {
      throw new ServiceUnavailableException(
        'Correção por IA indisponível. Use a correção por rubrica.',
      );
    }
    const submission = await this.prisma.essaySubmission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        content: true,
        evaluation: { select: { id: true } },
        prompt: { select: { theme: true, instructions: true } },
      },
    });
    if (!submission) {
      throw new NotFoundException('Redação não encontrada');
    }
    if (submission.userId !== userId) {
      throw new ForbiddenException();
    }
    if (submission.evaluation) {
      throw new ConflictException('Esta redação já foi avaliada');
    }

    const scores = await gradeEssayWithAi({
      theme: submission.prompt.theme,
      instructions: submission.prompt.instructions,
      content: submission.content,
    });
    const total = totalEssayScore(scores);
    try {
      return await this.prisma.essayEvaluation.create({
        data: {
          submissionId: id,
          c1: scores.c1,
          c2: scores.c2,
          c3: scores.c3,
          c4: scores.c4,
          c5: scores.c5,
          total,
          feedback: scores.feedback,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Esta redação já foi avaliada');
      }
      throw e;
    }
  }
}
