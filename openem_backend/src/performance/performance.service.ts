import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Bucket {
  id: string;
  name: string;
  subjectName?: string;
  total: number;
  correct: number;
}

function accuracy(correct: number, total: number): number {
  return total ? Math.round((correct / total) * 100) : 0;
}

function summarize(bucket: Bucket) {
  return {
    ...bucket,
    accuracy: accuracy(bucket.correct, bucket.total),
  };
}

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const answers = await this.prisma.answer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        isCorrect: true,
        question: {
          select: {
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

    const total = answers.length;
    const correct = answers.filter((a) => a.isCorrect).length;

    const subjects = new Map<string, Bucket>();
    const topics = new Map<string, Bucket>();

    for (const a of answers) {
      const subject = a.question.topic.subject;
      const topic = a.question.topic;

      const sb = subjects.get(subject.id) ?? {
        id: subject.id,
        name: subject.name,
        total: 0,
        correct: 0,
      };
      sb.total += 1;
      if (a.isCorrect) sb.correct += 1;
      subjects.set(subject.id, sb);

      const tb = topics.get(topic.id) ?? {
        id: topic.id,
        name: topic.name,
        subjectName: subject.name,
        total: 0,
        correct: 0,
      };
      tb.total += 1;
      if (a.isCorrect) tb.correct += 1;
      topics.set(topic.id, tb);
    }

    // Tendência: precisão nas 20 tentativas mais recentes.
    const recent = answers.slice(0, 20);
    const recentCorrect = recent.filter((a) => a.isCorrect).length;

    // Assuntos com mais dificuldade (menor precisão, mínimo de tentativas).
    const weakestTopics = [...topics.values()]
      .filter((t) => t.total >= 1)
      .map(summarize)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return {
      overall: { total, correct, accuracy: accuracy(correct, total) },
      recent: {
        total: recent.length,
        correct: recentCorrect,
        accuracy: accuracy(recentCorrect, recent.length),
      },
      bySubject: [...subjects.values()]
        .map(summarize)
        .sort((a, b) => a.name.localeCompare(b.name)),
      byTopic: [...topics.values()].map(summarize),
      weakestTopics,
    };
  }
}
