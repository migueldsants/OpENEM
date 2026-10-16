import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeCodeQuery } from '../common/enem-import/mapping';
import { PrismaService } from '../prisma/prisma.service';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import {
  QUESTION_DETAIL_SELECT,
  QUESTION_PUBLIC_SELECT,
} from './question.select';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro comum à listagem e às contagens. */
  private buildWhere(query: QueryQuestionsDto): Prisma.QuestionWhereInput {
    const where: Prisma.QuestionWhereInput = {};
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.topicId) where.topicId = query.topicId;
    if (query.subjectId) where.topic = { subjectId: query.subjectId };
    // Área: filtro obrigatório com o banco oficial, onde a maioria das questões
    // ainda não tem matéria/assunto e só o filtro por matéria não alcançaria.
    if (query.subjectAreaId) where.subjectAreaId = query.subjectAreaId;
    if (query.year) where.examYear = { year: query.year };
    if (query.examSlug) where.examYear = { slug: query.examSlug };
    // Língua estrangeira do aluno: as questões comuns (sem idioma) continuam;
    // só a versão na outra língua sai.
    if (query.language) {
      where.OR = [{ language: null }, { language: query.language }];
    }
    if (query.code?.trim()) {
      where.code = { startsWith: normalizeCodeQuery(query.code) };
    }
    return where;
  }

  async findMany(query: QueryQuestionsDto) {
    const where = this.buildWhere(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Prova mais recente primeiro; dentro dela, a ordem do caderno. O `id`
        // desempata as questões autorais, que não têm código. Questão sem prova
        // vem antes de todas: o Postgres ordena NULL primeiro no `desc` (o
        // SQLite punha por último) e o Prisma não aceita `nulls` em campo de
        // relação. Hoje toda questão do banco real tem prova.
        orderBy: [
          { examYear: { year: 'desc' } },
          { code: 'asc' },
          { id: 'asc' },
        ],
        // Sem revelar a alternativa correta na listagem.
        select: QUESTION_PUBLIC_SELECT,
      }),
    ]);

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Quantas questões existem por área, assunto e prova — só com o filtro de
   * idioma. O painel de filtros usa isso para esconder assunto vazio: a maior
   * parte do banco oficial ainda não foi classificada por assunto, e oferecer
   * "Funções (0)" seria mandar o aluno para uma lista vazia.
   */
  async facets(language?: string) {
    const where = this.buildWhere({ language } as QueryQuestionsDto);
    const [total, areas, topics, exams, provas] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.groupBy({
        by: ['subjectAreaId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.question.groupBy({
        by: ['topicId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.question.groupBy({
        by: ['examYearId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.examYear.findMany({ select: { id: true, slug: true } }),
    ]);
    const slugPorId = new Map(provas.map((p) => [p.id, p.slug]));
    return {
      total,
      areas: areas
        .filter((a) => a.subjectAreaId)
        .map((a) => ({ id: a.subjectAreaId!, count: a._count._all })),
      topics: topics
        .filter((t) => t.topicId)
        .map((t) => ({ id: t.topicId!, count: t._count._all })),
      exams: exams
        .filter((e) => e.examYearId && slugPorId.has(e.examYearId))
        .map((e) => ({
          slug: slugPorId.get(e.examYearId!)!,
          count: e._count._all,
        })),
    };
  }

  /** Provas com questões no banco, da mais recente para a mais antiga. */
  exams() {
    return this.prisma.examYear.findMany({
      where: { questions: { some: {} } },
      orderBy: [{ year: 'desc' }, { slug: 'asc' }],
      select: { slug: true, year: true, label: true },
    });
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      // No detalhe (questão comentada) revelamos o gabarito + explicação.
      select: QUESTION_DETAIL_SELECT,
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }
    return question;
  }
}
