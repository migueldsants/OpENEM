import type { PrismaClient } from '@prisma/client';
import { deriveWeights } from '../common/topic-weight';
import { loadIncidence } from './incidence-query';
import { SUBJECTS_WITHOUT_TRACK } from './tracks-catalog';

type Db = Pick<PrismaClient, 'examYear' | 'question' | 'topic'>;

/**
 * Recalcula `Topic.weight` pela incidência nas provas regulares recentes.
 * Roda no fim do seed, do import das provas e de cada classificação, antes de
 * invalidar o cache de catálogo. Com poucas provas no banco (demonstração,
 * e2e) não mexe em nada e o peso curado da taxonomia fica.
 *
 * Devolve quantos assuntos mudaram de peso, ou null quando não recalculou.
 */
export async function recomputeTopicWeights(
  db: Db,
  log: (msg: string) => void = console.log,
): Promise<number | null> {
  const snapshot = await loadIncidence(db);
  // Redação não tem questão objetiva: a incidência dela seria zero e
  // derrubaria o peso dos seus assuntos sem dizer nada sobre a prova.
  const topics = await db.topic.findMany({
    where: { subject: { name: { notIn: SUBJECTS_WITHOUT_TRACK } } },
    select: { id: true, weight: true },
  });
  const weights = deriveWeights(
    snapshot.window?.exams ?? 0,
    topics.map((t) => t.id),
    snapshot.topics,
  );
  if (!weights) {
    log(
      `[peso] ${snapshot.window?.exams ?? 0} prova(s) regular(es) no banco: peso curado mantido`,
    );
    return null;
  }

  // Um updateMany por valor de peso (no máximo 5), só com quem mudou.
  const porPeso = new Map<number, string[]>();
  for (const t of topics) {
    const novo = weights.get(t.id) ?? t.weight;
    if (novo === t.weight) continue;
    porPeso.set(novo, [...(porPeso.get(novo) ?? []), t.id]);
  }
  let changed = 0;
  for (const [weight, ids] of porPeso) {
    const r = await db.topic.updateMany({
      where: { id: { in: ids } },
      data: { weight },
    });
    changed += r.count;
  }
  log(
    `[peso] recalculado pelas provas regulares de ${snapshot.window?.fromYear}–${snapshot.window?.toYear}: ${changed} assunto(s) mudaram`,
  );
  return changed;
}
