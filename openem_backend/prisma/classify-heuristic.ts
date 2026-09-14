/**
 * Classificação de assunto por palavra-chave — o passe barato, sem IA.
 *
 *   npm run db:classify:keywords -- --dry-run     # ver a cobertura antes
 *   npm run db:classify:keywords                  # gravar
 *   npm run db:classify:keywords -- --area="Matemática e suas Tecnologias"
 *   npm run db:classify:keywords -- --sample=20   # auditar 20 decisões
 *
 * Roda ANTES de `npm run db:classify` (a versão por IA): as questões que esta
 * decide saem da fila da IA, e as que ela recusa continuam com `topicId` nulo.
 * É idempotente e só toca em questão sem assunto — nunca sobrescreve o que a
 * IA ou um humano já classificou.
 *
 * A lógica vive em `src/common/classification/heuristic.ts` (pura e testada);
 * aqui ficam os argumentos e a escrita.
 */

import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';
import {
  classifyByKeywords,
  HeuristicDecision,
} from '../src/common/classification/heuristic';

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    area: { type: 'string' },
    limit: { type: 'string' },
    sample: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
});

/** Lote de leitura: o banco oficial tem ~4 mil questões com enunciado longo. */
const PAGE = 200;

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

  const limite = numero('limit', values.limit);
  const amostra = numero('sample', values.sample) ?? 0;

  // Mapa (matéria, assunto) -> id, resolvido uma vez. Assunto que a regra cita
  // mas a TAXONOMY não tem é erro de catálogo: avisa e não grava.
  const topicos = await prisma.topic.findMany({
    select: { id: true, name: true, subject: { select: { name: true } } },
  });
  const idPorChave = new Map(
    topicos.map((t) => [`${t.subject.name}::${t.name}`, t.id]),
  );

  const where = {
    topicId: null,
    ...(values.area ? { subjectArea: { name: values.area } } : {}),
  };
  const total = await prisma.question.count({ where });
  console.log(
    `[classify-keywords] ${total} questão(ões) sem assunto` +
      (values.area ? ` na área "${values.area}"` : ''),
  );

  let processadas = 0;
  let classificadas = 0;
  let semDecisao = 0;
  const porAssunto = new Map<string, number>();
  const faltantes = new Set<string>();
  const exemplos: { code: string; decisao: HeuristicDecision }[] = [];

  // Paginação por cursor: o `where` muda conforme as questões são
  // classificadas, então um `skip` fixo pularia lotes inteiros. O id é estável.
  let cursor: string | undefined;
  let pendentes: { id: string; topicId: string; confidence: number }[] = [];

  /** Grava o lote numa transação só — uma escrita por questão no SQLite
   * custa um fsync cada e deixava o job em ~30 questões por minuto. */
  async function flush() {
    if (!pendentes.length || values['dry-run']) {
      pendentes = [];
      return;
    }
    const lote = pendentes;
    pendentes = [];
    await prisma.$transaction(
      lote.map((u) =>
        prisma.question.update({
          where: { id: u.id },
          data: {
            topicId: u.topicId,
            classificationConfidence: u.confidence,
            classificationSource: 'keywords',
          },
        }),
      ),
    );
  }

  for (;;) {
    if (limite && processadas >= limite) break;
    const lote = await prisma.question.findMany({
      where,
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        code: true,
        statement: true,
        questionPrompt: true,
        subjectArea: { select: { name: true } },
        alternatives: { select: { text: true } },
      },
    });
    if (lote.length === 0) break;
    cursor = lote[lote.length - 1].id;

    for (const q of lote) {
      if (limite && processadas >= limite) break;
      processadas += 1;
      const area = q.subjectArea?.name;
      if (!area) {
        semDecisao += 1;
        continue;
      }
      // As alternativas entram no texto: em Química e Física o vocabulário
      // decisivo costuma estar nelas ("mol", "J/kg"), não no enunciado.
      const texto = [
        q.statement,
        q.questionPrompt ?? '',
        ...q.alternatives.map((a) => a.text),
      ].join('\n');

      const decisao = classifyByKeywords(texto, area);
      if (!decisao) {
        semDecisao += 1;
        continue;
      }
      const chave = `${decisao.subject}::${decisao.topic}`;
      const topicId = idPorChave.get(chave);
      if (!topicId) {
        faltantes.add(chave);
        semDecisao += 1;
        continue;
      }

      classificadas += 1;
      porAssunto.set(chave, (porAssunto.get(chave) ?? 0) + 1);
      if (exemplos.length < amostra) {
        exemplos.push({ code: q.code ?? q.id, decisao });
      }
      pendentes.push({ id: q.id, topicId, confidence: decisao.confidence });
    }
    await flush();
    if (processadas % 1000 < PAGE) {
      console.log(
        `  ... ${processadas}/${total} (${classificadas} classificadas)`,
      );
    }
  }
  await flush();

  if (exemplos.length) {
    console.log('\n=== Amostra de decisões ===');
    for (const { code, decisao } of exemplos) {
      console.log(
        `  ${code.padEnd(18)} ${decisao.subject} / ${decisao.topic} ` +
          `(score ${decisao.score}, margem ${decisao.margin}) ← ${decisao.matched.join(', ')}`,
      );
    }
  }

  console.log('\n=== Resumo da classificação por palavra-chave ===');
  console.log(`processadas:   ${processadas}`);
  console.log(
    `classificadas: ${classificadas}` +
      (processadas
        ? ` (${Math.round((classificadas / processadas) * 100)}%)`
        : ''),
  );
  console.log(`sem decisão:   ${semDecisao} (seguem para a IA)`);

  const ranking = [...porAssunto.entries()].sort((a, b) => b[1] - a[1]);
  if (ranking.length) {
    console.log('\nAssuntos mais atribuídos:');
    for (const [chave, n] of ranking.slice(0, 15)) {
      console.log(`  ${String(n).padStart(5)}  ${chave.replace('::', ' / ')}`);
    }
  }
  if (faltantes.size) {
    console.log(
      `\n! assuntos citados pelas regras e ausentes da TAXONOMY: ${[...faltantes].join(', ')}`,
    );
  }
  if (values['dry-run']) console.log('\n(dry-run: nada foi gravado)');
}

main()
  .catch((e) => {
    console.error(`[classify-keywords] ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
