import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Bucket {
  total: number;
  correct: number;
}

function accuracy(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 100) : 0;
}

/** Linha do mapa de calor: um tópico canônico com o desempenho do usuário. */
export interface HeatmapTopic {
  id: string;
  name: string;
  /** Peso Pareto (1..5): frequência do tópico no ENEM. */
  weight: number;
  total: number;
  correct: number;
  accuracy: number;
}

@Injectable()
export class HeatmapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mapa de calor da taxonomia canônica (issue #43): TODOS os tópicos
   * agrupados por área → matéria, cada um com total/correct/accuracy do
   * usuário (0 respostas = neutro). Tópicos nunca respondidos aparecem
   * também — o grid é completo, não só o que foi estudado.
   */
  async heatmap(userId: string) {
    // Agregação por tópico: query enxuta (topicId + isCorrect) e contagem
    // em JS — o Prisma não agrupa por campo de relação.
    const answers = await this.prisma.answer.findMany({
      where: { userId },
      select: { isCorrect: true, question: { select: { topicId: true } } },
    });
    const byTopic = new Map<string, Bucket>();
    for (const a of answers) {
      const b = byTopic.get(a.question.topicId) ?? { total: 0, correct: 0 };
      b.total += 1;
      if (a.isCorrect) b.correct += 1;
      byTopic.set(a.question.topicId, b);
    }

    const areas = await this.prisma.subjectArea.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        subjects: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            topics: {
              orderBy: { name: 'asc' },
              select: { id: true, name: true, weight: true },
            },
          },
        },
      },
    });

    const toTopic = (t: {
      id: string;
      name: string;
      weight: number;
    }): HeatmapTopic => {
      const b = byTopic.get(t.id) ?? { total: 0, correct: 0 };
      return {
        id: t.id,
        name: t.name,
        weight: t.weight,
        total: b.total,
        correct: b.correct,
        accuracy: accuracy(b.correct, b.total),
      };
    };

    return areas.map((area) => ({
      id: area.id,
      name: area.name,
      subjects: area.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        topics: subject.topics.map(toTopic),
      })),
    }));
  }
}
