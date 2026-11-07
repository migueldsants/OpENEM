import { Injectable, Optional } from '@nestjs/common';
import { TracksService } from '../tracks/tracks.service';
import {
  rankTopicsForReinforcement,
  reinforcementReason,
  type TopicStat,
} from '../common/recommendation';
import { sampleOffsets } from '../common/sampling';
import { PrismaService } from '../prisma/prisma.service';

/** Janela de histórico considerada no diagnóstico de assuntos fracos. */
const RECENT_WINDOW_MS = 90 * 86_400_000;
/** Teto de respostas lidas, para o diagnóstico não crescer com o histórico. */
const RECENT_ANSWER_LIMIT = 2000;
// Sem revelar o gabarito na recomendação (como na listagem).
import { QUESTION_PUBLIC_SELECT } from '../questions/question.select';

export interface RecommendationItem {
  question: unknown;
  reason: string;
  /** Presente quando a questão veio da trilha (aluno sem erros recentes). */
  track?: {
    subjectId: string;
    subjectName: string;
    /** Número da etapa, a partir de 1. */
    stage: number;
    title: string;
  };
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    // Opcional para os testes unitários antigos, que montam o serviço só com
    // o Prisma; na API o TracksModule sempre o fornece.
    @Optional() private readonly tracks?: TracksService,
  ) {}

  /**
   * Sugere questões a partir dos erros recentes: prioriza assuntos com menor
   * precisão e devolve questões ainda não respondidas desses assuntos. Se faltar,
   * completa com questões novas (cobertura) de qualquer assunto.
   */
  async next(userId: string, limit = 5) {
    // Janela recente em vez do histórico inteiro: além de limitar a memória de
    // um aluno assíduo, o que ele errou nos últimos 90 dias é o melhor sinal do
    // que precisa reforçar agora.
    const answers = await this.prisma.answer.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ANSWER_LIMIT,
      select: {
        isCorrect: true,
        question: { select: { topicId: true } },
      },
    });

    const byTopic = new Map<string, TopicStat>();
    for (const a of answers) {
      const topicId = a.question.topicId;
      // Sem assunto não há reforço por assunto fraco a calcular; essas questões
      // continuam elegíveis pela etapa de cobertura mais abaixo.
      if (!topicId) continue;
      const s = byTopic.get(topicId) ?? { topicId, attempts: 0, correct: 0 };
      s.attempts += 1;
      if (a.isCorrect) s.correct += 1;
      byTopic.set(topicId, s);
    }

    const ranked = rankTopicsForReinforcement([...byTopic.values()]);
    // "Ainda não respondida" vira um anti-join em SQL (NOT EXISTS sobre o índice
    // Answer(userId, questionId)). A versão anterior mandava o id de cada
    // resposta do usuário num `notIn`, o que crescia sem limite com o histórico.
    const naoRespondida = { answers: { none: { userId } } } as const;
    const out: RecommendationItem[] = [];
    const usedIds = new Set<string>();

    // 0) Sem erro recente (aluno novo, ou que acertou tudo): a etapa atual da
    // trilha da matéria que mais rende, em vez de questões soltas.
    if (this.tracks && !ranked.some((t) => t.accuracy < 1)) {
      const stage = await this.tracks.suggestedStage(userId).catch(() => null);
      if (stage) {
        const where = {
          topicId: { in: stage.topicIds },
          ...naoRespondida,
        };
        const disponiveis = await this.prisma.question.count({ where });
        for (const skip of sampleOffsets(disponiveis, limit)) {
          const [q] = await this.prisma.question.findMany({
            where,
            skip,
            take: 1,
            orderBy: { id: 'asc' },
            select: QUESTION_PUBLIC_SELECT,
          });
          if (!q || usedIds.has(q.id)) continue;
          usedIds.add(q.id);
          out.push({
            question: q,
            reason: `Trilha de ${stage.subjectName}: ${stage.title}`,
            track: {
              subjectId: stage.subjectId,
              subjectName: stage.subjectName,
              stage: stage.stageIndex + 1,
              title: stage.title,
            },
          });
        }
      }
    }

    // 1) Questões novas dos assuntos mais fracos.
    for (const topic of ranked) {
      if (out.length >= limit) break;
      const questions = await this.prisma.question.findMany({
        where: { topicId: topic.topicId, ...naoRespondida },
        take: limit - out.length,
        select: QUESTION_PUBLIC_SELECT,
      });
      for (const q of questions) {
        if (usedIds.has(q.id)) continue;
        usedIds.add(q.id);
        out.push({ question: q, reason: reinforcementReason(topic.accuracy) });
      }
    }

    // 2) Cobertura: completa com questões novas de qualquer assunto.
    if (out.length < limit) {
      const faltam = limit - out.length;
      const where = {
        ...naoRespondida,
        ...(usedIds.size ? { id: { notIn: [...usedIds] } } : {}),
      };
      // Posições sorteadas: com `orderBy: id` puro, TODO aluno novo receberia
      // as mesmas primeiras questões do banco; com uma janela contígua, cinco
      // questões seguidas da mesma prova e da mesma área.
      const disponiveis = await this.prisma.question.count({ where });
      const fillers: unknown[] = [];
      for (const skip of sampleOffsets(disponiveis, faltam)) {
        const [q] = await this.prisma.question.findMany({
          where,
          skip,
          take: 1,
          orderBy: { id: 'asc' },
          select: QUESTION_PUBLIC_SELECT,
        });
        if (q) fillers.push(q);
      }
      for (const q of fillers) {
        out.push({ question: q, reason: 'Para ampliar seu repertório' });
      }
    }

    return out;
  }
}
