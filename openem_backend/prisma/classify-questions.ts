/**
 * Runner da classificação de matéria/assunto por IA.
 *
 *   npm run db:classify -- --limit=50 --dry-run   # ver as decisões antes
 *   npm run db:classify                            # o banco inteiro
 *   npm run db:classify -- --area="Matemática e suas Tecnologias"
 *
 * Use um modelo barato (AI_CLASSIFY_MODEL): são ~4 mil questões.
 */

import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { activeAiProvider } from '../src/common/ai';
import { classifyQuestions } from './classify-questions-lib';

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    area: { type: 'string' },
    limit: { type: 'string' },
    batch: { type: 'string' },
    'min-confidence': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

function numero(nome: string, valor: string | undefined): number | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${nome} inválido: ${valor}`);
  }
  return n;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV === 'test' || url.includes('test-e2e')) {
    throw new Error('recusando classificar o banco de teste');
  }
  const provedor = activeAiProvider();
  if (!provedor) {
    throw new Error(
      'nenhum provedor de IA configurado — defina ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY ou OPENAI_BASE_URL',
    );
  }
  console.log(
    `[classify] provedor: ${provedor}` +
      (process.env.AI_CLASSIFY_MODEL
        ? ` (${process.env.AI_CLASSIFY_MODEL})`
        : ''),
  );

  const report = await classifyQuestions(prisma, {
    area: values.area,
    limit: numero('limit', values.limit),
    batch: numero('batch', values.batch),
    minConfidence: numero('min-confidence', values['min-confidence']),
    dryRun: values['dry-run'],
  });

  console.log('\n=== Resumo da classificação ===');
  console.log(`processadas:       ${report.processed}`);
  console.log(`classificadas:     ${report.classified}`);
  console.log(`baixa confiança:   ${report.lowConfidence} (não gravadas)`);
  if (report.failedBatches) {
    console.log(`lotes com falha:   ${report.failedBatches}`);
  }
  if (values['dry-run']) console.log('\n(dry-run: nada foi gravado)');
}

main()
  .catch((e) => {
    console.error(`[classify] ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
