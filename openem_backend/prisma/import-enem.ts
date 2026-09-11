/**
 * Runner do import das provas oficiais do ENEM.
 *
 *   npm run db:import:enem                       # todas as 26 provas
 *   npm run db:import:enem -- --exam=2023        # só uma prova
 *   npm run db:import:enem -- --limit=5 --dry-run
 *
 * A lógica está em `import-enem-lib.ts`; aqui ficam só os argumentos e o guard
 * que impede rodar contra o banco de teste.
 */

import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ensureDataset, importEnem, printReport } from './import-enem-lib';

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    exam: { type: 'string', multiple: true },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    refresh: { type: 'boolean', default: false },
    'skip-download': { type: 'boolean', default: false },
    'skip-images': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

function guardaBancoDeTeste(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV === 'test' || url.includes('test-e2e')) {
    throw new Error(
      'recusando importar contra o banco de teste — a suíte e2e ficaria lenta e instável',
    );
  }
}

async function main() {
  guardaBancoDeTeste();

  const datasetDir =
    process.env.ENEM_DATASET_DIR ?? join(__dirname, '.enem-dataset');
  const mediaDir =
    process.env.ENEM_MEDIA_DIR ?? join(__dirname, '..', 'public', 'enem');

  if (!values['skip-download']) {
    await ensureDataset(datasetDir, { refresh: values.refresh });
  }

  // `--exam=2023,2024` e `--exam=2023 --exam=2024` funcionam igual.
  const exams = (values.exam ?? []).flatMap((e) => e.split(','));
  const limit = values.limit ? Number.parseInt(values.limit, 10) : undefined;
  if (values.limit && (!limit || limit < 1)) {
    throw new Error(`--limit inválido: ${values.limit}`);
  }

  const report = await importEnem(prisma, {
    datasetDir,
    mediaDir: values['skip-images'] ? undefined : mediaDir,
    exams,
    limit,
    dryRun: values['dry-run'],
    verbose: values.verbose,
  });

  printReport(report);
  if (values['dry-run']) {
    console.log('\n(dry-run: nada foi gravado)');
  }
}

main()
  .catch((e) => {
    console.error(`[import-enem] ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
