// Confere a classificação de assunto do banco: coerência com a área,
// cobertura, distribuição e uma amostra para revisão à mão.
//
// uso: node conferir-classificacao.mjs [url do banco] [--amostra=20]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../openem_backend/node_modules/@prisma/client');

const dbUrl = process.argv.find((a) => a.startsWith('file:')) ?? 'file:../../openem_backend/prisma/dev.db';
const amostra = Number(process.argv.find((a) => a.startsWith('--amostra='))?.slice(10) ?? 0);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const total = await prisma.question.count();
const comAssunto = await prisma.question.count({ where: { topicId: { not: null } } });
console.log(`cobertura: ${comAssunto}/${total} questões com assunto (${((comAssunto / total) * 100).toFixed(1)}%)\n`);

// 1. O assunto tem de pertencer à área da questão. Um assunto de Matemática
//    numa questão de Linguagens é erro de classificação, não de gosto.
const classificadas = await prisma.question.findMany({
  where: { topicId: { not: null } },
  select: {
    code: true,
    subjectAreaId: true,
    classificationSource: true,
    classificationConfidence: true,
    topic: { select: { name: true, subject: { select: { name: true, subjectAreaId: true } } } },
  },
});
const foraDaArea = classificadas.filter((q) => q.subjectAreaId && q.topic.subject.subjectAreaId !== q.subjectAreaId);
console.log(`assunto fora da área da questão: ${foraDaArea.length}`);
for (const q of foraDaArea.slice(0, 10)) console.log(`   ${q.code} → ${q.topic.subject.name}/${q.topic.name}`);

// 2. Questão sem área nenhuma não deveria existir no banco oficial.
const semArea = await prisma.question.count({ where: { source: 'ENEM_DEV', subjectAreaId: null } });
console.log(`questões oficiais sem área: ${semArea}`);

// 3. De onde veio cada classificação.
const fontes = new Map();
for (const q of classificadas) fontes.set(q.classificationSource ?? '(import: língua estrangeira)', (fontes.get(q.classificationSource ?? '(import: língua estrangeira)') ?? 0) + 1);
console.log('\norigem:', [...fontes].map(([k, v]) => `${k}=${v}`).join('  '));

// 4. Confiança: a heurística nunca deve gravar abaixo do próprio limite.
const comConf = classificadas.filter((q) => q.classificationConfidence != null);
if (comConf.length) {
  const cs = comConf.map((q) => q.classificationConfidence).sort((a, b) => a - b);
  console.log(`confiança: mín=${cs[0].toFixed(2)} mediana=${cs[Math.floor(cs.length / 2)].toFixed(2)} máx=${cs[cs.length - 1].toFixed(2)}`);
}

// 5. Distribuição por matéria — assunto concentrado demais costuma ser regra
//    larga demais pegando questão que não é dela.
const porMateria = new Map();
for (const q of classificadas) {
  const k = q.topic.subject.name;
  porMateria.set(k, (porMateria.get(k) ?? 0) + 1);
}
console.log('\npor matéria:');
for (const [m, n] of [...porMateria].sort((a, b) => b[1] - a[1])) console.log(`   ${m.padEnd(20)} ${n}`);

const porAssunto = new Map();
for (const q of classificadas) {
  const k = `${q.topic.subject.name}/${q.topic.name}`;
  porAssunto.set(k, (porAssunto.get(k) ?? 0) + 1);
}
const top = [...porAssunto].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\nassuntos mais usados:', top.map(([k, v]) => `${k}=${v}`).join('  '));

if (amostra) {
  const todas = await prisma.question.findMany({
    where: { topicId: { not: null }, classificationSource: 'keywords' },
    select: { code: true, statement: true, questionPrompt: true, classificationConfidence: true, topic: { select: { name: true, subject: { select: { name: true } } } } },
  });
  // amostra espalhada, não os primeiros
  const passo = Math.max(1, Math.floor(todas.length / amostra));
  console.log(`\namostra de ${amostra} (de ${todas.length} classificadas por palavra-chave):`);
  for (let i = 0; i < todas.length && i / passo < amostra; i += passo) {
    const q = todas[i];
    const txt = ((q.questionPrompt || q.statement || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]').replace(/\s+/g, ' ')).slice(0, 150);
    console.log(`\n${q.code} → ${q.topic.subject.name} / ${q.topic.name} (conf ${q.classificationConfidence?.toFixed(2)})\n   ${txt}`);
  }
}

await prisma.$disconnect();
process.exit(foraDaArea.length || semArea ? 1 : 0);
