import { Injectable } from '@nestjs/common';
import {
  addDays,
  buildWeeklySummary,
  PRIORITY_WINDOW_DAYS,
  studyDay,
  weekStart,
} from '../common/weekly-performance';
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

  async overview(userId: string, period: '7d' | '30d' | 'all' = '30d') {
    const since =
      period === 'all'
        ? undefined
        : new Date(Date.now() - (period === '7d' ? 7 : 30) * 86_400_000);

    const answers = await this.prisma.answer.findMany({
      where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
      orderBy: { createdAt: 'desc' },
      select: {
        isCorrect: true,
        createdAt: true,
        question: {
          select: {
            // A área entra junto da matéria: as questões oficiais chegam com
            // área e sem assunto, e sem esse fallback a tela ficaria vazia.
            subjectArea: { select: { id: true, name: true } },
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
      const topic = a.question.topic;
      // Sem assunto classificado, a resposta é contabilizada na área — é o
      // agrupamento mais fino que a questão tem.
      const group = topic?.subject ?? a.question.subjectArea;
      if (group) {
        const sb = subjects.get(group.id) ?? {
          id: group.id,
          name: group.name,
          total: 0,
          correct: 0,
        };
        sb.total += 1;
        if (a.isCorrect) sb.correct += 1;
        subjects.set(group.id, sb);
      }

      if (!topic) continue;
      const tb = topics.get(topic.id) ?? {
        id: topic.id,
        name: topic.name,
        subjectName: topic.subject.name,
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

    // Evolução diária: precisão por dia com atividade (últimos 30 dias ativos,
    // em ordem cronológica) para o gráfico de tendência.
    const days = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const day = a.createdAt.toISOString().slice(0, 10);
      const d = days.get(day) ?? { total: 0, correct: 0 };
      d.total += 1;
      if (a.isCorrect) d.correct += 1;
      days.set(day, d);
    }
    const timeline = [...days.entries()]
      .map(([date, d]) => ({
        date,
        total: d.total,
        correct: d.correct,
        accuracy: accuracy(d.correct, d.total),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(period === '7d' ? -7 : -30);

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
      timeline,
    };
  }

  /**
   * Semana a semana (issue #90): a semana atual e as anteriores, contra a meta
   * de minutos do perfil, mais as prioridades do último mês. Os dias são de
   * Brasília (ver common/weekly-performance.ts).
   */
  async weeks(userId: string, weekCount = 8, now: Date = new Date()) {
    const today = studyDay(now);
    const firstWeek = addDays(weekStart(today), -7 * (weekCount - 1));
    const windowStart = addDays(today, -(PRIORITY_WINDOW_DAYS - 1));
    const firstDay = firstWeek < windowStart ? firstWeek : windowStart;
    // Um dia de folga antes: a conversão para o dia de Brasília é feita na
    // lógica pura, que descarta o que ficar fora das semanas.
    const since = new Date(Date.parse(`${firstDay}T00:00:00Z`) - 86_400_000);

    const [answers, focus, profile] = await Promise.all([
      this.prisma.answer.findMany({
        where: { userId, createdAt: { gte: since } },
        select: {
          isCorrect: true,
          createdAt: true,
          question: {
            select: {
              subjectArea: { select: { name: true } },
              topic: {
                select: {
                  id: true,
                  name: true,
                  weight: true,
                  subject: {
                    select: {
                      name: true,
                      subjectArea: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.focusSession.findMany({
        where: { userId, completedAt: { gte: since } },
        select: { completedAt: true, durationSec: true },
      }),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { minutesPerDay: true },
      }),
    ]);

    const summary = buildWeeklySummary(
      answers.map((a) => {
        const topic = a.question.topic;
        return {
          createdAt: a.createdAt,
          isCorrect: a.isCorrect,
          areaName:
            a.question.subjectArea?.name ??
            topic?.subject.subjectArea.name ??
            null,
          topic: topic
            ? {
                id: topic.id,
                name: topic.name,
                weight: topic.weight,
                subjectName: topic.subject.name,
              }
            : null,
        };
      }),
      focus,
      now,
      weekCount,
    );

    return { ...summary, goalMinutesPerDay: profile?.minutesPerDay ?? null };
  }
}
