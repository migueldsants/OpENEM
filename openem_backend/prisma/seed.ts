import { PrismaClient } from '@prisma/client';
import { seedFormulas } from './seed-formulas-lib';
import { invalidateCatalogCache } from '../src/cache/catalog-invalidation';
import { TAXONOMY } from '../src/common/taxonomy';
import { recomputeTopicWeights } from '../src/tracks/topic-weights';

const prisma = new PrismaClient();

/**
 * Seed de demonstração (Fase 1).
 * Conteúdo real (provas oficiais + autorais) será curado depois — ver docs/PRD.md §17.
 */

async function main() {
  // Área → Matéria → Tópicos (idempotente; upsert por chaves únicas).
  const subjectByName = new Map<string, string>();
  for (const [areaName, subjects] of Object.entries(TAXONOMY)) {
    const area = await prisma.subjectArea.upsert({
      where: { name: areaName },
      update: {},
      create: { name: areaName },
    });
    for (const [subjectName, topics] of Object.entries(subjects)) {
      const subject = await prisma.subject.upsert({
        where: { name: subjectName },
        update: { subjectAreaId: area.id },
        create: { name: subjectName, subjectAreaId: area.id },
      });
      subjectByName.set(subjectName, subject.id);
      for (const [topicName, weight] of topics) {
        await prisma.topic.upsert({
          where: { subjectId_name: { subjectId: subject.id, name: topicName } },
          update: { weight },
          create: { subjectId: subject.id, name: topicName, weight },
        });
      }
    }
  }
  // Remove áreas que saíram da taxonomia (ex.: "Redação" migrou para Linguagens),
  // mas nunca uma que ainda tenha questões: apagar a área derruba matérias e
  // assuntos em cascata e zeraria a classificação do banco oficial. Um rename na
  // TAXONOMY não pode custar o conteúdo — se sobrar alguma, o aviso diz qual.
  const obsoletas = await prisma.subjectArea.findMany({
    where: { name: { notIn: Object.keys(TAXONOMY) } },
    select: {
      id: true,
      name: true,
      _count: { select: { questions: true, subjects: true } },
    },
  });
  for (const area of obsoletas) {
    const questoesEmAssuntos = await prisma.question.count({
      where: { topic: { subject: { subjectAreaId: area.id } } },
    });
    const total = area._count.questions + questoesEmAssuntos;
    if (total > 0) {
      console.warn(
        `[seed] área "${area.name}" saiu da taxonomia mas tem ${total} questão(ões) — mantida. Migre o conteúdo antes de removê-la.`,
      );
      continue;
    }
    await prisma.subjectArea.delete({ where: { id: area.id } });
  }

  // Conteúdo de demonstração (6 questões + 2 simulados), usado pela suíte
  // e2e. Fora dela o banco de questões é o das provas oficiais do ENEM
  // (`npm run db:import:enem`) — ligue com SEED_DEMO=1 se precisar.
  if (process.env.SEED_DEMO === '1') {
    const math = await prisma.subject.findUniqueOrThrow({
      where: { name: 'Matemática' },
    });

    // Identificada por slug, não por ano: a reaplicação de 2023 também é 2023.
    // O slug da prova regular é o próprio ano, então o importador adota este
    // registro em vez de criar um duplicado.
    const examYear = await prisma.examYear.upsert({
      where: { slug: '2023' },
      update: {},
      create: { slug: '2023', year: 2023, label: 'ENEM 2023' },
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
      subjectAreaId: string,
      statement: string,
      difficulty: number,
      explanation: string,
      alternatives: { text: string; isCorrect: boolean }[],
    ) {
      const existing = await prisma.question.findFirst({
        where: { statement },
      });
      if (existing) return;
      await prisma.question.create({
        data: {
          statement,
          difficulty,
          explanation,
          explanationSource: 'seed',
          topicId,
          subjectAreaId,
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
    const fisica = await prisma.subject.findUniqueOrThrow({
      where: { name: 'Física' },
    });
    const cinematica = await ensureTopic(fisica.id, 'Cinemática');

    const abcde = (correct: number) => (i: number) => i === correct;

    await ensureQuestion(
      funcoes.id,
      math.subjectAreaId,
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
      math.subjectAreaId,
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
      math.subjectAreaId,
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
      math.subjectAreaId,
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
      fisica.subjectAreaId,
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
      fisica.subjectAreaId,
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
  }

  // Template para simulados personalizados (issue #40): os filtros vêm por DTO
  // no start; o template só carrega o nome/rótulo do histórico.
  await prisma.simulationTemplate.upsert({
    where: { id: 'seed-template-custom' },
    update: { scope: 'CUSTOM' },
    create: {
      id: 'seed-template-custom',
      name: 'Personalizado',
      scope: 'CUSTOM',
      questionCount: 10,
    },
  });

  // Um simulado por área do conhecimento: 45 questões em 1h30, que é o ritmo
  // de um bloco do caderno oficial. Filtra por ÁREA (e não por matéria) de
  // propósito — é o recorte que alcança as questões oficiais que ainda não
  // foram classificadas em matéria/assunto.
  const AREA_SIMULADOS: [string, string][] = [
    ['linguagens', 'Linguagens, Códigos e suas Tecnologias'],
    ['humanas', 'Ciências Humanas e suas Tecnologias'],
    ['natureza', 'Ciências da Natureza e suas Tecnologias'],
    ['matematica', 'Matemática e suas Tecnologias'],
  ];
  for (const [slug, areaName] of AREA_SIMULADOS) {
    const area = await prisma.subjectArea.findUnique({
      where: { name: areaName },
      select: { id: true },
    });
    if (!area) continue;
    const id = `seed-template-area-${slug}`;
    const dados = {
      name: `Simulado de ${areaName.replace(' e suas Tecnologias', '')}`,
      scope: 'AREA',
      subjectAreaId: area.id,
      questionCount: 45,
      timeLimitMin: 90,
      archived: false,
    };
    await prisma.simulationTemplate.upsert({
      where: { id },
      update: dados,
      create: { id, ...dados },
    });
  }

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

  // Temas oficiais do ENEM (regular e PPL). Instrução padrão da prova.
  const INSTRUCOES_ENEM =
    'A partir da leitura dos textos motivadores e com base nos conhecimentos ' +
    'construídos ao longo de sua formação, redija um texto dissertativo-argumentativo ' +
    'em modalidade escrita formal da língua portuguesa sobre o tema, apresentando ' +
    'proposta de intervenção que respeite os direitos humanos. Selecione, organize e ' +
    'relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.';

  // [id, título, tema, ano]
  const temasEnem: [string, string, string, number][] = [
    [
      'enem-2025',
      'ENEM 2025',
      'Perspectivas acerca do envelhecimento na sociedade brasileira',
      2025,
    ],
    [
      'enem-2024',
      'ENEM 2024',
      'Desafios para a valorização da herança africana no Brasil',
      2024,
    ],
    [
      'enem-2023',
      'ENEM 2023',
      'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil',
      2023,
    ],
    [
      'enem-2022',
      'ENEM 2022',
      'Desafios para a valorização de comunidades e povos tradicionais no Brasil',
      2022,
    ],
    [
      'enem-2021',
      'ENEM 2021',
      'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil',
      2021,
    ],
    [
      'enem-2020-impresso',
      'ENEM 2020 (impresso)',
      'O estigma associado às doenças mentais na sociedade brasileira',
      2020,
    ],
    [
      'enem-2020-digital',
      'ENEM 2020 (digital)',
      'O desafio de reduzir as desigualdades entre as regiões do Brasil',
      2020,
    ],
    [
      'enem-2019',
      'ENEM 2019',
      'Democratização do acesso ao cinema no Brasil',
      2019,
    ],
    [
      'enem-2018',
      'ENEM 2018',
      'Manipulação do comportamento do usuário pelo controle de dados na Internet',
      2018,
    ],
    [
      'enem-2017',
      'ENEM 2017',
      'Desafios para a formação educacional de surdos no Brasil',
      2017,
    ],
    [
      'enem-2016',
      'ENEM 2016',
      'Caminhos para combater a intolerância religiosa no Brasil',
      2016,
    ],
    [
      'enem-2015',
      'ENEM 2015',
      'A persistência da violência contra a mulher na sociedade brasileira',
      2015,
    ],
    [
      'enem-2014',
      'ENEM 2014',
      'Publicidade infantil em questão no Brasil',
      2014,
    ],
    [
      'enem-2013',
      'ENEM 2013',
      'Efeitos da implantação da Lei Seca no Brasil',
      2013,
    ],
    [
      'enem-2012',
      'ENEM 2012',
      'Movimento imigratório para o Brasil no século 21',
      2012,
    ],
    [
      'enem-2011',
      'ENEM 2011',
      'Viver em rede no século XXI: os limites entre o público e o privado',
      2011,
    ],
    [
      'enem-2010',
      'ENEM 2010',
      'O trabalho na construção da dignidade humana',
      2010,
    ],
    ['enem-2009', 'ENEM 2009', 'O indivíduo frente à ética nacional', 2009],
    // PPL (Pessoas Privadas de Liberdade)
    [
      'enem-ppl-2024',
      'ENEM PPL 2024',
      'Desafios para a valorização da arte de periferia no cenário cultural brasileiro',
      2024,
    ],
    [
      'enem-ppl-2023',
      'ENEM PPL 2023',
      'Desafios para a (re)inserção socioeconômica da população em situação de rua no Brasil',
      2023,
    ],
    [
      'enem-ppl-2022',
      'ENEM PPL 2022',
      'Medidas para o enfrentamento da recorrência da insegurança alimentar no Brasil',
      2022,
    ],
    [
      'enem-ppl-2021',
      'ENEM PPL 2021',
      'Reconhecimento da contribuição das mulheres nas ciências da saúde no Brasil',
      2021,
    ],
    [
      'enem-ppl-2020',
      'ENEM PPL 2020',
      'A falta de empatia nas relações sociais no Brasil',
      2020,
    ],
    [
      'enem-ppl-2019',
      'ENEM PPL 2019',
      'Combate ao uso indiscriminado das tecnologias digitais de informação por crianças',
      2019,
    ],
    [
      'enem-ppl-2018',
      'ENEM PPL 2018',
      'Formas de organização da sociedade para o enfrentamento de problemas econômicos no Brasil',
      2018,
    ],
    [
      'enem-ppl-2017',
      'ENEM PPL 2017',
      'Consequências da busca por padrões de beleza idealizados',
      2017,
    ],
    [
      'enem-ppl-2016',
      'ENEM PPL 2016',
      'Alternativas para a diminuição do desperdício de alimentos no Brasil',
      2016,
    ],
    [
      'enem-ppl-2015',
      'ENEM PPL 2015',
      'O histórico desafio de se valorizar o professor',
      2015,
    ],
    [
      'enem-ppl-2014',
      'ENEM PPL 2014',
      'O que o fenômeno social dos "rolezinhos" representa?',
      2014,
    ],
    [
      'enem-ppl-2013',
      'ENEM PPL 2013',
      'Cooperativismo como alternativa social',
      2013,
    ],
    ['enem-ppl-2012', 'ENEM PPL 2012', 'O grupo fortalece o indivíduo?', 2012],
    ['enem-ppl-2011', 'ENEM PPL 2011', 'Cultura e mudança social', 2011],
    ['enem-ppl-2010', 'ENEM PPL 2010', 'Ajuda humanitária', 2010],
    [
      'enem-ppl-2009',
      'ENEM PPL 2009',
      'A família contemporânea e o que ela representa para a sociedade',
      2009,
    ],
  ];

  for (const [id, title, theme, year] of temasEnem) {
    await prisma.essayPrompt.upsert({
      where: { id },
      update: { title, theme, instructions: INSTRUCOES_ENEM, year },
      create: { id, title, theme, instructions: INSTRUCOES_ENEM, year },
    });
  }

  // Fórmulas essenciais (issue #38) — catálogo compartilhado com o
  // seed-formulas.ts (executável isolado). Semeia por upsert, idempotente.
  await seedFormulas(prisma);

  console.log(`Seed concluído. (${temasEnem.length} temas ENEM)`);
  // O upsert acima devolve o peso curado; com provas oficiais no banco, o
  // peso volta a sair da incidência (sem elas, nada muda).
  await recomputeTopicWeights(prisma);
  // Matérias, assuntos e questões de exemplo: o catálogo em cache fica velho.
  await invalidateCatalogCache();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
