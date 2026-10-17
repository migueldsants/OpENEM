/**
 * Popula um banco vazio na primeira subida do container (ver
 * `src/common/bootstrap-plan.ts`). Roda depois do `migrate deploy` e antes da
 * API. Uso: `npx ts-node prisma/bootstrap.ts` (dev) ou, na imagem Docker,
 * `node dist-scripts/prisma/bootstrap.js` (`npm run build:scripts`).
 *
 * Falha aqui não derruba o container: a API sobe mesmo assim (sem questões, se
 * o GitHub estiver fora do ar) e o próximo restart tenta de novo, porque o
 * banco continua sem questões oficiais.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BootstrapStep, bootstrapPlan } from '../src/common/bootstrap-plan';

/** Script de cada passo, ao lado deste arquivo. */
const SCRIPTS: Record<BootstrapStep, string> = {
  'db:seed': 'seed',
  'db:import:enem': 'import-enem',
  'db:classify:keywords': 'classify-heuristic',
  'db:seed:flashcards': 'seed-flashcards',
};

/**
 * Na imagem Docker os scripts estão compilados (`dist-scripts/`, a imagem não
 * tem ts-node) e rodam com `node`; em dev, como .ts, rodam com ts-node.
 */
function rodar(passo: BootstrapStep) {
  const compilado = __filename.endsWith('.js');
  const arquivo = join(__dirname, SCRIPTS[passo] + (compilado ? '.js' : '.ts'));
  if (compilado) execFileSync(process.execPath, [arquivo], { stdio: 'inherit' });
  else execFileSync('npx', ['ts-node', arquivo], { stdio: 'inherit', shell: true });
}

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
    rodar(passo);
    console.log(
      `[bootstrap] ${passo} ok em ${Math.round((Date.now() - inicio) / 1000)}s`,
    );
  }
}

main().catch((e: unknown) => {
  console.error('[bootstrap] falhou; a API sobe mesmo assim:', e);
});
