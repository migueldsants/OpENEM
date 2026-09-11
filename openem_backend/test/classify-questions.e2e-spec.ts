import { PrismaClient } from '@prisma/client';
import { JsonCompletionRequest } from '../src/common/ai';
import { classifyQuestions } from '../prisma/classify-questions-lib';

/**
 * Job de classificação contra o banco de teste, com uma "IA" falsa que devolve
 * respostas controladas. Verifica as regras que protegem o banco: só grava
 * acima da confiança mínima, conta tentativas e desiste depois do teto.
 */
describe('classifyQuestions (e2e)', () => {
  const prisma = new PrismaClient();
  // Humanas: nenhuma outra suíte cria questões sem assunto nessa área. As suítes
  // e2e rodam em paralelo no mesmo banco, e o job pegaria as questões delas.
  const AREA = 'Ciências Humanas e suas Tecnologias';
  const PREFIXO = 'enem:classify-e2e:';
  let areaId: string;

  async function limpar() {
    await prisma.question.deleteMany({
      where: { externalId: { startsWith: PREFIXO } },
    });
  }

  async function criar(n: number) {
    for (let i = 1; i <= n; i++) {
      await prisma.question.create({
        data: {
          externalId: `${PREFIXO}${i}`,
          source: 'ENEM_DEV',
          statement: `Questão de teste ${i}`,
          subjectAreaId: areaId,
          alternatives: {
            create: [
              { letter: 'A', text: 'a', isCorrect: true, position: 0 },
              { letter: 'B', text: 'b', isCorrect: false, position: 1 },
            ],
          },
        },
      });
    }
  }

  /** IA falsa: responde cada [qN] do prompt com o assunto e a confiança dados. */
  function iaFalsa(topic: string, confidence: number) {
    return jest.fn((req: JsonCompletionRequest) => {
      const refs = [...req.user.matchAll(/\[(q\d+)\]/g)].map((m) => m[1]);
      return Promise.resolve(
        JSON.stringify({
          results: refs.map((ref) => ({ ref, topic, confidence })),
        }),
      );
    });
  }

  beforeAll(async () => {
    const area = await prisma.subjectArea.findUniqueOrThrow({
      where: { name: AREA },
    });
    areaId = area.id;
  });
  beforeEach(limpar);
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  function doTeste() {
    return {
      where: { externalId: { startsWith: PREFIXO } },
    };
  }

  it('grava o assunto quando a confiança passa do mínimo', async () => {
    await criar(3);
    const ia = iaFalsa('Geografia / Urbanização', 0.9);

    const report = await classifyQuestions(prisma, {
      area: AREA,
      batch: 2,
      complete: ia,
      log: () => {},
    });

    const questoes = await prisma.question.findMany({
      ...doTeste(),
      include: { topic: true },
    });
    expect(questoes.every((q) => q.topic?.name === 'Urbanização')).toBe(true);
    expect(questoes.every((q) => q.classificationConfidence === 0.9)).toBe(
      true,
    );
    expect(report.classified).toBeGreaterThanOrEqual(3);
    // O schema enviado restringe o assunto aos da área.
    const schema = ia.mock.calls[0][0].schema as any;
    const enumAssuntos: string[] =
      schema.properties.results.items.properties.topic.enum;
    expect(enumAssuntos).toContain('Geografia / Urbanização');
    // Só assuntos de Humanas: nada de outra área no cardápio.
    expect(enumAssuntos.some((e) => e.startsWith('Matemática /'))).toBe(false);
  });

  it('abaixo do mínimo NÃO grava e conta a tentativa', async () => {
    await criar(2);

    await classifyQuestions(prisma, {
      area: AREA,
      complete: iaFalsa('Geografia / Urbanização', 0.3),
      log: () => {},
    });

    const questoes = await prisma.question.findMany(doTeste());
    expect(questoes.every((q) => q.topicId === null)).toBe(true);
    expect(questoes.every((q) => q.classificationAttempts === 1)).toBe(true);
  });

  it('desiste da questão depois do teto de tentativas', async () => {
    await criar(1);
    const ia = iaFalsa('Geografia / Urbanização', 0.1);

    await classifyQuestions(prisma, {
      area: AREA,
      complete: ia,
      log: () => {},
    });
    await classifyQuestions(prisma, {
      area: AREA,
      complete: ia,
      log: () => {},
    });
    const chamadasAntes = ia.mock.calls.length;
    // Terceira rodada: a questão já tem 2 tentativas e sai da fila.
    await classifyQuestions(prisma, {
      area: AREA,
      complete: ia,
      log: () => {},
    });

    const q = await prisma.question.findFirstOrThrow(doTeste());
    expect(q.classificationAttempts).toBe(2);
    const promptsDaTerceira = ia.mock.calls
      .slice(chamadasAntes)
      .map((c) => c[0].user);
    expect(
      promptsDaTerceira.some((u) => u.includes('Questão de teste 1')),
    ).toBe(false);
  });

  it('dry-run decide sem gravar nada', async () => {
    await criar(2);

    const report = await classifyQuestions(prisma, {
      area: AREA,
      dryRun: true,
      complete: iaFalsa('Geografia / Urbanização', 0.95),
      log: () => {},
    });

    expect(report.classified).toBeGreaterThanOrEqual(2);
    const questoes = await prisma.question.findMany(doTeste());
    expect(questoes.every((q) => q.topicId === null)).toBe(true);
    expect(questoes.every((q) => q.classificationAttempts === 0)).toBe(true);
  });

  it('falha da IA não gasta tentativa da questão', async () => {
    await criar(1);
    const quebrada = jest.fn().mockResolvedValue('isto não é json');

    const report = await classifyQuestions(prisma, {
      area: AREA,
      complete: quebrada,
      log: () => {},
    });

    expect(report.failedBatches).toBeGreaterThanOrEqual(1);
    const q = await prisma.question.findFirstOrThrow(doTeste());
    expect(q.classificationAttempts).toBe(0);
  });
});
