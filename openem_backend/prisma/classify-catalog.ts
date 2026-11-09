/**
 * Aplica o catálogo de assuntos (`classificacao-assuntos.json`, ao lado deste
 * arquivo) às questões oficiais ainda sem assunto e às que a palavra-chave
 * classificou com confiança abaixo de `KEYWORDS_TRUSTED_CONFIDENCE`.
 *
 *   npm run db:classify:catalog              # grava
 *   npm run db:classify:catalog -- --dry-run # só mostra o que faria
 *
 * Roda depois da classificação por palavra-chave (que tem precedência quando
 * decide com folga) e não precisa de chave de IA: o catálogo foi gerado uma vez e está versionado. Ver
 * `src/common/classification/catalog.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { invalidateCatalogCache } from '../src/cache/catalog-invalidation';
import { recomputeTopicWeights } from '../src/tracks/topic-weights';
import {
  CATALOG_SOURCE,
  CatalogEntry,
  CatalogTopic,
  KEYWORDS_SOURCE,
  KEYWORDS_TRUSTED_CONFIDENCE,
  catalogDecisions,
} from '../src/common/classification/catalog';

/** Questões que o catálogo pode gravar: sem assunto ou palavra-chave fraca. */
const SUBSTITUIVEL = {
  OR: [
    { topicId: null },
    {
      classificationSource: KEYWORDS_SOURCE,
      classificationConfidence: { lt: KEYWORDS_TRUSTED_CONFIDENCE },
    },
  ],
};

const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean', default: false } },
  strict: true,
  allowPositionals: false,
});

interface CatalogFile {
  questoes: Record<string, CatalogEntry>;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const arquivo = join(__dirname, 'classificacao-assuntos.json');
    const catalogo = (JSON.parse(readFileSync(arquivo, 'utf8')) as CatalogFile)
      .questoes;

    const topicos = await prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        subject: { select: { name: true, subjectAreaId: true } },
      },
    });
    const porRotulo = new Map<string, CatalogTopic>(
      topicos.map((t) => [
        `${t.subject.name} / ${t.name}`,
        { id: t.id, subjectAreaId: t.subject.subjectAreaId },
      ]),
    );

    const questoes = await prisma.question.findMany({
      where: { externalId: { in: Object.keys(catalogo) }, ...SUBSTITUIVEL },
      select: {
        externalId: true,
        subjectAreaId: true,
        topicId: true,
        classificationSource: true,
        classificationConfidence: true,
      },
    });
    const { aplicar, ignoradas } = catalogDecisions(
      catalogo,
      questoes.map((q) => ({ ...q, externalId: q.externalId! })),
      porRotulo,
    );

    if (!values['dry-run']) {
      // Agrupado por assunto: uma escrita por assunto e confiança, não por questão.
      const grupos = new Map<string, string[]>();
      for (const d of aplicar) {
        const chave = `${d.topicId}|${d.confidence}`;
        grupos.set(chave, [...(grupos.get(chave) ?? []), d.externalId]);
      }
      for (const [chave, ids] of grupos) {
        const [topicId, confianca] = chave.split('|');
        await prisma.question.updateMany({
          where: { externalId: { in: ids }, ...SUBSTITUIVEL },
          data: {
            topicId,
            classificationConfidence: Number(confianca),
            classificationSource: CATALOG_SOURCE,
          },
        });
      }
    }

    const motivos = new Map<string, number>();
    for (const i of ignoradas) {
      motivos.set(i.motivo, (motivos.get(i.motivo) ?? 0) + 1);
    }
    console.log('=== Catálogo de assuntos ===');
    console.log(`no catálogo:        ${Object.keys(catalogo).length}`);
    const fracas = questoes.filter((q) => q.topicId).length;
    console.log(`sem assunto no banco: ${questoes.length - fracas}`);
    console.log(`palavra-chave < ${KEYWORDS_TRUSTED_CONFIDENCE}: ${fracas}`);
    console.log(`classificadas:      ${aplicar.length}`);
    for (const [motivo, n] of motivos) {
      console.log(`ignoradas (${motivo}): ${n}`);
    }
    if (values['dry-run']) console.log('\n(dry-run: nada foi gravado)');
    else {
      await recomputeTopicWeights(prisma);
      await invalidateCatalogCache();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`[classify-catalog] ${(e as Error).message}`);
  process.exit(1);
});
