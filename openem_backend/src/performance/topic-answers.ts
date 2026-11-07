import type { PrismaClient } from '@prisma/client';
import { foldTopicAnswers, type TopicAnswers } from '../common/mastery';

type Db = Pick<PrismaClient, 'answer'>;

/**
 * Respostas do aluno agrupadas por assunto, com as mais recentes primeiro
 * (o domínio usa as últimas 10). Compartilhado pelo mapa de calor do
 * Desempenho e pelas trilhas da tela Matérias.
 */
export async function loadTopicAnswers(
  db: Db,
  userId: string,
): Promise<Map<string, TopicAnswers>> {
  const answers = await db.answer.findMany({
    where: { userId, question: { topicId: { not: null } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { isCorrect: true, question: { select: { topicId: true } } },
  });
  return foldTopicAnswers(
    answers.map((a) => ({
      topicId: a.question.topicId,
      isCorrect: a.isCorrect,
    })),
  );
}
