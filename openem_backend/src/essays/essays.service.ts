import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, EssayEvaluation } from '@prisma/client';
import {
  activeEssayAiProvider,
  gradeEssayWithAi,
  isAiEssayConfigured,
} from '../common/essay-ai';
import {
  ResolvedAnnotation,
  resolveAnnotations,
} from '../common/essay-ai/annotations';
import { totalEssayScore } from '../common/essay-score';
import { xpForEssay } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { EvaluateEssayDto } from './dto/evaluate-essay.dto';

/** Tipo da avaliação com os campos JSON já parseados para o cliente. */
type EvaluationWithJson<T> = Omit<T, 'competencyFeedback' | 'annotations'> & {
  competencyFeedback: Record<string, string> | null;
  annotations: ResolvedAnnotation[] | null;
};

/** Faz o parse seguro de uma string JSON; devolve null em caso de falha. */
function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Converte as colunas JSON da avaliação (competencyFeedback, annotations) de
 * string para objeto, para a API entregar dados estruturados.
 */
function parseEvaluation<
  T extends { competencyFeedback: string | null; annotations: string | null },
>(ev: T | null): EvaluationWithJson<T> | null {
  if (!ev) return null;
  return {
    ...ev,
    competencyFeedback: safeParse<Record<string, string>>(
      ev.competencyFeedback,
    ),
    annotations: safeParse<ResolvedAnnotation[]>(ev.annotations),
  };
}

@Injectable()
export class EssaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  listPrompts() {
    return this.prisma.essayPrompt.findMany({
      // Mais recentes primeiro; dentro do mesmo ano, ENEM regular antes do PPL.
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
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
    const submission = await this.prisma.essaySubmission.create({
      data: { userId, promptId: dto.promptId, content: dto.content },
      select: { id: true, promptId: true, submittedAt: true },
    });
    // XP por enviar redação (issue #17). A avaliação dá bônus por nota depois.
    const gamification = await this.gamification.recordActivity(
      userId,
      'ESSAY',
      xpForEssay(null),
      'Redação enviada',
      new Date(submission.submittedAt),
      { essaysCount: 1 },
    );
    return { ...submission, ...(gamification ? { gamification } : {}) };
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
    return {
      ...submission,
      evaluation: parseEvaluation(submission.evaluation),
    };
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
    let created: EssayEvaluation;
    try {
      created = await this.prisma.essayEvaluation.create({
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
    return this.withEssayBonus(userId, created, total);
  }

  /** Indica se a correção por IA está habilitada e qual provedor está ativo. */
  aiAvailable() {
    return {
      available: isAiEssayConfigured(),
      provider: activeEssayAiProvider(),
    };
  }

  /** Corrige a redação por IA (provedor ativo) e persiste a avaliação. */
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
    const annotations = resolveAnnotations(
      submission.content,
      scores.annotations,
    );
    let created: EssayEvaluation;
    try {
      created = await this.prisma.essayEvaluation.create({
        data: {
          submissionId: id,
          c1: scores.c1,
          c2: scores.c2,
          c3: scores.c3,
          c4: scores.c4,
          c5: scores.c5,
          total,
          feedback: scores.feedback,
          competencyFeedback: JSON.stringify(scores.competencyFeedback),
          annotations: JSON.stringify(annotations),
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
    const parsed = parseEvaluation(created);
    const base = parsed ?? created;
    return this.withEssayBonus(userId, base, total);
  }

  /**
   * Concede bônus de XP por nota alta (issue #17). Retorna o resultado com o
   * delta de gamificação embutido (quando houver bônus).
   */
  private async withEssayBonus<T extends { total: number }>(
    userId: string,
    result: T,
    total: number,
  ): Promise<T & { gamification?: GamificationDelta }> {
    const submitXp = xpForEssay(null);
    const fullXp = xpForEssay(total);
    const bonus = Math.max(0, fullXp - submitXp);
    if (bonus <= 0) return result;
    const highScore = total >= 800 ? 1 : 0;
    const gamification = await this.gamification.recordActivity(
      userId,
      'ESSAY',
      bonus,
      `Nota ${total}/1000`,
      new Date(),
      { highScoreEssays: highScore },
    );
    return gamification ? { ...result, gamification } : result;
  }
}
