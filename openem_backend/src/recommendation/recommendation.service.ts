import { Injectable } from '@nestjs/common';
import {
  rankTopicsForReinforcement,
  reinforcementReason,
  type TopicStat,
} from '../common/recommendation';
import { PrismaService } from '../prisma/prisma.service';

const QUESTION_SELECT = {
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
  // Sem revelar o gabarito na recomendação (como na listagem).
  alternatives: { select: { id: true, text: true } },
} as const;

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sugere questões a partir dos erros recentes: prioriza assuntos com menor
   * precisão e devolve questões ainda não respondidas desses assuntos. Se faltar,
   * completa com questões novas (cobertura) de qualquer assunto.
   */
  async next(userId: string, limit = 5) {
    const answers = await this.prisma.answer.findMany({
      where: { userId },
      select: {
        isCorrect: true,
        questionId: true,
        question: { select: { topicId: true } },
      },
    });

    const answeredQuestionIds = new Set(answers.map((a) => a.questionId));
    const byTopic = new Map<string, TopicStat>();
    for (const a of answers) {
      const topicId = a.question.topicId;
      const s = byTopic.get(topicId) ?? { topicId, attempts: 0, correct: 0 };
      s.attempts += 1;
      if (a.isCorrect) s.correct += 1;
      byTopic.set(topicId, s);
    }

    const ranked = rankTopicsForReinforcement([...byTopic.values()]);
    const excludeIds = [...answeredQuestionIds];
    const out: { question: unknown; reason: string }[] = [];
    const usedIds = new Set<string>();

    // 1) Questões novas dos assuntos mais fracos.
    for (const topic of ranked) {
      if (out.length >= limit) break;
      const questions = await this.prisma.question.findMany({
        where: { topicId: topic.topicId, id: { notIn: excludeIds } },
        take: limit - out.length,
        select: QUESTION_SELECT,
      });
      for (const q of questions) {
        if (usedIds.has(q.id)) continue;
        usedIds.add(q.id);
        out.push({ question: q, reason: reinforcementReason(topic.accuracy) });
      }
    }

    // 2) Cobertura: completa com questões novas de qualquer assunto.
    if (out.length < limit) {
      const fillers = await this.prisma.question.findMany({
        where: { id: { notIn: [...excludeIds, ...usedIds] } },
        take: limit - out.length,
        orderBy: { id: 'asc' },
        select: QUESTION_SELECT,
      });
      for (const q of fillers) {
        out.push({ question: q, reason: 'Para ampliar seu repertório' });
      }
    }

    return out;
  }
}
