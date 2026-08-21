import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ícone por área (para o grid "Decks Prontos").
const AREA_ICON: Record<string, string> = {
  'Matemática e suas Tecnologias': '🧮',
  'Ciências da Natureza e suas Tecnologias': '🧪',
  'Ciências Humanas e suas Tecnologias': '📜',
  'Linguagens, Códigos e suas Tecnologias': '📖',
  'Redação': '✍️',
};

// Peso Pareto por tópico (5 = alta incidência no ENEM).
const TOPIC_WEIGHT: Record<string, number> = {
  'Funções': 5, 'Probabilidade': 5, 'Estatística': 5, 'Cinemática': 4,
  'Genética': 5, 'Ecologia': 4, 'Química Orgânica': 5, 'Redação': 5,
  'Geometria Plana': 4, 'Geometria Espacial': 4, 'Trigonometria': 4,
  'Análise Combinatória': 5, 'História do Brasil': 5, 'Geopolítica': 4,
  'Literatura': 4, 'Biologia Celular': 4, 'Física Quântica': 3,
};

interface SeedDeck {
  title: string;
  description: string;
  subject: string;
  topic?: string;
  icon: string;
  cards: [front: string, back: string][];
}

async function seedDeck(deck: SeedDeck) {
  const existing = await prisma.flashcardDeck.findFirst({
    where: { title: deck.title },
  });
  if (existing) return;

  await prisma.flashcardDeck.create({
    data: {
      title: deck.title,
      description: deck.description,
      subject: deck.subject,
      topic: deck.topic,
      icon: deck.icon,
      isPublic: true,
      flashcards: {
        create: deck.cards.map(([front, back], i) => ({ front, back, order: i })),
      },
    },
  });
  console.log(`  ✔ ${deck.title}`);
}

const NATURE = 'Ciências da Natureza e suas Tecnologias';
const HUMAN = 'Ciências Humanas e suas Tecnologias';
const MATH = 'Matemática e suas Tecnologias';
const LANG = 'Linguagens, Códigos e suas Tecnologias';
const ESSAY = 'Redação';

const decks: SeedDeck[] = [
  // ---- Matemática ----
  {
    title: 'Análise Combinatória e Probabilidade',
    description: 'Arranjos, combinações, permutação e probabilidade essenciais para o ENEM.',
    subject: MATH, topic: 'Análise Combinatória', icon: AREA_ICON[MATH],
    cards: [
      ['Qual pergunta-chave decide entre **Arranjo** e **Combinação**?',
       '**"A ordem dos elementos importa?"**\n\n- **SIM** → Arranjo (senhas, pódio)\n- **NÃO** → Combinação (grupos, comissões)'],
      ['Qual a fórmula de **Combinação Simples**?',
       '$$C_{n,p} = \\frac{n!}{p!(n-p)!}$$\n\nO $p!$ "cancela" as permutações internas do grupo.'],
      ['O que diz o **Princípio Fundamental da Contagem**?',
       'Se um evento ocorre em $k$ etapas independentes: $n_1 \\times n_2 \\times \\dots \\times n_k$ possibilidades.\n\nBase: "escolhas sucessivas" → multiplicar opções.'],
      ['Quantos anagramas tem a palavra "PROVA"?',
       'Todas as letras são distintas: $P_5 = 5! = 120$.'],
    ],
  },
  {
    title: 'Funções Essenciais',
    description: 'Função afim, quadrática, exponencial e logarítmica — o núcleo de Matemática no ENEM.',
    subject: MATH, topic: 'Funções', icon: AREA_ICON[MATH],
    cards: [
      ['Qual a forma canônica da **função quadrática** e seu vértice?',
       '$f(x) = ax^2 + bx + c$\n\nVértice: $x_v = -\\frac{b}{2a}$, $y_v = -\\frac{\\Delta}{4a}$'],
      ['Quando uma **função exponencial** é crescente ou decrescente?',
       '$y = a^x$\n\n- Crescente: $a > 1$\n- Decrescente: $0 < a < 1$'],
      ['Qual o logaritmo de base 10 de 1000?',
       '$\\log_{10}(1000) = \\log_{10}(10^3) = 3$\n\n(log₁₀ só "descido" $10^3$)'],
      ['Qual a diferença entre função afim e função linear?',
       'Afim: $f(x) = ax + b$, $b \\neq 0$ (desloca)\nLinear: $f(x) = ax$, passa pela origem $(0,0)$'],
    ],
  },
  // ---- Ciências da Natureza ----
  {
    title: 'Cinemática — MRU e MRUV',
    description: 'Velocidade média, aceleração e equações horárias.',
    subject: NATURE, topic: 'Cinemática', icon: AREA_ICON[NATURE],
    cards: [
      ['Qual a equação da **velocidade média**?',
       '$v_m = \\frac{\\Delta s}{\\Delta t}$\n\nEm unidades SI: m/s'],
      ['Qual a função horária do **MRU**?',
       '$s = s_0 + vt$\n\nVelocidade constante, aceleração nula.'],
      ['Qual a função horária do **MRUV**?',
       '$s = s_0 + v_0t + \\frac{1}{2}at^2$\n\nAceleração constante, ≠ 0.'],
      ['Qual a equação de **Torricelli** e quando usá-la?',
       '$v^2 = v_0^2 + 2a\\Delta s$\n\nUse quando o **tempo não é conhecido** no MRUV.'],
    ],
  },
  {
    title: 'Biologia Celular — Organelas',
    description: 'Funções das principais organelas celulares.',
    subject: NATURE, topic: 'Biologia Celular', icon: AREA_ICON[NATURE],
    cards: [
      ['Qual a função do **Complexo de Golgi**?',
       'Modificação, empacotamento e secreção de proteínas; forma o acrossomo do espermatozoide.'],
      ['Qual a função dos **Lisossomos**?',
       'Digestão intracelular (autofagia e heterofagia) com enzimas hidrolíticas.'],
      ['Qual a diferença entre **respiração aeróbica e anaeróbica**?',
       'Aeróbica: O₂ → CO₂ + H₂O + 38 ATP\nAnaeróbica (fermentação): sem O₂, 2 ATP'],
      ['O que é o **transporte ativo** na membrana?',
       'Gasto de ATP, **contra o gradiente**, por proteínas-bomba (ex: bomba Na⁺/K⁺).'],
    ],
  },
  {
    title: 'Química Orgânica — Funções',
    description: 'Funções orgânicas e reconhecimento de grupos.',
    subject: NATURE, topic: 'Química Orgânica', icon: AREA_ICON[NATURE],
    cards: [
      ['Qual o sufixo de um **Álcool**?',
       '-ol (ex: etanol)\n\nGrupo: $R-OH$'],
      ['Qual a diferença entre **Aldeído** e $Cetona$?',
       'Aldeído: C=O na extremidade, $R-CHO$\nCetona: C=O interno, $R-CO-R\'$'],
      ['O que caracteriza um **Éter**?',
       'Grupo $R-O-R\'$ (oxigênio ligando dois carbonos).'],
      ['O que é uma **função ácido carboxílico**?',
       'Grupo $-COOH$: carbonila + hidroxila no mesmo carbono.\n\nÁcidos orgânicos fracos.'],
    ],
  },
  // ---- Ciências Humanas ----
  {
    title: 'Brasil — República Velha',
    description: 'Período 1889-1930: coronelismo, política do café-com-leite.',
    subject: HUMAN, topic: 'História do Brasil', icon: AREA_ICON[HUMAN],
    cards: [
      ['O que foi a **Política do Café-com-leite**?',
       'Aliança entre oligarcas de SP (café) e MG (leite) para alternar a presidência.'],
      ['O que foi o **Coronelismo**?',
       'Poder político local baseado na troca de favores e no voto de cabresto.'],
      ['O que foi o **Período Regencial**?',
       '1831-1840: após abdicação de Pedro I, antes da maioridade de Pedro II.'],
    ],
  },
  {
    title: 'Geografia — Agrária',
    description: 'Questão fundiária, agricultura e conflitos no campo.',
    subject: HUMAN, topic: 'Geografia Agrária', icon: AREA_ICON[HUMAN],
    cards: [
      ['O que são **latifúndio** e **minifúndio**?',
       'Latifúndio: grande propriedade monocultora, exportadora.\nMinifúndio: pequena propriedade, subsistência.'],
      ['O que foi a **Reforma Agrária** no Brasil?',
       'Redistribuição de terras, mas sem profundidade real — muitos assentamentos sem infraestrutura.'],
    ],
  },
  // ---- Linguagens ----
  {
    title: 'Literatura — Modernismo',
    description: 'Semana de 1922 e gerações modernistas.',
    subject: LANG, topic: 'Literatura', icon: AREA_ICON[LANG],
    cards: [
      ['O que foi a **Semana de Arte Moderna de 1922**?',
       'Marco do Modernismo brasileiro: ruptura com o academicismo, valorização da cultura nacional.'],
      ['O que caracteriza a **poesia modernista**?',
       'Verso livre, linguagem coloquial, temas nacional-identitários (ex: Manuel Bandeira, Carlos Drummond).'],
      ['Quais os **principais expoentes do Modernismo**?',
       'Mário de Andrade, Oswald de Andrade, Manuel Bandeira, Carlos Drummond de Andrade.'],
    ],
  },
  // ---- Redação ----
  {
    title: 'Competências da Redação ENEM',
    description: 'O que cada competência avalia e como atingir a nota máxima.',
    subject: ESSAY, icon: AREA_ICON[ESSAY],
    cards: [
      ['Qual a **estrutura dissertativa-argumentativa**?',
       '1. Introdução (tese clara)\n2. Desenvolvimento (argumentos + repertório)\n3. Conclusão (retomada + proposta de intervenção)'],
      ['O que é **competência 5** (intervenção)?',
       'Proposta de intervenção respeitando direitos humanos, com agente, ação, meio, finalidade e detalhamento.'],
      ['O que é uma **proposta de intervenção detalhada**?',
       'Responder: Quem faz? O quê? Como? Para quê? Com qual efeito esperado?'],
    ],
  },
];

async function main() {
  console.log('🌱 Semeando flashcards (seed-flashcards)...');
  for (const deck of decks) {
    await seedDeck(deck);
  }
  const total = await prisma.flashcard.count();
  console.log(`Total: ${total} flashcards em ${await prisma.flashcardDeck.count()} decks.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
