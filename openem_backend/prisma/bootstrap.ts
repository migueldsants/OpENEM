/**
 * Popula um banco vazio na primeira subida do container (ver
 * `src/common/bootstrap-plan.ts`). Roda depois do `migrate deploy` e antes da
 * API. Uso: `npx ts-node prisma/bootstrap.ts`.
 *
 * Falha aqui não derruba o container: a API sobe mesmo assim (sem questões, se
 * o GitHub estiver fora do ar) e o próximo restart tenta de novo, porque o
 * banco continua sem questões oficiais.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { bootstrapPlan } from '../src/common/bootstrap-plan';

async function main() {
  const prisma = new PrismaClient();
  let officialQuestions: number;
  try {
    officialQuestions = await prisma.question.count({
      where: { externalId: { not: null } },
    });
  } finally {
    await prisma.$disconnect();
  }

  const passos = bootstrapPlan({
    officialQuestions,
    autoImport: process.env.AUTO_IMPORT,
  });
  if (passos.length === 0) {
    console.log(
      `[bootstrap] nada a fazer (${officialQuestions} questões oficiais no banco)`,
    );
    return;
  }

  console.log(
    `[bootstrap] banco sem questões oficiais — rodando: ${passos.join(', ')}`,
  );
  for (const passo of passos) {
    const inicio = Date.now();
    execSync(`npm run ${passo}`, { stdio: 'inherit' });
    console.log(
      `[bootstrap] ${passo} ok em ${Math.round((Date.now() - inicio) / 1000)}s`,
    );
  }
}

main().catch((e: unknown) => {
  console.error('[bootstrap] falhou; a API sobe mesmo assim:', e);
});
