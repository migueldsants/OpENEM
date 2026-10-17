import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { importEnem } from '../prisma/import-enem-lib';

/**
 * Import das provas oficiais contra uma prova sintética minúscula (3 questões).
 * O dataset real tem 177 MB e não pode entrar na suíte — o que se verifica aqui
 * é o contrato do importador, não o conteúdo do ENEM.
 */
describe('importEnem (e2e)', () => {
  const prisma = new PrismaClient();
  const datasetDir = join(__dirname, 'fixtures', 'enem-dataset');
  const SLUG = '2098';

  async function limpar() {
    await prisma.question.deleteMany({
      where: { externalId: { startsWith: `enem:${SLUG}:` } },
    });
    await prisma.simulationTemplate.deleteMany({
      where: { id: { startsWith: `enem-${SLUG}-` } },
    });
    await prisma.examYear.deleteMany({ where: { slug: SLUG } });
  }

  beforeAll(limpar);
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it('importa a prova, classifica a de idioma e recusa a inconsistente', async () => {
    const report = await importEnem(prisma, {
      datasetDir,
      exams: [SLUG],
      log: () => {},
    });

    expect(report.exams).toBe(1);
    expect(report.created).toBe(2);
    // A terceira tem gabarito divergente entre as duas fontes do dataset.
    expect(report.skipped).toBe(1);
    expect(report.failures[0].externalId).toBe(`enem:${SLUG}:3`);
    expect(report.failures[0].motivo).toContain('gabarito');

    const prova = await prisma.examYear.findUnique({ where: { slug: SLUG } });
    expect(prova).toMatchObject({ year: 2098, isReapplication: false });

    const q = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:10` },
      include: {
        subjectArea: true,
        topic: true,
        alternatives: { orderBy: { position: 'asc' } },
      },
    });
    expect(q!.source).toBe('ENEM_DEV');
    expect(q!.code).toBe('ENEM-2098-010');
    expect(q!.number).toBe(10);
    expect(q!.subjectArea!.name).toBe('Linguagens, Códigos e suas Tecnologias');
    // Entra só com a área: matéria/assunto vêm depois, na classificação.
    expect(q!.topicId).toBeNull();
    expect(q!.explanation).toBeNull();
    expect(q!.questionPrompt).toBe('Qual o valor de x?');
    // A imagem aponta para o backend, não para o enem.dev.
    expect(q!.statement).toContain('/media/enem/2098/10/fig.png');
    expect(q!.statement).not.toContain('enem.dev');
    expect(q!.alternatives.map((a) => a.letter)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);
    expect(q!.alternatives.find((a) => a.isCorrect)!.letter).toBe('C');
  });

  it('cria os simulados da prova, arquivando dia com poucas questões', async () => {
    const dias = await prisma.simulationTemplate.findMany({
      where: { id: { startsWith: `enem-${SLUG}-` } },
      orderBy: { day: 'asc' },
    });
    expect(dias.map((d) => d.id)).toEqual([
      `enem-${SLUG}-dia1`,
      `enem-${SLUG}-dia2`,
    ]);
    expect(dias.every((d) => d.scope === 'EXAM')).toBe(true);
    // A prova de teste tem uma questão por dia: longe do mínimo para virar
    // simulado, então nenhum dos dois aparece na lista.
    expect(dias.every((d) => d.archived)).toBe(true);
  });

  it('a questão de língua estrangeira já nasce classificada', async () => {
    const le = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:2-ingles` },
      include: { topic: { include: { subject: true } } },
    });
    expect(le!.language).toBe('ingles');
    expect(le!.topic!.subject.name).toBe('Língua Estrangeira');
    expect(le!.topic!.name).toBe('Interpretação de texto em inglês');
  });

  it('reimportar não duplica nada', async () => {
    const antes = await prisma.question.count({
      where: { externalId: { startsWith: `enem:${SLUG}:` } },
    });

    const report = await importEnem(prisma, {
      datasetDir,
      exams: [SLUG],
      log: () => {},
    });

    expect(report.created).toBe(0);
    expect(report.updated).toBe(2);
    expect(report.alternativesRebuilt).toBe(0);
    const depois = await prisma.question.count({
      where: { externalId: { startsWith: `enem:${SLUG}:` } },
    });
    expect(depois).toBe(antes);
  });

  it('reimportar preserva o comentário e a classificação já feitos', async () => {
    // Simula o trabalho posterior ao import: comentário gerado e assunto
    // classificado. Uma reimportação não pode desfazer nenhum dos dois.
    // Um assunto da MESMA área da questão (Linguagens): assunto de outra área
    // seria limpo na reimportação, de propósito. E Linguagens porque nenhuma
    // outra suíte sorteia simulado por essa área em paralelo no mesmo banco.
    const topico = await prisma.topic.findFirstOrThrow({
      where: {
        name: 'Interpretação de texto',
        subject: { name: 'Língua Portuguesa' },
      },
    });
    await prisma.question.update({
      where: { externalId: `enem:${SLUG}:10` },
      data: {
        explanation: 'Comentário escrito depois do import.',
        explanationSource: 'humano',
        topicId: topico.id,
      },
    });

    await importEnem(prisma, { datasetDir, exams: [SLUG], log: () => {} });

    const q = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:10` },
    });
    expect(q!.explanation).toBe('Comentário escrito depois do import.');
    expect(q!.explanationSource).toBe('humano');
    expect(q!.topicId).toBe(topico.id);
  });

  it('reimportar limpa assunto de outra área (rótulo errado corrigido)', async () => {
    // Questão de Linguagens com assunto de Humanas: aconteceria se a área tivesse
    // vindo errada do dataset e a questão fosse classificada antes da correção.
    const deOutraArea = await prisma.topic.findFirstOrThrow({
      where: { name: 'Pré-história' },
    });
    await prisma.question.update({
      where: { externalId: `enem:${SLUG}:10` },
      data: {
        topicId: deOutraArea.id,
        classificationConfidence: 0.9,
        classificationAttempts: 1,
      },
    });

    await importEnem(prisma, { datasetDir, exams: [SLUG], log: () => {} });

    const q = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:10` },
    });
    expect(q!.topicId).toBeNull();
    // Volta para a fila da classificação, do zero.
    expect(q!.classificationAttempts).toBe(0);
    expect(q!.classificationConfidence).toBeNull();
  });
});

describe('importEnem (e2e) — ENEM de caderno único (até 2008)', () => {
  const prisma = new PrismaClient();
  const datasetDir = join(__dirname, 'fixtures', 'enem-dataset');
  // Ano sintético (1898): até 2008 a prova era uma só, sem as quatro áreas.
  const SLUG = '1898';

  async function limpar() {
    await prisma.question.deleteMany({
      where: { externalId: { startsWith: `enem:${SLUG}:` } },
    });
    await prisma.simulationTemplate.deleteMany({
      where: { id: { startsWith: `enem-${SLUG}-` } },
    });
    await prisma.examYear.deleteMany({ where: { slug: SLUG } });
  }

  beforeAll(limpar);
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  it('importa a questão sem área, sem tratar isso como erro', async () => {
    const report = await importEnem(prisma, {
      datasetDir,
      exams: [SLUG],
      log: () => {},
    });
    expect(report.created).toBe(1);
    expect(report.failures).toEqual([]);

    const q = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:7` },
    });
    expect(q!.subjectAreaId).toBeNull();
    expect(q!.code).toBe('ENEM-1898-007');
  });

  it('cria um simulado só, com a prova inteira e as 5 horas oficiais', async () => {
    const dias = await prisma.simulationTemplate.findMany({
      where: { id: { startsWith: `enem-${SLUG}-` } },
    });
    expect(dias).toHaveLength(1);
    expect(dias[0]).toMatchObject({
      id: `enem-${SLUG}-dia1`,
      name: 'ENEM 1898',
      day: 1,
      questionCount: 1,
      timeLimitMin: 300,
    });
  });

  it('reimportar preserva a área e o assunto classificados depois', async () => {
    const topico = await prisma.topic.findFirstOrThrow({
      where: { name: 'Pré-história' },
      include: { subject: true },
    });
    await prisma.question.update({
      where: { externalId: `enem:${SLUG}:7` },
      data: {
        subjectAreaId: topico.subject.subjectAreaId,
        topicId: topico.id,
      },
    });

    await importEnem(prisma, { datasetDir, exams: [SLUG], log: () => {} });

    const q = await prisma.question.findUnique({
      where: { externalId: `enem:${SLUG}:7` },
    });
    expect(q!.subjectAreaId).toBe(topico.subject.subjectAreaId);
    expect(q!.topicId).toBe(topico.id);
  });
});
