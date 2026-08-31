import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed de demonstração (Fase 1).
 * Conteúdo real (provas oficiais + autorais) será curado depois — ver docs/PRD.md §17.
 */
/**
 * Taxonomia canônica: Área do conhecimento → Matéria → Tópicos com peso Pareto
 * (weight 1..5, espelhando a incidência relativa no ENEM).
 */
const TAXONOMY: Record<string, Record<string, [string, number][]>> = {
  'Ciências Humanas e suas Tecnologias': {
    Filosofia: [
      ['Política', 4], ['Ética', 4], ['Epistemologia', 3], ['Filosofia antiga', 3],
      ['Filosofia contemporânea', 3], ['Filosofia moderna', 3], ['Estética', 2],
      ['Filosofia medieval', 2],
    ],
    Geografia: [
      ['Meio ambiente', 5], ['Urbanização', 5], ['Agricultura', 4], ['Biomas', 4],
      ['Clima', 4], ['Energia', 4], ['Geopolítica', 4], ['Globalização', 4],
      ['Indústria', 4], ['População', 4], ['Regionalização do Brasil', 4],
      ['Cartografia', 3], ['Hidrografia', 3], ['Migrações', 3], ['Relevo', 3],
    ],
    História: [
      ['Ditadura militar', 5], ['Escravidão no Brasil', 5], ['Brasil Colônia', 4],
      ['Brasil Império', 4], ['Era Vargas', 4], ['Independência do Brasil', 4],
      ['Movimentos sociais', 4], ['Redemocratização', 4], ['República Velha', 4],
      ['Revolução Francesa', 4], ['Revolução Industrial', 4], ['Antiguidade', 3],
      ['Guerra Fria', 3], ['Guerras mundiais', 3], ['História da África', 3],
      ['Idade Moderna', 3], ['Idade Média', 3], ['Iluminismo', 3], ['Século XX', 3],
      ['Pré-história', 2],
    ],
    Sociologia: [
      ['Desigualdade social', 5], ['Cidadania', 4], ['Cultura', 4],
      ['Movimentos sociais', 4], ['Trabalho', 4], ['Estado e poder', 3],
      ['Globalização e sociedade', 3], ['Indústria cultural', 3],
    ],
  },
  'Ciências da Natureza e suas Tecnologias': {
    Biologia: [
      ['Ecologia', 5], ['Genética', 5], ['Citologia', 4], ['Evolução', 4],
      ['Fisiologia humana', 4], ['Saúde e doenças', 4], ['Bioquímica celular', 3],
      ['Biotecnologia', 3], ['Botânica', 3], ['Ciclos biogeoquímicos', 3],
      ['Imunologia', 3], ['Metabolismo energético', 3], ['Microbiologia', 3],
      ['Reprodução', 3], ['Sistema circulatório', 3], ['Sistema digestório', 3],
      ['Sistema endócrino', 3], ['Sistema nervoso', 3], ['Sistema respiratório', 3],
      ['Zoologia', 3],
    ],
    Física: [
      ['Cinemática', 5], ['Eletrodinâmica', 5], ['Leis de Newton', 5],
      ['Calorimetria', 4], ['Circuitos elétricos', 4], ['Eletrostática', 4],
      ['Energia e potência', 4], ['Ondas', 4], ['Termologia', 4],
      ['Trabalho e energia', 4], ['Óptica geométrica', 4], ['Acústica', 3],
      ['Eletromagnetismo', 3], ['Gravitação', 3], ['Hidrostática', 3],
      ['Impulso e quantidade de movimento', 3], ['Magnetismo', 3],
      ['Termodinâmica', 3], ['Física moderna', 2], ['Radioatividade', 2],
    ],
    Química: [
      ['Estequiometria', 5], ['Química orgânica', 5], ['Equilíbrio químico', 4],
      ['Estrutura atômica', 4], ['Funções inorgânicas', 4], ['Funções orgânicas', 4],
      ['Hidrocarbonetos', 4], ['Ligações químicas', 4], ['Reações químicas', 4],
      ['Soluções', 4], ['Tabela periódica', 4], ['Bioquímica', 3],
      ['Cinética química', 3], ['Eletroquímica', 3], ['Isomeria', 3],
      ['Polímeros', 3], ['Propriedades da matéria', 3], ['Separação de misturas', 3],
      ['Termoquímica', 3], ['Radioatividade', 2],
    ],
  },
  'Linguagens, Códigos e suas Tecnologias': {
    Artes: [
      ['Arte brasileira', 3], ['História da arte', 3], ['Movimentos artísticos', 3],
      ['Música e dança', 2], ['Teatro e cinema', 2],
    ],
    'Educação Física': [
      ['Atividade física e qualidade de vida', 3], ['Corpo e saúde', 3],
      ['Esportes', 3], ['Jogos e brincadeiras', 2], ['Lutas e danças', 2],
    ],
    Literatura: [
      ['Modernismo', 5], ['Realismo e Naturalismo', 4], ['Romantismo', 4],
      ['Arcadismo', 3], ['Barroco', 3], ['Literatura contemporânea', 3],
      ['Parnasianismo e Simbolismo', 3], ['Quinhentismo', 2],
    ],
    'Língua Estrangeira': [
      ['Interpretação de texto em espanhol', 4], ['Interpretação de texto em inglês', 4],
      ['Leitura e compreensão', 4], ['Gêneros textuais estrangeiros', 3],
      ['Vocabulário e expressões', 3],
    ],
    'Língua Portuguesa': [
      ['Interpretação de texto', 5], ['Coesão e coerência', 4], ['Concordância', 4],
      ['Figuras de linguagem', 4], ['Gêneros textuais', 4], ['Sintaxe', 4],
      ['Tipologia textual', 4], ['Variação linguística', 4], ['Funções da linguagem', 3],
      ['Intertextualidade', 3], ['Morfologia', 3], ['Ortografia', 3],
      ['Pontuação', 3], ['Regência', 3], ['Semântica', 3],
    ],
    // Redação é avaliada junto de Linguagens no 1º dia — fica dentro desta área.
    Redação: [
      ['Argumentação', 5], ['Estrutura dissertativa', 5], ['Proposta de intervenção', 5],
      ['Coesão e coerência', 4], ['Repertório sociocultural', 4],
    ],
  },
  'Matemática e suas Tecnologias': {
    Matemática: [
      ['Estatística', 5], ['Funções', 5], ['Geometria plana', 5],
      ['Interpretação de gráficos', 5], ['Porcentagem', 5], ['Probabilidade', 5],
      ['Razão e proporção', 5], ['Regra de três', 5], ['Análise combinatória', 4],
      ['Equações do 1º grau', 4], ['Equações do 2º grau', 4], ['Função afim', 4],
      ['Função quadrática', 4], ['Geometria espacial', 4],
      ['Juros simples e compostos', 4], ['Média, mediana e moda', 4],
      ['Sistemas de equações', 4], ['Trigonometria', 4], ['Áreas e perímetros', 4],
      ['Conjuntos numéricos', 3], ['Função exponencial', 3], ['Função logarítmica', 3],
      ['Geometria analítica', 3], ['Operações e propriedades', 3],
      ['Progressão aritmética', 3], ['Progressão geométrica', 3], ['Volumes', 3],
      ['Matrizes e determinantes', 2], ['Polinômios', 2], ['Números complexos', 1],
    ],
  },
};

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
  // Remove áreas que saíram da taxonomia (ex.: "Redação" migrou para Linguagens).
  await prisma.subjectArea.deleteMany({
    where: { name: { notIn: Object.keys(TAXONOMY) } },
  });

  const math = await prisma.subject.findUniqueOrThrow({
    where: { name: 'Matemática' },
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
  const fisica = await prisma.subject.findUniqueOrThrow({
    where: { name: 'Física' },
  });
  const cinematica = await ensureTopic(fisica.id, 'Cinemática');

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
  // Template para simulados personalizados (issue #40): matéria/tópico e
  // contagem vêm por DTO no start; o template só carrega o nome/rótulo.
  await prisma.simulationTemplate.upsert({
    where: { id: 'seed-template-custom' },
    update: {},
    create: {
      id: 'seed-template-custom',
      name: 'Personalizado',
      scope: 'FULL',
      questionCount: 10,
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

  // Temas oficiais do ENEM (regular e PPL). Instrução padrão da prova.
  const INSTRUCOES_ENEM =
    'A partir da leitura dos textos motivadores e com base nos conhecimentos ' +
    'construídos ao longo de sua formação, redija um texto dissertativo-argumentativo ' +
    'em modalidade escrita formal da língua portuguesa sobre o tema, apresentando ' +
    'proposta de intervenção que respeite os direitos humanos. Selecione, organize e ' +
    'relacione, de forma coerente e coesa, argumentos e fatos para defesa de seu ponto de vista.';

  // [id, título, tema, ano]
  const temasEnem: [string, string, string, number][] = [
    ['enem-2025', 'ENEM 2025', 'Perspectivas acerca do envelhecimento na sociedade brasileira', 2025],
    ['enem-2024', 'ENEM 2024', 'Desafios para a valorização da herança africana no Brasil', 2024],
    ['enem-2023', 'ENEM 2023', 'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil', 2023],
    ['enem-2022', 'ENEM 2022', 'Desafios para a valorização de comunidades e povos tradicionais no Brasil', 2022],
    ['enem-2021', 'ENEM 2021', 'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil', 2021],
    ['enem-2020-impresso', 'ENEM 2020 (impresso)', 'O estigma associado às doenças mentais na sociedade brasileira', 2020],
    ['enem-2020-digital', 'ENEM 2020 (digital)', 'O desafio de reduzir as desigualdades entre as regiões do Brasil', 2020],
    ['enem-2019', 'ENEM 2019', 'Democratização do acesso ao cinema no Brasil', 2019],
    ['enem-2018', 'ENEM 2018', 'Manipulação do comportamento do usuário pelo controle de dados na Internet', 2018],
    ['enem-2017', 'ENEM 2017', 'Desafios para a formação educacional de surdos no Brasil', 2017],
    ['enem-2016', 'ENEM 2016', 'Caminhos para combater a intolerância religiosa no Brasil', 2016],
    ['enem-2015', 'ENEM 2015', 'A persistência da violência contra a mulher na sociedade brasileira', 2015],
    ['enem-2014', 'ENEM 2014', 'Publicidade infantil em questão no Brasil', 2014],
    ['enem-2013', 'ENEM 2013', 'Efeitos da implantação da Lei Seca no Brasil', 2013],
    ['enem-2012', 'ENEM 2012', 'Movimento imigratório para o Brasil no século 21', 2012],
    ['enem-2011', 'ENEM 2011', 'Viver em rede no século XXI: os limites entre o público e o privado', 2011],
    ['enem-2010', 'ENEM 2010', 'O trabalho na construção da dignidade humana', 2010],
    ['enem-2009', 'ENEM 2009', 'O indivíduo frente à ética nacional', 2009],
    // PPL (Pessoas Privadas de Liberdade)
    ['enem-ppl-2024', 'ENEM PPL 2024', 'Desafios para a valorização da arte de periferia no cenário cultural brasileiro', 2024],
    ['enem-ppl-2023', 'ENEM PPL 2023', 'Desafios para a (re)inserção socioeconômica da população em situação de rua no Brasil', 2023],
    ['enem-ppl-2022', 'ENEM PPL 2022', 'Medidas para o enfrentamento da recorrência da insegurança alimentar no Brasil', 2022],
    ['enem-ppl-2021', 'ENEM PPL 2021', 'Reconhecimento da contribuição das mulheres nas ciências da saúde no Brasil', 2021],
    ['enem-ppl-2020', 'ENEM PPL 2020', 'A falta de empatia nas relações sociais no Brasil', 2020],
    ['enem-ppl-2019', 'ENEM PPL 2019', 'Combate ao uso indiscriminado das tecnologias digitais de informação por crianças', 2019],
    ['enem-ppl-2018', 'ENEM PPL 2018', 'Formas de organização da sociedade para o enfrentamento de problemas econômicos no Brasil', 2018],
    ['enem-ppl-2017', 'ENEM PPL 2017', 'Consequências da busca por padrões de beleza idealizados', 2017],
    ['enem-ppl-2016', 'ENEM PPL 2016', 'Alternativas para a diminuição do desperdício de alimentos no Brasil', 2016],
    ['enem-ppl-2015', 'ENEM PPL 2015', 'O histórico desafio de se valorizar o professor', 2015],
    ['enem-ppl-2014', 'ENEM PPL 2014', 'O que o fenômeno social dos "rolezinhos" representa?', 2014],
    ['enem-ppl-2013', 'ENEM PPL 2013', 'Cooperativismo como alternativa social', 2013],
    ['enem-ppl-2012', 'ENEM PPL 2012', 'O grupo fortalece o indivíduo?', 2012],
    ['enem-ppl-2011', 'ENEM PPL 2011', 'Cultura e mudança social', 2011],
    ['enem-ppl-2010', 'ENEM PPL 2010', 'Ajuda humanitária', 2010],
    ['enem-ppl-2009', 'ENEM PPL 2009', 'A família contemporânea e o que ela representa para a sociedade', 2009],
  ];

  for (const [id, title, theme, year] of temasEnem) {
    await prisma.essayPrompt.upsert({
      where: { id },
      update: { title, theme, instructions: INSTRUCOES_ENEM, year },
      create: { id, title, theme, instructions: INSTRUCOES_ENEM, year },
    });
  }

  console.log(`Seed concluído. (${temasEnem.length} temas ENEM)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
