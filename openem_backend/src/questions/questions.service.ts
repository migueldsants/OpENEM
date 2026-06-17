import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryQuestionsDto } from './dto/query-questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: QueryQuestionsDto) {
    const where: Prisma.QuestionWhereInput = {};
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.topicId) where.topicId = query.topicId;
    if (query.subjectId) where.topic = { subjectId: query.subjectId };
    if (query.year) where.examYear = { year: query.year };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
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
          examYear: { select: { year: true } },
          // Sem revelar a alternativa correta na listagem.
          alternatives: { select: { id: true, text: true } },
        },
      }),
    ]);

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      select: {
        id: true,
        statement: true,
        difficulty: true,
        explanation: true,
        topic: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true } },
          },
        },
        examYear: { select: { year: true } },
        // No detalhe (questão comentada) revelamos o gabarito + explicação.
        alternatives: { select: { id: true, text: true, isCorrect: true } },
      },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }
    return question;
  }
}
