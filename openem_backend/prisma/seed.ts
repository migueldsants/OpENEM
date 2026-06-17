import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de demonstração (Fase 1).
 * Conteúdo real (provas oficiais + autorais) será curado depois — ver docs/PRD.md §17.
 */
async function main() {
  const areas = [
    'Matemática e suas Tecnologias',
    'Ciências da Natureza e suas Tecnologias',
    'Ciências Humanas e suas Tecnologias',
    'Linguagens, Códigos e suas Tecnologias',
    'Redação',
  ];
  for (const name of areas) {
    await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const math = await prisma.subject.findUniqueOrThrow({
    where: { name: 'Matemática e suas Tecnologias' },
  });
  const nature = await prisma.subject.findUniqueOrThrow({
    where: { name: 'Ciências da Natureza e suas Tecnologias' },
  });

  const examYear = await prisma.examYear.upsert({
    where: { year: 2023 },
    update: {},
    create: { year: 2023 },
  });

  async function ensureTopic(subjectId: string, name: string) {
    return prisma.topic.upsert({
      where: { subjectId_name: { subjectId, name } },
      update: {},
      create: { subjectId, name },
    });
  }

  async function ensureQuestion(
    topicId: string,
    statement: string,
    difficulty: number,
    explanation: string,
    alternatives: { text: string; isCorrect: boolean }[],
  ) {
    const existing = await prisma.question.findFirst({ where: { statement } });
    if (existing) return;
    await prisma.question.create({
      data: {
        statement,
        difficulty,
        explanation,
        topicId,
        examYearId: examYear.id,
        alternatives: { create: alternatives },
        // Calibração TRI de demonstração (parâmetros 3PL plausíveis derivados do
        // nível): a=1, c=0.2, b mapeado de difficulty 1..5 para a escala latente.
        discrimination: 1.0,
        irtDifficulty: (difficulty - 3) * 0.8,
        guessing: 0.2,
      },
    });
  }

  const funcoes = await ensureTopic(math.id, 'Funções');
  const probabilidade = await ensureTopic(math.id, 'Probabilidade');
  const cinematica = await ensureTopic(nature.id, 'Cinemática');

  const abcde = (correct: number) => (i: number) => i === correct;

  await ensureQuestion(
    funcoes.id,
    'Para f(x) = 2x + 1, qual é o valor de f(2)?',
    1,
    'Substituindo x = 2: f(2) = 2·2 + 1 = 5.',
    ['3', '4', '5', '6', '7'].map((text, i) => ({
      text,
      isCorrect: abcde(2)(i),
    })),
  );
  await ensureQuestion(
    funcoes.id,
    'A função f(x) = x² - 4 tem raízes em quais valores de x?',
    2,
    'x² - 4 = 0 → x² = 4 → x = ±2.',
    ['x = 0', 'x = ±2', 'x = 4', 'x = ±4', 'x = 2'].map((text, i) => ({
      text,
      isCorrect: abcde(1)(i),
    })),
  );
  await ensureQuestion(
    probabilidade.id,
    'Ao lançar um dado honesto, qual a probabilidade de sair um número par?',
    1,
    'Pares: 2, 4, 6 → 3 em 6 → 1/2.',
    ['1/6', '1/3', '1/2', '2/3', '1'].map((text, i) => ({
      text,
      isCorrect: abcde(2)(i),
    })),
  );
  await ensureQuestion(
    probabilidade.id,
    'Numa urna com 3 bolas vermelhas e 2 azuis, qual a probabilidade de tirar uma azul?',
    2,
    'Azuis: 2 de 5 → 2/5.',
    ['1/5', '2/5', '1/2', '3/5', '2/3'].map((text, i) => ({
      text,
      isCorrect: abcde(1)(i),
    })),
  );
  await ensureQuestion(
    cinematica.id,
    'Um carro a 20 m/s percorre quantos metros em 5 segundos (MRU)?',
    1,
    'd = v·t = 20·5 = 100 m.',
    ['80 m', '90 m', '100 m', '110 m', '120 m'].map((text, i) => ({
      text,
      isCorrect: abcde(2)(i),
    })),
  );
  await ensureQuestion(
    cinematica.id,
    'Na queda livre (g = 10 m/s²), qual a velocidade após 3 s partindo do repouso?',
    2,
    'v = g·t = 10·3 = 30 m/s.',
    ['10 m/s', '20 m/s', '30 m/s', '40 m/s', '50 m/s'].map((text, i) => ({
      text,
      isCorrect: abcde(2)(i),
    })),
  );

  await prisma.simulationTemplate.upsert({
    where: { id: 'seed-template-full' },
    update: { questionCount: 6 },
    create: {
      id: 'seed-template-full',
      name: 'Simulado completo (demonstração)',
      scope: 'FULL',
      questionCount: 6,
      timeLimitMin: 330,
    },
  });
  await prisma.simulationTemplate.upsert({
    where: { id: 'seed-template-math' },
    update: { questionCount: 4, subjectId: math.id },
    create: {
      id: 'seed-template-math',
      name: 'Simulado de Matemática (demonstração)',
      scope: 'AREA',
      subjectId: math.id,
      questionCount: 4,
      timeLimitMin: 60,
    },
  });

  // Tema de redação (Fase 2).
  await prisma.essayPrompt.upsert({
    where: { id: 'seed-essay-tecnologia' },
    update: {},
    create: {
      id: 'seed-essay-tecnologia',
      title: 'Tecnologia e sociedade',
      theme:
        'Desafios para o uso consciente da tecnologia na sociedade brasileira',
      instructions:
        'Redija um texto dissertativo-argumentativo, respeitando a norma-padrão ' +
        'da língua portuguesa, com proposta de intervenção que respeite os direitos humanos.',
      year: 2023,
    },
  });

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
