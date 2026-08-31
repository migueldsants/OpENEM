import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CalibratedItem, triScoreFromItems } from '../common/irt';
import { shuffle } from '../common/shuffle';
import { xpForSimulation } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewService } from '../review/review.service';
import { FinishSimulationDto } from './dto/finish-simulation.dto';
import { StartSimulationDto } from './dto/start-simulation.dto';

export interface SimulationFinishResult {
  simulationId: string;
  total: number;
  correct: number;
  percentage: number;
  triScore: number | null;
  details: {
    questionId: string;
    isCorrect: boolean;
    chosenId: string | null;
    correctAlternativeId: string | null;
    explanation: string;
  }[];
  gamification?: GamificationDelta;
}

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
    private readonly gamification: GamificationService,
  ) {}

  async listTemplates() {
    const templates = await this.prisma.simulationTemplate.findMany({
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
    const subjectIds = [
      ...new Set(
        templates.map((t) => t.subjectId).filter((s): s is string => !!s),
      ),
    ];
    const subjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      questionCount: t.questionCount,
      timeLimitMin: t.timeLimitMin,
      subject: t.subjectId ? (subjectById.get(t.subjectId) ?? null) : null,
    }));
  }

  async start(userId: string, dto: StartSimulationDto) {
    const template = await this.prisma.simulationTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException('Template de simulado não encontrado');
    }

    // Filtros (issue #40): template por área OU filtros customizados do DTO
    // (matéria/tópico + contagem). Os customizados valem para qualquer
    // template — na prática o frontend usa o template "custom" semeado.
    let where: Prisma.QuestionWhereInput =
      template.scope === 'AREA' && template.subjectId
        ? { topic: { subjectId: template.subjectId } }
        : {};
    let questionCount = template.questionCount;

    if (dto.subjectId || dto.topicId || dto.questionCount) {
      if (dto.topicId) {
        where = { topicId: dto.topicId };
      } else if (dto.subjectId) {
        where = { topic: { subjectId: dto.subjectId } };
      }
      if (dto.questionCount) questionCount = dto.questionCount;
    }

    if (dto.subjectId || dto.topicId) {
      const subjectExists = await this.prisma.subject.count({
        where: dto.topicId
          ? { topics: { some: { id: dto.topicId } } }
          : { id: dto.subjectId },
      });
      if (subjectExists === 0) {
        throw new BadRequestException('Matéria ou assunto não encontrado');
      }
    }

    // Pool com o peso Pareto do tópico (issue #40): permite ordenar por
    // frequência no ENEM em vez de sorteio puro.
    const pool = await this.prisma.question.findMany({
      where,
      select: { id: true, topic: { select: { weight: true } } },
    });
    if (pool.length === 0) {
      throw new BadRequestException(
        'Não há questões disponíveis para este simulado',
      );
    }

    // Ordenação Pareto: embaralha primeiro (desempate dentro do mesmo peso)
    // e ordena por peso decrescente — os tópicos mais frequentes no ENEM
    // entram primeiro. Sem pareto, permanece sorteio uniforme.
    const shuffled = shuffle(pool);
    const ranked = dto.pareto
      ? [...shuffled].sort(
          (a, b) => (b.topic?.weight ?? 1) - (a.topic?.weight ?? 1),
        )
      : shuffled;
    const selectedIds = ranked.slice(0, questionCount).map((q) => q.id);

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

    // Limite de tempo proporcional ao nº de questões (issue #40): 3 min/questão
    // quando o simulado é customizado e o template não define tempo (ou o nº
    // difere do padrão do template).
    let timeLimitMin = template.timeLimitMin;
    if (
      (dto.subjectId || dto.topicId || dto.questionCount) &&
      (timeLimitMin == null || dto.questionCount)
    ) {
      timeLimitMin = Math.max(5, Math.round(questions.length * 3));
    }

    return {
      id: simulation.id,
      startedAt: simulation.startedAt,
      timeLimitMin,
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
        triScore: true,
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
      triScore: simulation.triScore,
      answersCount: simulation._count.answers,
    };
  }

  async finish(
    userId: string,
    id: string,
    dto: FinishSimulationDto,
  ): Promise<SimulationFinishResult> {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id },
      include: { template: { select: { timeLimitMin: true } } },
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

    // Deduplica por questão (última resposta vence): evita inflar rawScore/triScore
    // e duplicar Answers/atualizações SM-2 se o cliente reenviar a mesma questão.
    const dedup = new Map<string, (typeof dto.answers)[number]>();
    for (const a of dto.answers) dedup.set(a.questionId, a);
    const answers = [...dedup.values()];

    const questionIds = answers.map((a) => a.questionId);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        topicId: true,
        explanation: true,
        discrimination: true,
        irtDifficulty: true,
        guessing: true,
        alternatives: { select: { id: true, isCorrect: true } },
      },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));

    // Persistência atômica (issue #49): respostas, itens de revisão e o update
    // do simulado em uma única transação — uma falha no meio não deixa estado
    // parcial, e um reenvio concorrente não duplica respostas/XP.
    const finishedAt = new Date();
    const txResult = await this.prisma.$transaction(async (tx) => {
      // Re-checa dentro da transação: outro request pode ter finalizado entre
      // a leitura inicial e agora.
      const fresh = await tx.simulation.findUnique({
        where: { id },
        select: { finishedAt: true },
      });
      if (fresh?.finishedAt) {
        throw new BadRequestException('Simulado já finalizado');
      }

      let correctCount = 0;
      const details: {
        questionId: string;
        isCorrect: boolean;
        chosenId: string | null;
        correctAlternativeId: string | null;
        explanation: string;
      }[] = [];
      const irtItems: CalibratedItem[] = [];
      let allCalibrated = true;

      for (const answer of answers) {
        const question = byId.get(answer.questionId);
        if (!question) continue;
        const correct = question.alternatives.find((a) => a.isCorrect) ?? null;
        const isCorrect = !!answer.chosenId && answer.chosenId === correct?.id;
        if (isCorrect) correctCount += 1;

        await tx.answer.create({
          data: {
            userId,
            questionId: question.id,
            chosenId: answer.chosenId,
            isCorrect,
            timeSpentSec: answer.timeSpentSec,
            simulationId: id,
          },
        });
        await this.review.recordOutcome(
          userId,
          question.topicId,
          isCorrect,
          tx,
        );

        // Coleta os parâmetros TRI; basta uma questão sem calibração para anular a nota.
        if (
          question.discrimination !== null &&
          question.irtDifficulty !== null &&
          question.guessing !== null
        ) {
          irtItems.push({
            a: question.discrimination,
            b: question.irtDifficulty,
            c: question.guessing,
            correct: isCorrect,
          });
        } else {
          allCalibrated = false;
        }

        details.push({
          questionId: question.id,
          isCorrect,
          chosenId: answer.chosenId ?? null,
          correctAlternativeId: correct?.id ?? null,
          explanation: question.explanation,
        });
      }

      const total = details.length;
      const triScore =
        total > 0 && allCalibrated ? triScoreFromItems(irtItems) : null;

      await tx.simulation.update({
        where: { id },
        data: { finishedAt, rawScore: correctCount, triScore },
      });

      return { total, correctCount, triScore, details };
    });

    const { total, correctCount, triScore, details } = txResult;

    // XP por simulado concluído (issue #17): base + por acerto + bônus de velocidade.
    const limitMin = simulation.template.timeLimitMin;
    const elapsedSec = Math.max(
      0,
      (finishedAt.getTime() - simulation.startedAt.getTime()) / 1000,
    );
    const fractionOfLimit =
      limitMin != null ? elapsedSec / (limitMin * 60) : null;
    const baseXp = xpForSimulation(correctCount, fractionOfLimit);
    const detail = `${correctCount} acerto(s) em ${total} questões`;
    const gamification = await this.gamification.recordActivity(
      userId,
      'SIMULATION',
      baseXp,
      detail,
      finishedAt,
      { simulationsCount: 1 },
    );

    return {
      simulationId: id,
      total,
      correct: correctCount,
      percentage: total ? Math.round((correctCount / total) * 100) : 0,
      triScore,
      details,
      ...(gamification ? { gamification } : {}),
    };
  }
}
