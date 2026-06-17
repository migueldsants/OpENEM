import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    return this.prisma.essayEvaluation.create({
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
  }
}
