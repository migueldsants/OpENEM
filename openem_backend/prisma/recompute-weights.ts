/**
 * Recalcula o peso dos assuntos (`Topic.weight`) pela incidência nas provas
 * regulares recentes e invalida o cache de catálogo. O seed, o import e as
 * classificações já fazem isso no fim; este script serve para aplicar a
 * regra num banco que já está pronto, sem rodar mais nada.
 *
 *   npm run db:weights
 *   docker compose exec backend node dist-scripts/prisma/recompute-weights.js
 */
import { PrismaClient } from '@prisma/client';
import { invalidateCatalogCache } from '../src/cache/catalog-invalidation';
import { recomputeTopicWeights } from '../src/tracks/topic-weights';

const prisma = new PrismaClient();

async function main() {
  await recomputeTopicWeights(prisma);
  await invalidateCatalogCache();
}

main()
  .catch((e) => {
    console.error(`[peso] ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
