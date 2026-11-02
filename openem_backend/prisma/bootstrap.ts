/**
 * Popula um banco vazio na primeira subida do container (ver
 * `src/common/bootstrap-plan.ts`). Roda depois do `migrate deploy` e antes da
 * API. Uso: `npx ts-node prisma/bootstrap.ts` (dev) ou, na imagem Docker,
 * `node dist-scripts/prisma/bootstrap.js` (`npm run build:scripts`).
 *
 * Falha aqui não derruba o container: a API sobe mesmo assim (sem questões, se
 * o GitHub estiver fora do ar) e o próximo restart tenta de novo, porque o
 * banco continua sem questões oficiais.
 *
 * A reimportação por mudança de mapeamento roda em segundo plano: o banco já
 * tem questões, então a API sobe na hora e o site não fica fora do ar durante
 * o import. Se o container parar no meio, a versão não é gravada e o próximo
 * restart reimporta de novo.
 */
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapStep,
  MAPPING_VERSION_KEY,
  bootstrapPlan,
} from '../src/common/bootstrap-plan';
import { ENEM_MAPPING_VERSION } from '../src/common/enem-import/mapping';

/** Script de cada passo, ao lado deste arquivo. */
const SCRIPTS: Record<BootstrapStep, string> = {
  'db:seed': 'seed',
  'db:import:enem': 'import-enem',
  'db:classify:keywords': 'classify-heuristic',
  'db:classify:catalog': 'classify-catalog',
  'db:seed:flashcards': 'seed-flashcards',
};

/**
 * Na imagem Docker os scripts estão compilados (`dist-scripts/`, a imagem não
 * tem ts-node) e rodam com `node`; em dev, como .ts, rodam com ts-node.
 */
function comando(passo: BootstrapStep) {
  const compilado = __filename.endsWith('.js');
  const arquivo = join(__dirname, SCRIPTS[passo] + (compilado ? '.js' : '.ts'));
  return compilado
    ? { cmd: process.execPath, args: [arquivo], shell: false }
    : { cmd: 'npx', args: ['ts-node', arquivo], shell: true };
}

function rodar(passo: BootstrapStep) {
  const { cmd, args, shell } = comando(passo);
  execFileSync(cmd, args, { stdio: 'inherit', shell });
}

/** Solta o passo e volta na hora; a saída dele continua no log do container. */
function rodarEmSegundoPlano(passo: BootstrapStep) {
  const { cmd, args, shell } = comando(passo);
  spawn(cmd, args, { stdio: 'inherit', shell, detached: true }).unref();
}

async function main() {
  const prisma = new PrismaClient();
  let officialQuestions: number;
  let importedMappingVersion: string | null;
  try {
    officialQuestions = await prisma.question.count({
      where: { externalId: { not: null } },
    });
    importedMappingVersion =
      (
        await prisma.appState.findUnique({
          where: { key: MAPPING_VERSION_KEY },
        })
      )?.value ?? null;
  } finally {
    await prisma.$disconnect();
  }

  const passos = bootstrapPlan({
    officialQuestions,
    autoImport: process.env.AUTO_IMPORT,
    importedMappingVersion,
  });
  if (passos.length === 0) {
    console.log(
      `[bootstrap] nada a fazer (${officialQuestions} questões oficiais no banco)`,
    );
    return;
  }

  if (officialQuestions > 0) {
    console.log(
      `[bootstrap] mapeamento do import mudou (banco na versão ${importedMappingVersion ?? '0'}, código na ${ENEM_MAPPING_VERSION}) — reimportando as provas em segundo plano`,
    );
    for (const passo of passos) rodarEmSegundoPlano(passo);
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
