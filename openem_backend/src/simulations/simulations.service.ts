import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SimulationTemplate } from '@prisma/client';
import { dayAreas, dayRange } from '../common/enem-import/mapping';
import { CalibratedItem, triScoreFromItems } from '../common/irt';
import { allocateByWeight, sampleOffsets } from '../common/sampling';
import { shuffle } from '../common/shuffle';
import { answersToGrade } from '../common/simulation-answers';
import { xpForSimulation } from '../common/gamification';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfQuestion } from '../common/pdf/simulado-pdf';
import { QUESTION_PUBLIC_SELECT } from '../questions/question.select';
import { ReviewService } from '../review/review.service';
import {
  buildQuestionWhere,
  describeFilters,
  hasContentFilter,
  parseFilters,
  resolveTimeLimit,
  normalizeFilters,
  serializeFilters,
  SimulationFilters,
} from '../common/simulation-filters';

import { FinishSimulationDto } from './dto/finish-simulation.dto';
import {
  CreateTemplateDto,
  SimulationFiltersDto,
  StartSimulationDto,
} from './dto/start-simulation.dto';

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

/**
 * Template genérico dos simulados personalizados que o aluno não salvou. O id
 * é fixo porque o seed também o cria — os dois precisam apontar para a mesma
 * linha, senão o histórico fica espalhado entre dois "Personalizado".
 */
const CUSTOM_TEMPLATE_ID = 'seed-template-custom';

/** Letra de alternativa antiga, sem `letter` gravado (questões autorais). */
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

@Injectable()
export class SimulationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly review: ReviewService,
    private readonly gamification: GamificationService,
  ) {}

  async listTemplates(userId?: string) {
    // Arquivados ficam fora: simulados de demonstração e dias de prova que o
    // dataset trouxe quase vazios. O histórico ligado a eles continua.
    // Simulado salvo só aparece para quem o criou (ownerId nulo = catálogo).
    const templates = await this.prisma.simulationTemplate.findMany({
      where: {
        archived: false,
        OR: [{ ownerId: null }, ...(userId ? [{ ownerId: userId }] : [])],
      },
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
      subjectAreaId: t.subjectAreaId,
      /** Simulado salvo pelo próprio aluno — o único que ele pode apagar. */
      owned: !!t.ownerId,
      filters: t.ownerId ? parseFilters(t.filters) : null,
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

  /**
   * Filtros efetivos do simulado: os do template salvo, sobrescritos pelos que
   * vieram na requisição, mais o idioma do perfil quando o aluno não escolheu.
   * É aqui que a língua estrangeira para de vir em dobro: sem esse recorte, a
   * mesma questão entra em inglês E em espanhol na mesma prova.
   */
  private async effectiveFilters(
    userId: string,
    dto: SimulationFiltersDto,
    templateFilters?: string | null,
  ): Promise<SimulationFilters> {
    const doTemplate = parseFilters(templateFilters);
    const doPedido = normalizeFilters(dto);
    const filtros: SimulationFilters = { ...doTemplate, ...doPedido };
    if (!filtros.language) {
      const perfil = await this.prisma.profile.findUnique({
        where: { userId },
        select: { foreignLanguage: true },
      });
      filtros.language = perfil?.foreignLanguage ?? 'ingles';
    }
    return filtros;
  }

  /**
   * Quantas questões existem para um recorte. É o que impede o montador de
   * oferecer um tema vazio: a tela mostra o número antes de o aluno começar.
   */
  async preview(userId: string, dto: SimulationFiltersDto) {
    const filtros = await this.effectiveFilters(userId, dto);
    const where = buildQuestionWhere(filtros, userId);
    const [available, classified] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.count({
        where: { AND: [where, { topicId: { not: null } }] },
      }),
    ]);
    const questionCount = Math.min(filtros.questionCount ?? 10, available);
    return {
      available,
      /** Quantas já têm assunto: explica por que um tema tem pouca questão. */
      classified,
      questionCount,
      timeLimitMin: resolveTimeLimit(filtros, questionCount || 1),
      description: await this.describe(filtros),
    };
  }

  /** Rótulo legível do recorte, com os nomes resolvidos no banco. */
  private async describe(filtros: SimulationFilters): Promise<string> {
    const [areas, subjects, topics, exams] = await Promise.all([
      filtros.subjectAreaIds?.length
        ? this.prisma.subjectArea.findMany({
            where: { id: { in: filtros.subjectAreaIds } },
            select: { name: true },
          })
        : ([] as { name: string }[]),
      filtros.subjectIds?.length
        ? this.prisma.subject.findMany({
            where: { id: { in: filtros.subjectIds } },
            select: { name: true },
          })
        : ([] as { name: string }[]),
      filtros.topicIds?.length
        ? this.prisma.topic.findMany({
            where: { id: { in: filtros.topicIds } },
            select: { name: true },
          })
        : ([] as { name: string }[]),
      filtros.examSlugs?.length
        ? this.prisma.examYear.findMany({
            where: { slug: { in: filtros.examSlugs } },
            select: { label: true },
          })
        : ([] as { label: string }[]),
    ]);
    return describeFilters(filtros, {
      areas: areas.map((a) => a.name),
      subjects: subjects.map((s) => s.name),
      topics: topics.map((t) => t.name),
      exams: exams.map((e) => e.label),
    });
  }

  /** Salva um recorte como simulado personalizado do aluno. */
  async createTemplate(userId: string, dto: CreateTemplateDto) {
    const filtros = normalizeFilters(dto);
    const quantas = filtros.questionCount ?? 10;
    const salvo = await this.prisma.simulationTemplate.create({
      data: {
        name: dto.name.trim() || 'Simulado personalizado',
        scope: 'CUSTOM',
        ownerId: userId,
        questionCount: quantas,
        timeLimitMin: resolveTimeLimit(filtros, quantas),
        filters: serializeFilters(filtros),
      },
    });
    return {
      id: salvo.id,
      name: salvo.name,
      scope: salvo.scope,
      questionCount: salvo.questionCount,
      timeLimitMin: salvo.timeLimitMin,
      owned: true,
      filters: filtros,
      description: await this.describe(filtros),
    };
  }

  /** Apaga um simulado salvo. Só o dono apaga, e só os dele. */
  async deleteTemplate(userId: string, id: string) {
    const template = await this.prisma.simulationTemplate.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    if (!template) throw new NotFoundException('Simulado não encontrado');
    if (template.ownerId !== userId) {
      throw new ForbiddenException(
        'Só dá para apagar um simulado que você mesmo salvou',
      );
    }
    // Simulados já feitos apontam para o template. Apagar levaria junto o
    // histórico de desempenho do aluno, então nesse caso ele só é arquivado.
    const feitos = await this.prisma.simulation.count({
      where: { templateId: id },
    });
    if (feitos > 0) {
      await this.prisma.simulationTemplate.update({
        where: { id },
        data: { archived: true },
      });
      return { id, archived: true };
    }
    await this.prisma.simulationTemplate.delete({ where: { id } });
    return { id, archived: false };
  }

  /**
   * Resolve o conjunto de questões de um simulado: prova oficial na ordem do
   * caderno, ou sorteio estratificado sobre os filtros. Start e PDF passam por
   * aqui, para o caderno impresso ser exatamente o mesmo simulado da tela.
   */
  private async resolveQuestionIds(
    userId: string,
    dto: SimulationFiltersDto & { templateId?: string },
  ): Promise<{
    ids: string[];
    filters: SimulationFilters;
    template: SimulationTemplate | null;
    timeLimitMin: number | null;
    title: string;
  }> {
    const template = dto.templateId
      ? await this.prisma.simulationTemplate.findUnique({
          where: { id: dto.templateId },
        })
      : null;
    if (dto.templateId && !template) {
      throw new NotFoundException('Template de simulado não encontrado');
    }
    if (template?.ownerId && template.ownerId !== userId) {
      throw new ForbiddenException();
    }

    const filtros = await this.effectiveFilters(userId, dto, template?.filters);

    // Prova oficial: o dia inteiro, na ordem do caderno e sem sorteio. É o que
    // reproduz o ENEM de verdade; os filtros de conteúdo não se aplicam.
    if (template?.scope === 'EXAM' && template.examYearId) {
      const ids = await this.examQuestionIds(
        userId,
        template.examYearId,
        template.day ?? 1,
        filtros.language,
      );
      return {
        ids,
        filters: filtros,
        template,
        timeLimitMin: template.timeLimitMin,
        title: template.name,
      };
    }

    // Template do catálogo (por área ou por matéria): vira filtro, como
    // qualquer outro — e o do aluno prevalece quando ele escolheu algo.
    if (template && !template.ownerId) {
      if (template.subjectAreaId && !filtros.subjectAreaIds?.length) {
        filtros.subjectAreaIds = [template.subjectAreaId];
      }
      if (template.subjectId && !filtros.subjectIds?.length) {
        filtros.subjectIds = [template.subjectId];
      }
    }
    const quantas = filtros.questionCount ?? template?.questionCount ?? 10;
    filtros.questionCount = quantas;

    const where = buildQuestionWhere(filtros, userId);
    const ids = await this.samplePool(where, quantas, filtros.pareto);
    return {
      ids,
      filters: filtros,
      template,
      timeLimitMin: resolveTimeLimit(filtros, ids.length || quantas),
      title: template?.name ?? 'Simulado personalizado',
    };
  }

  async start(userId: string, dto: StartSimulationDto) {
    const { ids, filters, template, timeLimitMin } =
      await this.resolveQuestionIds(userId, dto);

    if (ids.length === 0) {
      throw new BadRequestException(
        hasContentFilter(filters)
          ? 'Nenhuma questão combina com esses filtros. Tente menos temas, ou inclua a área inteira.'
          : 'Não há questões disponíveis para este simulado',
      );
    }

    // Todo simulado precisa de um template para entrar no histórico. O
    // personalizado sem template salvo usa este registro genérico, criado aqui
    // na primeira vez em vez de depender do seed ter rodado.
    let templateId = template?.id;
    if (!templateId) {
      templateId = (
        await this.prisma.simulationTemplate.upsert({
          where: { id: CUSTOM_TEMPLATE_ID },
          update: {},
          create: {
            id: CUSTOM_TEMPLATE_ID,
            name: 'Personalizado',
            scope: 'CUSTOM',
            questionCount: 10,
          },
        })
      ).id;
    }

    // Salvar o recorte para refazer depois é opcional e não atrapalha o início.
    let savedTemplateId: string | undefined;
    if (dto.saveAs?.trim()) {
      const salvo = await this.createTemplate(userId, {
        ...filters,
        name: dto.saveAs,
      } as CreateTemplateDto);
      savedTemplateId = salvo.id;
    }

    // A lista de questões fica gravada: é ela que o finish() corrige. O Set
    // protege o índice único caso o sorteio repita uma linha (uma importação
    // rodando ao mesmo tempo desloca os offsets).
    const questionIds = [...new Set(ids)];
    const simulation = await this.prisma.simulation.create({
      data: {
        userId,
        templateId,
        questions: {
          createMany: {
            data: questionIds.map((questionId, position) => ({
              questionId,
              position,
            })),
          },
        },
      },
    });

    const encontradas = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      // Sem gabarito durante a prova.
      select: QUESTION_PUBLIC_SELECT,
    });
    // O `in` devolve na ordem do banco; a prova segue a ordem escolhida (a do
    // caderno na prova oficial, a do sorteio nas demais).
    const posicao = new Map(questionIds.map((id, i) => [id, i]));
    const questions = encontradas.sort(
      (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0),
    );

    return {
      id: simulation.id,
      startedAt: simulation.startedAt,
      timeLimitMin,
      questionCount: questions.length,
      questions,
      ...(savedTemplateId ? { savedTemplateId } : {}),
    };
  }

  /**
   * Dados do caderno em PDF: as questões COM gabarito e comentário, mais o
   * título e o tempo. Aceita o mesmo recorte do start, ou o id de um simulado
   * já feito — é assim que o aluno imprime a prova que acabou de resolver.
   */
  async pdfData(
    userId: string,
    dto: SimulationFiltersDto & { templateId?: string; title?: string },
    simulationId?: string,
  ): Promise<{
    questions: PdfQuestion[];
    title: string;
    subtitle: string;
    timeLimitMin: number | null;
  }> {
    let ids: string[];
    let title: string;
    let timeLimitMin: number | null;
    let subtitle: string;
    /** Só a prova oficial mantém a numeração do caderno (1..180). */
    let numeracaoOficial = false;

    if (simulationId) {
      const simulation = await this.prisma.simulation.findUnique({
        where: { id: simulationId },
        select: {
          userId: true,
          template: { select: { name: true, timeLimitMin: true } },
          answers: {
            select: { questionId: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!simulation) throw new NotFoundException('Simulado não encontrado');
      if (simulation.userId !== userId) throw new ForbiddenException();
      ids = [...new Set(simulation.answers.map((a) => a.questionId))];
      if (ids.length === 0) {
        throw new BadRequestException(
          'Este simulado ainda não tem questões respondidas para imprimir',
        );
      }
      title = simulation.template.name;
      timeLimitMin = simulation.template.timeLimitMin;
      subtitle = `${ids.length} questões`;
    } else {
      const resolvido = await this.resolveQuestionIds(userId, dto);
      if (resolvido.ids.length === 0) {
        throw new BadRequestException(
          'Nenhuma questão combina com esses filtros',
        );
      }
      ids = resolvido.ids;
      numeracaoOficial = resolvido.template?.scope === 'EXAM';
      title = dto.title?.trim() || resolvido.title;
      timeLimitMin = resolvido.timeLimitMin;
      subtitle = await this.describe({
        ...resolvido.filters,
        questionCount: ids.length,
      });
    }

    const linhas = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        number: true,
        code: true,
        statement: true,
        questionPrompt: true,
        explanation: true,
        subjectArea: { select: { name: true } },
        topic: { select: { name: true, subject: { select: { name: true } } } },
        alternatives: {
          select: {
            letter: true,
            text: true,
            imageUrl: true,
            isCorrect: true,
            position: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    const posicao = new Map(ids.map((id, i) => [id, i]));
    const ordenadas = linhas.sort(
      (a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0),
    );

    const questions: PdfQuestion[] = ordenadas.map((q, i) => ({
      // Prova oficial numera pelo caderno; simulado montado numera de 1 a N —
      // um sorteio com a numeração original repetiria números e confundiria o
      // cartão-resposta.
      number: numeracaoOficial ? (q.number ?? i + 1) : i + 1,
      code: q.code,
      areaName: q.subjectArea?.name ?? null,
      subjectName: q.topic?.subject.name ?? null,
      topicName: q.topic?.name ?? null,
      statement: q.statement,
      questionPrompt: q.questionPrompt,
      explanation: q.explanation,
      alternatives: q.alternatives.map((a, j) => ({
        letter: a.letter ?? LETTERS[j] ?? String(j + 1),
        text: a.text,
        imageUrl: a.imageUrl,
        isCorrect: a.isCorrect,
      })),
    }));

    return { questions, title, subtitle, timeLimitMin };
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
      include: {
        template: { select: { timeLimitMin: true } },
        questions: {
          select: { questionId: true },
          orderBy: { position: 'asc' },
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

    // Só as questões do simulado entram, uma vez cada (a última resposta
    // vence): sem isso o cliente inflava rawScore, triScore e XP entregando
    // questões de fora ou a mesma questão repetida.
    const answers = answersToGrade(
      dto.answers,
      simulation.questions.map((q) => q.questionId),
    );

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
