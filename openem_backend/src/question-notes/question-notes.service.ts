import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionNotesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria ou atualiza a nota pessoal do usuário para uma questão. */
  async upsert(userId: string, questionId: string, content: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }
    return this.prisma.questionNote.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, content },
      update: { content },
    });
  }

  /** Retorna a nota do usuário para uma questão (null se não existir). */
  async get(userId: string, questionId: string) {
    return this.prisma.questionNote.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
  }

  /** Lista todas as notas do usuário, com a questão associada. */
  list(userId: string) {
    return this.prisma.questionNote.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        question: {
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
          },
        },
      },
    });
  }

  /** Lista notas do usuário para um conjunto de questões (ex.: histórico). */
  async forQuestions(userId: string, questionIds: string[]) {
    if (questionIds.length === 0) return [];
    return this.prisma.questionNote.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: { questionId: true, content: true, updatedAt: true },
    });
  }

  /** Remove a nota (idempotente). */
  async remove(userId: string, questionId: string) {
    await this.prisma.questionNote.deleteMany({ where: { userId, questionId } });
    return { removed: true };
  }
}
