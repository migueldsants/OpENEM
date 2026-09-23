// Confere a resposta certa de cada questão do banco contra o gabarito oficial
// do INEP. Roda depois do import: é a prova de que o dataset corrigido não
// trocou nenhuma resposta.
//
// uso: node verificar-gabaritos.mjs <pasta dos PDFs> [caminho do dev.db]
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lerGabarito } from './gabarito.mjs';

const require = createRequire(import.meta.url);
const pdfDir = process.argv[2];
const dbUrl = process.argv[3] ?? 'file:../../openem_backend/prisma/dev.db';
if (!pdfDir) {
  console.error('uso: node verificar-gabaritos.mjs <pasta dos PDFs> [url do banco]');
  process.exit(1);
}

// Gabaritos por prova: [1º dia, 2º dia]. O caderno importa porque os gabaritos
// antigos trazem vários lado a lado, cada um com outra ordem de questões.
const GABARITOS = {
  2009: ['GBR_2009_D1.pdf', 'GBR_2009_D2.pdf'],
  2010: [null, null], // o INEP não publicou gabarito separado
  2011: ['GBR_2011_D1.pdf', 'GBR_2011_D2.pdf'],
  2012: ['GBR_2012_D1.pdf', 'GBR_2012_D2.pdf'],
  2013: ['GBR_2013_D1.pdf', 'GBR_2013_D2.pdf'],
  2014: ['GBR_2014_D1.pdf', 'GBR_2014_D2.pdf'],
  2015: ['GBR_2015_D1.pdf', 'GBR_2015_D2.pdf'],
  2016: ['GBR_2016_D1.pdf', 'GBR_2016_D2.pdf'],
  2017: ['GBR_2017_D1.pdf', 'GBR_2017_D2.pdf'],
  2018: ['GBR_2018_D1.pdf', 'GBR_2018_D2.pdf'],
  2019: ['GBR_2019_D1.pdf', 'GBR_2019_D2.pdf'],
  2020: ['GBR_2020_D1.pdf', 'GBR_2020_D2.pdf'],
  2021: ['GBR_2021_D1.pdf', 'GBR_2021_D2.pdf'],
  2022: ['GBR_2022_D1.pdf', 'GBR_2022_D2.pdf'],
  2023: ['GBR_2023_D1.pdf', 'GBR_2023_D2.pdf'],
  2024: ['GBR_2024_D1.pdf', 'GBR_2024_D2.pdf'],
  2025: ['GBR_2025_D1.pdf', 'GBR_2025_D2.pdf'],
  '2017-reaplicacao': [null, 'GB_2017_D2.pdf'],
  '2018-reaplicacao': [null, null], // idem
  '2019-reaplicacao': ['GB_2019_D1.pdf', 'GB_2019_D2.pdf'],
  '2020-reaplicacao': ['GB_2020_D1.pdf', 'GB_2020_D2.pdf'],
  '2021-reaplicacao': ['GB_2021_D1.pdf', 'GB_2021_D2.pdf'],
  '2022-reaplicacao': ['GB_2022_D1.pdf', 'GB_2022_D2.pdf'],
  '2023-reaplicacao': ['GB_2023_D1.pdf', 'GB_2023_D2.pdf'],
  '2024-reaplicacao': ['GB_2024_D1.pdf', 'GB_2024_D2.pdf'],
  '2025-reaplicacao': ['GB_2025_D5.pdf', 'GB_2025_D6.pdf'],
};

const { PrismaClient } = require('../../openem_backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const provas = await prisma.examYear.findMany({ orderBy: [{ year: 'asc' }, { slug: 'asc' }] });
let conferidas = 0;
let batem = 0;
const divergentes = [];
const semGabarito = [];

for (const prova of provas) {
  const arquivos = GABARITOS[prova.slug];
  if (!arquivos) continue;
  const oficial = new Map();
  for (const [i, arq] of arquivos.entries()) {
    if (!arq || !existsSync(join(pdfDir, arq))) continue;
    for (const [n, v] of await lerGabarito(join(pdfDir, arq), i === 0 ? 1 : 7)) {
      // o 1º dia manda nos números dele; o 2º, nos seus
      const doDia = i === 0 ? n <= 90 : n > 90;
      if (doDia && !oficial.has(n)) oficial.set(n, v);
    }
  }
  if (!oficial.size) { semGabarito.push(prova.slug); continue; }

  const questoes = await prisma.question.findMany({
    where: { examYearId: prova.id },
    select: { code: true, number: true, language: true, alternatives: { select: { letter: true, isCorrect: true } } },
    orderBy: { number: 'asc' },
  });
  let ok = 0, n = 0, pulos = 0;
  for (const q of questoes) {
    let esperado = oficial.get(q.number);
    if (esperado && typeof esperado === "object") {
      // Questão de língua estrangeira: o gabarito tem uma coluna para inglês e
      // outra para espanhol. Em algumas provas antigas o dataset não diz qual é
      // o idioma da questão; aí vale bater com qualquer uma das duas.
      if (q.language) esperado = esperado[q.language];
      else esperado = [esperado.ingles, esperado.espanhol];
    }
    if (!esperado || esperado === 'ANULADA') { pulos++; continue; }
    const marcada = q.alternatives.find((a) => a.isCorrect)?.letter;
    n++;
    const aceitos = Array.isArray(esperado) ? esperado : [esperado];
    if (aceitos.includes(marcada)) ok++;
    else divergentes.push(`${prova.slug}/${q.number}${q.language ? ' (' + q.language + ')' : ''}: banco=${marcada} oficial=${aceitos.join(' ou ')}`);
  }
  conferidas += n;
  batem += ok;
  const marca = ok === n ? 'ok' : `${n - ok} DIVERGEM`;
  console.log(`${prova.slug.padEnd(20)} ${String(ok).padStart(3)}/${String(n).padEnd(3)} ${marca}${pulos ? `  (${pulos} sem gabarito/anuladas)` : ''}`);
}

console.log(`\n${batem}/${conferidas} questões conferem com o gabarito oficial.`);
if (semGabarito.length) console.log(`sem gabarito publicado pelo INEP: ${semGabarito.join(', ')}`);
if (divergentes.length) {
  console.log(`\n${divergentes.length} divergência(s):`);
  for (const d of divergentes) console.log('  ', d);
}
await prisma.$disconnect();
process.exit(divergentes.length ? 1 : 0);
