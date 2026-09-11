/**
 * Classifica em matéria/assunto as questões que entraram só com a área.
 *
 * Retomável por construção: a seleção é "sem assunto e com menos de N
 * tentativas". Questão classificada sai do conjunto sozinha, e um Ctrl+C perde
 * no máximo o lote em andamento — não há estado a restaurar.
 *
 * Abaixo da confiança mínima NÃO grava: incrementa a tentativa e segue.
 * Assunto errado é pior que assunto nenhum, porque contamina a revisão
 * espaçada, o mapa de calor e a recomendação do aluno. Sem o contador de
 * tentativas, o job reprocessaria para sempre as questões que a IA não
 * consegue decidir.
 */

import { PrismaClient } from '@prisma/client';
import { completeJson, JsonCompletionRequest } from '../src/common/ai';
import {
  buildClassificationPrompt,
  buildClassificationSchema,
  ClassificationDecision,
  CLASSIFICATION_SYSTEM_PROMPT,
  EXCLUDED_SUBJECTS,
  parseClassification,
  QuestionToClassify,
  TopicOption,
} from '../src/common/ai/classification';

export interface ClassifyOptions {
  /** Restringe a uma área (nome exato). */
  area?: string;
  /** Teto de questões processadas nesta execução. */
  limit?: number;
  /** Questões por chamada de IA. */
  batch?: number;
  /** Confiança mínima para gravar o assunto. */
  minConfidence?: number;
  /** Tentativas máximas por questão antes de desistir dela. */
  maxAttempts?: number;
  /** Decide sem gravar nada. */
  dryRun?: boolean;
  log?: (m: string) => void;
  /** Injetável para teste. */
  complete?: (req: JsonCompletionRequest) => Promise<string>;
}

export interface ClassifyReport {
  processed: number;
  classified: number;
  lowConfidence: number;
  failedBatches: number;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chama a IA com até 3 tentativas e espera crescente (rate limit, 5xx). */
async function comRetentativa<T>(
  fn: () => Promise<T>,
  log: (m: string) => void,
): Promise<T> {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      const ms = 2000 * 2 ** tentativa;
      log(
        `  ! falha na chamada (${(e as Error).message}); nova tentativa em ${ms / 1000}s`,
      );
      await esperar(ms);
    }
  }
  throw ultimo;
}

export async function classifyQuestions(
  prisma: PrismaClient,
  opts: ClassifyOptions = {},
): Promise<ClassifyReport> {
  const log = opts.log ?? console.log;
  const complete = opts.complete ?? completeJson;
  const tamanhoLote = opts.batch ?? 10;
  const minConfianca = opts.minConfidence ?? 0.6;
  const maxTentativas = opts.maxAttempts ?? 2;
  const report: ClassifyReport = {
    processed: 0,
    classified: 0,
    lowConfidence: 0,
    failedBatches: 0,
  };

  const areas = await prisma.subjectArea.findMany({
    where: opts.area ? { name: opts.area } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      subjects: {
        select: {
          name: true,
          topics: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (opts.area && areas.length === 0) {
    throw new Error(`área não encontrada: "${opts.area}"`);
  }

  for (const area of areas) {
    const opcoes: TopicOption[] = area.subjects
      .filter((s) => !EXCLUDED_SUBJECTS.has(s.name))
      .flatMap((s) =>
        s.topics.map((t) => ({
          topicId: t.id,
          subjectName: s.name,
          topicName: t.name,
        })),
      );
    if (opcoes.length === 0) continue;
    const schema = buildClassificationSchema(opcoes);

    const pendentes = await prisma.question.count({
      where: {
        subjectAreaId: area.id,
        topicId: null,
        classificationAttempts: { lt: maxTentativas },
      },
    });
    if (pendentes === 0) continue;
    log(`[classify] ${area.name} — ${pendentes} questões sem assunto`);

    // Em dry-run nada é gravado, então a mesma consulta devolveria sempre o
    // mesmo lote: avança por cursor em vez disso.
    let cursor: string | undefined;
    for (;;) {
      if (opts.limit && report.processed >= opts.limit) return report;
      const restante = opts.limit ? opts.limit - report.processed : tamanhoLote;
      const lote: QuestionToClassify[] = await prisma.question.findMany({
        where: {
          subjectAreaId: area.id,
          topicId: null,
          classificationAttempts: { lt: maxTentativas },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: Math.min(tamanhoLote, restante),
        select: { id: true, statement: true, questionPrompt: true },
      });
      if (lote.length === 0) break;
      cursor = lote[lote.length - 1].id;

      let raw: string;
      try {
        raw = await comRetentativa(
          () =>
            complete({
              system: CLASSIFICATION_SYSTEM_PROMPT,
              user: buildClassificationPrompt(area.name, lote),
              schema,
              schemaName: 'enem_topic_classification',
              maxTokens: 1024,
              model: process.env.AI_CLASSIFY_MODEL,
            }),
          log,
        );
      } catch (e) {
        // Lote que falhou 3 vezes: segue para o próximo, sem gastar tentativa
        // das questões — a falha foi da chamada, não da classificação.
        report.failedBatches += 1;
        log(`  ✗ lote descartado: ${(e as Error).message}`);
        continue;
      }

      let decisoes: ClassificationDecision[];
      try {
        decisoes = parseClassification(raw, lote, opcoes);
      } catch (e) {
        report.failedBatches += 1;
        log(`  ✗ resposta inválida: ${(e as Error).message}`);
        continue;
      }

      for (const d of decisoes) {
        const aceita = d.topicId !== null && d.confidence >= minConfianca;
        if (aceita) report.classified += 1;
        else report.lowConfidence += 1;
        if (opts.dryRun) continue;
        await prisma.question.update({
          where: { id: d.questionId },
          data: aceita
            ? { topicId: d.topicId, classificationConfidence: d.confidence }
            : {
                classificationConfidence: d.confidence,
                classificationAttempts: { increment: 1 },
              },
        });
      }
      report.processed += lote.length;
      log(
        `  ${report.processed} processadas · ${report.classified} classificadas · ` +
          `${report.lowConfidence} com baixa confiança`,
      );
    }
  }
  return report;
}
