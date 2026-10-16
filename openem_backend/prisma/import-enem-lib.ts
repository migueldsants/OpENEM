/**
 * Importa as provas oficiais do ENEM para o banco do OpENEM.
 *
 * A origem é o dataset estático do projeto enem-api (enem.dev): um diretório
 * por prova, com um `details.json` por questão e as imagens ao lado. O dataset
 * NÃO é versionado aqui — é baixado para uma pasta ignorada pelo git. Além de
 * manter o repositório leve, isso evita misturar arquivos de um projeto GPL-2.0
 * numa base AGPL-3.0. As provas em si são do INEP.
 *
 * A tradução do formato vive em `src/common/enem-import/mapping.ts` (pura e
 * testada); aqui fica só o I/O: download, varredura, cópia de imagem e escrita.
 *
 * ATENÇÃO ao reimportar: `Answer.chosenId` guarda o id da alternativa mas NÃO
 * tem chave estrangeira. Recriar as alternativas de uma questão orfanaria as
 * respostas já dadas pelos alunos, em silêncio e sem erro de integridade. Por
 * isso as alternativas só são recriadas quando realmente mudaram.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PrismaClient } from '@prisma/client';
import {
  dayRange,
  imageRelativePath,
  mapExam,
  officialDurationMin,
  mapQuestion,
  MappedQuestion,
  QuestionValidationError,
  RawExam,
  RawQuestion,
} from '../src/common/enem-import/mapping';

const TARBALL_URL =
  'https://codeload.github.com/migueldsants/updated-enem-api/tar.gz/refs/heads/main';

export interface ImportOptions {
  /** Diretório com o dataset já extraído (contendo `public/`). */
  datasetDir: string;
  /** Destino das imagens. Sem isso, as imagens não são copiadas. */
  mediaDir?: string;
  /** Restringe a provas específicas ("2023", "2023-reaplicacao"). */
  exams?: string[];
  /** Teto de questões por prova — para testar o pipeline rápido. */
  limit?: number;
  /** Mapeia e valida sem escrever nada no banco. */
  dryRun?: boolean;
  /** Loga cada questão importada. */
  verbose?: boolean;
  log?: (msg: string) => void;
}

export interface ImportReport {
  exams: number;
  created: number;
  updated: number;
  skipped: number;
  alternativesRebuilt: number;
  /** Questões cuja área veio da numeração por o rótulo do dataset estar errado. */
  areasCorrected: number;
  /** Simulados das provas oficiais criados/atualizados. */
  examTemplates: number;
  imagesCopied: number;
  unmappedImages: number;
  classified: number;
  failures: { externalId: string; motivo: string }[];
}

/** Baixa e extrai o dataset, a menos que ele já esteja no lugar. */
export async function ensureDataset(
  destino: string,
  opts: { refresh?: boolean; log?: (m: string) => void } = {},
): Promise<string> {
  const log = opts.log ?? console.log;
  const publicDir = join(destino, 'public');
  if (existsSync(publicDir) && !opts.refresh) {
    log(`[import-enem] dataset já presente em ${destino}`);
    return destino;
  }
  if (opts.refresh && existsSync(destino)) {
    rmSync(destino, { recursive: true, force: true });
  }
  mkdirSync(destino, { recursive: true });

  const tgz = join(destino, 'dataset.tar.gz');
  log('[import-enem] baixando o dataset (177 MB, pode demorar)...');
  const res = await fetch(TARBALL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`falha ao baixar o dataset: HTTP ${res.status}`);
  }
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(tgz),
  );

  log('[import-enem] extraindo...');
  try {
    // `tar` existe no Windows 11, no node:22-bookworm-slim e nos runners do CI.
    // Os caminhos vão RELATIVOS, com o cwd no destino: o tar do Git Bash lê
    // "C:\..." como se "C" fosse um host remoto e falha o download.
    execFileSync('tar', ['-xzf', 'dataset.tar.gz', '--strip-components=1'], {
      cwd: destino,
      stdio: 'inherit',
    });
  } catch {
    throw new Error(
      'não foi possível extrair o tarball: o comando `tar` não está disponível. ' +
        'Extraia manualmente e rode com --skip-download apontando ENEM_DATASET_DIR.',
    );
  }
  rmSync(tgz, { force: true });
  return destino;
}

/** Lê um JSON do disco, com mensagem de erro que diz qual arquivo falhou. */
function lerJson<T>(caminho: string): T {
  try {
    return JSON.parse(readFileSync(caminho, 'utf8')) as T;
  } catch (e) {
    throw new Error(`JSON inválido em ${caminho}: ${(e as Error).message}`);
  }
}

/** Diretórios de prova presentes no dataset, em ordem cronológica estável. */
export function listExamSlugs(datasetDir: string): string[] {
  const publicDir = join(datasetDir, 'public');
  if (!existsSync(publicDir)) {
    throw new Error(`dataset sem a pasta public/: ${publicDir}`);
  }
  // Itera os diretórios, e não o `exams.json` — este lista só as 17 provas
  // regulares e deixa as 9 reaplicações de fora.
  return readdirSync(publicDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(join(publicDir, d.name, 'details.json')),
    )
    .map((d) => d.name)
    .sort();
}

/** Assinatura das alternativas, para decidir se precisam ser recriadas. */
function fingerprint(
  alts: {
    letter: string | null;
    text: string;
    imageUrl: string | null;
    isCorrect: boolean;
    position: number;
  }[],
): string {
  return JSON.stringify(
    [...alts]
      .sort((a, b) => a.position - b.position)
      .map((a) => [a.letter, a.text, a.imageUrl, a.isCorrect, a.position]),
  );
}

/** Catálogo de área/matéria/assunto resolvido uma vez, não por questão. */
async function carregarTaxonomia(prisma: PrismaClient) {
  const areas = await prisma.subjectArea.findMany({
    select: { id: true, name: true },
  });
  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true },
  });
  const topics = await prisma.topic.findMany({
    select: { id: true, name: true, subjectId: true },
  });
  return {
    areaPorNome: new Map(areas.map((a) => [a.name, a.id])),
    subjectPorNome: new Map(subjects.map((s) => [s.name, s.id])),
    topicPorChave: new Map(
      topics.map((t) => [`${t.subjectId}::${t.name}`, t.id]),
    ),
  };
}

/** Copia as imagens de uma questão para o diretório servido pelo backend. */
function copiarImagens(
  questao: MappedQuestion,
  origemDir: string,
  mediaDir: string,
  report: ImportReport,
): void {
  for (const url of questao.imageUrls) {
    const relativo = imageRelativePath(url);
    if (!relativo) {
      report.unmappedImages += 1;
      continue;
    }
    const arquivo = relativo.split('/').pop()!;
    const origem = join(origemDir, arquivo);
    if (!existsSync(origem)) {
      report.unmappedImages += 1;
      continue;
    }
    const destino = join(mediaDir, ...relativo.split('/'));
    // Já copiada com o mesmo tamanho: o nome é um UUID, o conteúdo não muda.
    if (
      existsSync(destino) &&
      statSync(destino).size === statSync(origem).size
    ) {
      continue;
    }
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(origem, destino);
    report.imagesCopied += 1;
  }
}

/**
 * Importa as provas do dataset. Idempotente: rodar de novo não duplica nada
 * nem desfaz o que já foi feito depois do import (classificação de assunto,
 * comentários gerados, calibração de TRI).
 */
export async function importEnem(
  prisma: PrismaClient,
  opts: ImportOptions,
): Promise<ImportReport> {
  const log = opts.log ?? console.log;
  const report: ImportReport = {
    exams: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    alternativesRebuilt: 0,
    imagesCopied: 0,
    unmappedImages: 0,
    classified: 0,
    areasCorrected: 0,
    examTemplates: 0,
    failures: [],
  };

  const taxonomia = await carregarTaxonomia(prisma);
  const slugs = listExamSlugs(opts.datasetDir).filter(
    (s) => !opts.exams?.length || opts.exams.includes(s),
  );
  if (slugs.length === 0) {
    throw new Error('nenhuma prova encontrada para os filtros informados');
  }

  for (const slug of slugs) {
    const inicio = Date.now();
    const examDir = join(opts.datasetDir, 'public', slug);
    const prova = mapExam(
      slug,
      lerJson<RawExam>(join(examDir, 'details.json')),
    );

    const areaFaltante = new Set<string>();
    let examYearId: string | null = null;
    if (!opts.dryRun) {
      const registro = await prisma.examYear.upsert({
        where: { slug: prova.slug },
        update: {
          year: prova.year,
          label: prova.label,
          isReapplication: prova.isReapplication,
          kind: prova.kind,
        },
        create: prova,
      });
      examYearId = registro.id;
    }

    const questionsDir = join(examDir, 'questions');
    const dirs = existsSync(questionsDir)
      ? readdirSync(questionsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort((a, b) => porIndice(a) - porIndice(b) || a.localeCompare(b))
      : [];
    const alvo = opts.limit ? dirs.slice(0, opts.limit) : dirs;

    let criadas = 0;
    let atualizadas = 0;
    let puladas = 0;

    for (const dir of alvo) {
      const detalhes = join(questionsDir, dir, 'details.json');
      if (!existsSync(detalhes)) {
        puladas += 1;
        continue;
      }
      let questao: MappedQuestion;
      try {
        questao = mapQuestion(lerJson<RawQuestion>(detalhes), slug, dir);
      } catch (e) {
        // Questão malformada é pulada e reportada — nunca aborta o import.
        const motivo =
          e instanceof QuestionValidationError
            ? e.message
            : (e as Error).message;
        report.failures.push({ externalId: `enem:${slug}:${dir}`, motivo });
        puladas += 1;
        continue;
      }

      const areaId = taxonomia.areaPorNome.get(questao.areaName);
      if (!areaId) {
        areaFaltante.add(questao.areaName);
        report.failures.push({
          externalId: questao.externalId,
          motivo: `área "${questao.areaName}" ausente do banco — rode o seed antes`,
        });
        puladas += 1;
        continue;
      }

      let topicId: string | null = null;
      if (questao.subjectName && questao.topicName) {
        const subjectId = taxonomia.subjectPorNome.get(questao.subjectName);
        topicId = subjectId
          ? (taxonomia.topicPorChave.get(
              `${subjectId}::${questao.topicName}`,
            ) ?? null)
          : null;
      }

      if (opts.mediaDir && !opts.dryRun) {
        copiarImagens(questao, join(questionsDir, dir), opts.mediaDir, report);
      }

      if (opts.dryRun) {
        criadas += 1;
        if (topicId || questao.topicName) report.classified += 1;
        if (opts.verbose) log(`  [dry-run] ${questao.externalId}`);
        continue;
      }

      const existente = await prisma.question.findUnique({
        where: { externalId: questao.externalId },
        select: {
          id: true,
          topic: { select: { subject: { select: { subjectAreaId: true } } } },
          alternatives: {
            select: {
              letter: true,
              text: true,
              imageUrl: true,
              isCorrect: true,
              position: true,
            },
          },
        },
      });

      if (!existente) {
        await prisma.question.create({
          data: {
            externalId: questao.externalId,
            code: questao.code,
            number: questao.number,
            source: questao.source,
            statement: questao.statement,
            questionPrompt: questao.questionPrompt,
            language: questao.language,
            subjectAreaId: areaId,
            topicId,
            examYearId,
            alternatives: { create: questao.alternatives },
          },
        });
        criadas += 1;
      } else {
        // O update NÃO toca em explanation/explanationSource, topicId nem nos
        // parâmetros de TRI: são resultado de trabalho feito depois do import,
        // e reimportar não pode desfazê-los.
        // Se a área mudou (rótulo corrigido pela numeração) e o assunto já
        // gravado é de outra área, o assunto está errado: sai, e a questão
        // volta para a fila da classificação.
        const assuntoDeOutraArea =
          !!existente.topic && existente.topic.subject.subjectAreaId !== areaId;
        await prisma.question.update({
          where: { id: existente.id },
          data: {
            code: questao.code,
            number: questao.number,
            statement: questao.statement,
            questionPrompt: questao.questionPrompt,
            language: questao.language,
            subjectAreaId: areaId,
            examYearId,
            ...(assuntoDeOutraArea
              ? {
                  topicId: topicId,
                  classificationConfidence: null,
                  classificationAttempts: 0,
                }
              : {}),
          },
        });
        if (
          fingerprint(existente.alternatives) !==
          fingerprint(questao.alternatives)
        ) {
          await prisma.alternative.deleteMany({
            where: { questionId: existente.id },
          });
          await prisma.alternative.createMany({
            data: questao.alternatives.map((a) => ({
              ...a,
              questionId: existente.id,
            })),
          });
          report.alternativesRebuilt += 1;
          log(
            `  [alternativas recriadas] ${questao.externalId} — respostas antigas podem ter perdido a referência`,
          );
        }
        atualizadas += 1;
      }
      if (topicId) report.classified += 1;
      if (questao.areaCorrected) report.areasCorrected += 1;
      if (opts.verbose) log(`  ${questao.externalId}`);
    }

    if (examYearId) {
      report.examTemplates += await upsertExamTemplates(
        prisma,
        examYearId,
        prova,
      );
    }

    if (areaFaltante.size) {
      log(
        `  ! áreas ausentes do banco: ${[...areaFaltante].join(', ')} — rode \`npm run db:seed\``,
      );
    }
    report.exams += 1;
    report.created += criadas;
    report.updated += atualizadas;
    report.skipped += puladas;
    const seg = ((Date.now() - inicio) / 1000).toFixed(1);
    log(
      `[import-enem] ${prova.label} — ${alvo.length} questões ` +
        `(${criadas} novas, ${atualizadas} atualizadas, ${puladas} puladas) em ${seg}s`,
    );
  }

  return report;
}

/**
 * Mínimo de questões aproveitáveis para um dia virar simulado: metade das 90.
 * Algumas reaplicações vieram do dataset quase sem alternativas (a de 2020
 * inteira, a de 2017 com uma questão no 1º dia) — oferecer isso como "prova"
 * seria enganar o aluno.
 */
const MIN_QUESTIONS_PER_DAY = 45;

/**
 * Um simulado por dia de cada prova, na ordem do caderno. O id é estável
 * ("enem-2023-dia1") para reimportar sem duplicar. Dia abaixo do mínimo fica
 * arquivado, fora da lista.
 */
async function upsertExamTemplates(
  prisma: PrismaClient,
  examYearId: string,
  prova: { slug: string; year: number; label: string },
): Promise<number> {
  let gravados = 0;
  for (const day of [1, 2] as const) {
    // Questões distintas pelo número: inglês e espanhol são a mesma questão.
    const numeros = await prisma.question.groupBy({
      by: ['number'],
      where: { examYearId, number: dayRange(day) },
    });
    const id = `enem-${prova.slug}-dia${day}`;
    const dados = {
      name: `${prova.label} · ${day}º dia`,
      scope: 'EXAM',
      examYearId,
      day,
      questionCount: numeros.length,
      timeLimitMin: officialDurationMin(prova.year, day),
      archived: numeros.length < MIN_QUESTIONS_PER_DAY,
    };
    await prisma.simulationTemplate.upsert({
      where: { id },
      update: dados,
      create: { id, ...dados },
    });
    gravados += 1;
  }
  return gravados;
}

/** Ordena "1", "2", "10" numericamente; "1-ingles" vale pelo número inicial. */
function porIndice(dir: string): number {
  const n = Number.parseInt(dir, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

/** Imprime o resumo final do import. */
export function printReport(
  report: ImportReport,
  log: (m: string) => void = console.log,
): void {
  log('');
  log('=== Resumo do import ===');
  log(`provas:               ${report.exams}`);
  log(`questões novas:       ${report.created}`);
  log(`questões atualizadas: ${report.updated}`);
  log(`questões puladas:     ${report.skipped}`);
  log(`já classificadas:     ${report.classified} (língua estrangeira)`);
  log(`imagens copiadas:     ${report.imagesCopied}`);
  log(`simulados de prova:   ${report.examTemplates}`);
  if (report.areasCorrected) {
    log(
      `áreas corrigidas:     ${report.areasCorrected} (rótulo do dataset divergia da numeração oficial)`,
    );
  }
  if (report.unmappedImages) {
    log(`imagens não resolvidas: ${report.unmappedImages}`);
  }
  if (report.alternativesRebuilt) {
    log(`alternativas recriadas: ${report.alternativesRebuilt}`);
  }
  if (report.failures.length) {
    log('');
    log(`${report.failures.length} questão(ões) recusadas, por motivo:`);
    // Agregado por motivo e por prova: listar centenas de linhas uma a uma não
    // ajuda ninguém a decidir o que fazer.
    const porMotivo = new Map<string, { total: number; provas: Set<string> }>();
    for (const f of report.failures) {
      const chave = f.motivo.replace(/"[^"]*"/g, '"..."');
      const bucket = porMotivo.get(chave) ?? { total: 0, provas: new Set() };
      bucket.total += 1;
      bucket.provas.add(f.externalId.split(':')[1] ?? '?');
      porMotivo.set(chave, bucket);
    }
    for (const [motivo, { total, provas }] of [...porMotivo.entries()].sort(
      (a, b) => b[1].total - a[1].total,
    )) {
      const lista = [...provas].sort();
      const resumo =
        lista.length > 6
          ? `${lista.slice(0, 6).join(', ')} e mais ${lista.length - 6}`
          : lista.join(', ');
      log(`  ${total}x  ${motivo}`);
      log(`        provas: ${resumo}`);
    }
    log('');
    log(
      'Questões recusadas ficam FORA do banco de propósito: sem as alternativas,',
    );
    log(
      'não há como respondê-las. A falha é do dataset de origem, não do import.',
    );
  }
}
