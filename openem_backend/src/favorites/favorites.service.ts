import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QUESTION_PUBLIC_SELECT } from '../questions/question.select';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Favorita uma questão (idempotente). */
  async add(userId: string, questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException('Questão não encontrada');
    }
    return this.prisma.favorite.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId },
      update: {},
    });
  }

  /** Lista as questões favoritadas do usuário (mais recentes primeiro). */
  list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        // Sem o gabarito; permite responder a questão favoritada.
        question: { select: QUESTION_PUBLIC_SELECT },
      },
    });
  }

  /** Remove um favorito (idempotente: não falha se já não existir). */
  async remove(userId: string, questionId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, questionId } });
    return { removed: true };
  }
}
