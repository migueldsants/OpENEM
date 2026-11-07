import type { PrismaClient } from '@prisma/client';
import {
  computeIncidence,
  describeWindow,
  pickWindow,
  type IncidenceRow,
  type IncidenceWindow,
  type TopicIncidence,
} from '../common/incidence';

type Db = Pick<PrismaClient, 'examYear' | 'question'>;

async function countByExam(
  db: Db,
  examYearIds: string[],
): Promise<IncidenceRow[]> {
  const rows = await db.question.groupBy({
    by: ['topicId', 'examYearId', 'language'],
    where: { examYearId: { in: examYearIds }, topicId: { not: null } },
    _count: { _all: true },
  });
  return rows.flatMap((r) =>
    r.topicId && r.examYearId
      ? [
          {
            topicId: r.topicId,
            examYearId: r.examYearId,
            language: r.language,
            n: r._count._all,
          },
        ]
      : [],
  );
}

export interface IncidenceSnapshot {
  window: IncidenceWindow | null;
  topics: Record<string, TopicIncidence>;
  /** Questões de cada assunto no banco inteiro, de qualquer aplicação. */
  bank: Record<string, number>;
}

/**
 * Lê a incidência do banco: as provas regulares mais recentes que têm
 * questões e a contagem por assunto, prova e língua. Usada pela API (com
 * cache de catálogo) e pelos scripts que recalculam o peso dos assuntos.
 */
export async function loadIncidence(db: Db): Promise<IncidenceSnapshot> {
  const exams = await db.examYear.findMany({
    where: { kind: 'REGULAR', questions: { some: {} } },
    select: { id: true, year: true },
  });
  const window = pickWindow(exams);

  const [rows, bankRows] = await Promise.all([
    window.length
      ? countByExam(
          db,
          window.map((e) => e.id),
        )
      : [],
    db.question.groupBy({
      by: ['topicId'],
      where: { topicId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const topics = computeIncidence(window, rows);
  const bank: Record<string, number> = {};
  for (const r of bankRows) {
    if (r.topicId) bank[r.topicId] = r._count._all;
  }
  return { window: describeWindow(window), topics, bank };
}
