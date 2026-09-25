// Tira uma amostra de decisões por faixa de confiança, para revisão à mão.
//
// uso: node amostrar-classificacao.mjs <min> <max> <n> [url do banco]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../openem_backend/node_modules/@prisma/client');

const [min, max, n] = process.argv.slice(2).map(Number);
const dbUrl = process.argv.find((a) => a.startsWith('file:')) ?? 'file:../../openem_backend/prisma/dev.db';
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const qs = await prisma.question.findMany({
  where: {
    classificationSource: 'keywords',
    classificationConfidence: { gte: min, lte: max },
  },
  select: {
    code: true,
    statement: true,
    questionPrompt: true,
    classificationConfidence: true,
    topic: { select: { name: true, subject: { select: { name: true } } } },
  },
  orderBy: { code: 'asc' },
});
console.log(`faixa ${min}–${max}: ${qs.length} questões`);
const passo = Math.max(1, Math.floor(qs.length / n));
for (let i = 0, k = 0; i < qs.length && k < n; i += passo, k++) {
  const q = qs[i];
  const texto = [q.statement, q.questionPrompt]
    .filter(Boolean)
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]')
    .replace(/\s+/g, ' ');
  console.log(`\n${q.code} → ${q.topic.subject.name}/${q.topic.name} (${q.classificationConfidence.toFixed(2)})`);
  console.log(`   ${texto.slice(0, 230)}`);
}
await prisma.$disconnect();
