import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dayAreas, dayRange } from '../common/enem-import/mapping';
import { CalibratedItem, triScoreFromItems } from '../common/irt';
import { allocateByWeight, sampleOffsets } from '../common/sampling';
import { shuffle } from '../common/shuffle';
import { xpForSimulation } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUESTION_PUBLIC_SELECT } from '../questions/question.select';
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
    explanation: string | null;
  }[];
  gamification?: GamificationDelta;
}

/** Peso Pareto atribuído a quem ainda não tem assunto classificado (1..5). */
const NEUTRAL_WEIGHT = 3;

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
    private readonly gamification: GamificationService,
  ) {}

  async listTemplates() {
    // Arquivados ficam fora: simulados de demonstração e dias de prova que o
    // dataset trouxe quase vazios. O histórico ligado a eles continua.
    const templates = await this.prisma.simulationTemplate.findMany({
      where: { archived: false },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
      include: {
        examYear: {
          select: {
            slug: true,
            year: true,
            label: true,
            isReapplication: true,
          },
        },
      },
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
    const lista = templates.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      questionCount: t.questionCount,
      timeLimitMin: t.timeLimitMin,
      subject: t.subjectId ? (subjectById.get(t.subjectId) ?? null) : null,
      exam: t.examYear,
      day: t.day,
      // Áreas do dia, na ordem do caderno — a ordem mudou em 2009 e em 2017.
      areas:
        t.examYear && (t.day === 1 || t.day === 2)
          ? dayAreas(t.examYear.year, t.day)
          : [],
    }));
    // Provas oficiais: a mais recente primeiro, a regular antes da
    // reaplicação e o 1º dia antes do 2º.
    return lista.sort((a, b) => {
      if (!a.exam || !b.exam) return a.exam ? 1 : b.exam ? -1 : 0;
      return (
        b.exam.year - a.exam.year ||
        Number(a.exam.isReapplication) - Number(b.exam.isReapplication) ||
        (a.day ?? 0) - (b.day ?? 0)
      );
    });
  }

  /**
   * Questões de um dia de prova oficial, na ordem do caderno. A língua
   * estrangeira segue a escolha do aluno (perfil), para ele não receber a
   * mesma questão em inglês e em espanhol.
   */
  private async examQuestionIds(
    userId: string,
    examYearId: string,
    day: number,
    language?: string,
  ): Promise<string[]> {
    const idioma =
      language ??
      (
        await this.prisma.profile.findUnique({
          where: { userId },
          select: { foreignLanguage: true },
        })
      )?.foreignLanguage ??
      'ingles';
    const linhas = await this.prisma.question.findMany({
      where: {
        examYearId,
        number: dayRange(day === 2 ? 2 : 1),
        OR: [{ language: null }, { language: idioma }],
      },
      orderBy: { number: 'asc' },
      select: { id: true },
    });
    return linhas.map((l) => l.id);
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

    if (
      dto.subjectAreaId ||
      dto.subjectId ||
      dto.topicId ||
      dto.questionCount
    ) {
      if (dto.topicId) {
        where = { topicId: dto.topicId };
      } else if (dto.subjectId) {
        where = { topic: { subjectId: dto.subjectId } };
      } else if (dto.subjectAreaId) {
        where = { subjectAreaId: dto.subjectAreaId };
      }
      if (dto.questionCount) questionCount = dto.questionCount;
    }

    // Língua estrangeira: o banco guarda a mesma questão em inglês e espanhol.
    // Sem o recorte, o aluno recebe as duas versões na mesma prova.
    if (dto.language) {
      where = {
        ...where,
        OR: [{ language: null }, { language: dto.language }],
      };
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

    // Prova oficial: o dia inteiro, na ordem do caderno — sem sorteio. É o que
    // reproduz o ENEM de verdade; os filtros customizados não se aplicam.
    const provaOficial = template.scope === 'EXAM' && !!template.examYearId;
    const selectedIds = provaOficial
      ? await this.examQuestionIds(
          userId,
          template.examYearId!,
          template.day ?? 1,
          dto.language,
        )
      : await this.samplePool(where, questionCount, dto.pareto);
    if (selectedIds.length === 0) {
      throw new BadRequestException(
        'Não há questões disponíveis para este simulado',
      );
    }

    const simulation = await this.prisma.simulation.create({
      data: { userId, templateId: template.id },
    });

    const encontradas = await this.prisma.question.findMany({
      where: { id: { in: selectedIds } },
      // Sem gabarito durante a prova.
      select: QUESTION_PUBLIC_SELECT,
    });
    // O `in` devolve na ordem do banco; a prova segue a ordem escolhida (a do
    // caderno na prova oficial, a do sorteio nas demais).
    const posicao = new Map(selectedIds.map((id, i) => [id, i]));
    const questions = encontradas.sort(
      (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0),
    );

    // Limite de tempo proporcional ao nº de questões (issue #40): 3 min/questão
    // quando o simulado é customizado e o template não define tempo (ou o nº
    // difere do padrão do template). A prova oficial usa o tempo oficial.
    let timeLimitMin = template.timeLimitMin;
    if (
      !provaOficial &&
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

  /**
   * Sorteia as questões do simulado sem carregar o banco na memória: agrupa por
   * assunto para saber os tamanhos, distribui as vagas (issue #40: peso Pareto)
   * e lê de cada assunto apenas o que lhe coube, a partir de um deslocamento
   * aleatório. Questões ainda sem assunto classificado entram como um estrato
   * de peso neutro — do contrário o banco oficial do ENEM ficaria de fora.
   */
  private async samplePool(
    where: Prisma.QuestionWhereInput,
    questionCount: number,
    pareto?: boolean,
  ): Promise<string[]> {
    const grupos = await this.prisma.question.groupBy({
      by: ['topicId'],
      where,
      _count: { _all: true },
    });
    if (grupos.length === 0) return [];

    let pesoPorTopico = new Map<string, number>();
    if (pareto) {
      const ids = grupos
        .map((g) => g.topicId)
        .filter((id): id is string => id !== null);
      const topicos = await this.prisma.topic.findMany({
        where: { id: { in: ids } },
        select: { id: true, weight: true },
      });
      pesoPorTopico = new Map(topicos.map((t) => [t.id, t.weight]));
    }

    const estratos = grupos.map((g) => ({
      key: g.topicId,
      available: g._count._all,
      // Sem pareto o sorteio é uniforme (peso 1 para todos); com pareto, o peso
      // do assunto. NEUTRAL_WEIGHT vale para quem ainda não foi classificado.
      weight: pareto
        ? ((g.topicId ? pesoPorTopico.get(g.topicId) : NEUTRAL_WEIGHT) ??
          NEUTRAL_WEIGHT)
        : 1,
    }));

    const vagas = allocateByWeight(estratos, questionCount);
    const disponivel = new Map(estratos.map((e) => [e.key, e.available]));
    const ids: string[] = [];
    for (const [topicId, quantas] of vagas) {
      if (quantas <= 0) continue;
      // Uma leitura por vaga, em posições sorteadas: continua lendo só o que
      // o simulado usa, mas espalhado pelo estrato inteiro.
      const posicoes = sampleOffsets(
        disponivel.get(topicId) ?? quantas,
        quantas,
      );
      for (const skip of posicoes) {
        const [linha] = await this.prisma.question.findMany({
          where: { ...where, topicId },
          select: { id: true },
          orderBy: { id: 'asc' },
          skip,
          take: 1,
        });
        if (linha) ids.push(linha.id);
      }
    }
    // Embaralha para as questões não saírem agrupadas por assunto na prova.
    return shuffle(ids);
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
        alternatives: {
          select: { id: true, isCorrect: true },
          orderBy: { position: 'asc' },
        },
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
        explanation: string | null;
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
        // Idem answers.service: sem assunto classificado, não há o que reagendar.
        if (question.topicId) {
          await this.review.recordOutcome(
            userId,
            question.topicId,
            isCorrect,
            tx,
          );
        }

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
