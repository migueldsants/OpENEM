import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
            // Sem o gabarito; permite responder a questão favoritada.
            alternatives: { select: { id: true, text: true } },
          },
        },
      },
    });
  }

  /** Remove um favorito (idempotente: não falha se já não existir). */
  async remove(userId: string, questionId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, questionId } });
    return { removed: true };
  }
}
