// Fórmulas essenciais (issue #38) — catálogo + seeding idempotente.
// Compartilhado entre prisma/seed.ts (db:seed) e prisma/seed-formulas.ts.
import type { PrismaClient } from '@prisma/client';

export interface FormulaSeed {
  subject: string; // nome canônico da matéria (da TAXONOMY do seed.ts)
  title: string;
  /**
   * Título que a fórmula tinha antes (ex.: quando um card com duas fórmulas
   * virou dois). O seed renomeia o registro antigo em vez de criar outro, e
   * assim o id e os favoritos dos alunos continuam valendo.
   */
  formerTitle?: string;
  latex: string;
  description?: string;
}

/** Uma linha da legenda: o que aquele símbolo representa e em que unidade. */
export interface FormulaSymbolSeed {
  /** Símbolo em LaTeX, do jeito que aparece na expressão. */
  symbol: string;
  meaning: string;
  /** Unidade no SI; omitida quando a grandeza é adimensional. */
  unit?: string;
}

export const FORMULAS: FormulaSeed[] = [
  // ---- Matemática ----
  {
    subject: 'Matemática',
    title: 'Equação do 2º grau (Bhaskara)',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    description: 'Raízes de ax² + bx + c = 0.',
  },
  {
    subject: 'Matemática',
    title: 'Delta (discriminante)',
    latex: '\\Delta = b^2 - 4ac',
    description: 'Δ > 0: duas raízes; Δ = 0: uma; Δ < 0: nenhuma real.',
  },
  {
    subject: 'Matemática',
    title: 'Soma das raízes',
    formerTitle: 'Soma e produto',
    latex: 'S = -\\frac{b}{a}',
    description: 'Das raízes de ax² + bx + c = 0.',
  },
  {
    subject: 'Matemática',
    title: 'Produto das raízes',
    latex: 'P = \\frac{c}{a}',
    description: 'Das raízes de ax² + bx + c = 0.',
  },
  {
    subject: 'Matemática',
    title: 'Variação percentual',
    latex: '\\Delta\\% = \\frac{V_f - V_i}{V_i} \\times 100\\%',
  },
  {
    subject: 'Matemática',
    title: 'Juros simples',
    latex: 'J = C \\cdot i \\cdot t',
  },
  {
    subject: 'Matemática',
    title: 'Montante (juros simples)',
    latex: 'M = C + J',
  },
  {
    subject: 'Matemática',
    title: 'Juros compostos',
    latex: 'M = C(1 + i)^t',
  },
  {
    subject: 'Matemática',
    title: 'Área do triângulo',
    latex: 'A = \\frac{b \\cdot h}{2}',
  },
  {
    subject: 'Matemática',
    title: 'Área do triângulo (lados)',
    latex: 'A = \\sqrt{p(p-a)(p-b)(p-c)}',
    description: 'Fórmula de Heron. p é o semiperímetro.',
  },
  {
    subject: 'Matemática',
    title: 'Semiperímetro',
    latex: 'p = \\frac{a+b+c}{2}',
    description: 'Usado na fórmula de Heron.',
  },
  {
    subject: 'Matemática',
    title: 'Teorema de Pitágoras',
    latex: 'a^2 = b^2 + c^2',
  },
  {
    subject: 'Matemática',
    title: 'Área do círculo',
    formerTitle: 'Círculo: área e circunferência',
    latex: 'A = \\pi r^2',
  },
  {
    subject: 'Matemática',
    title: 'Comprimento da circunferência',
    latex: 'C = 2\\pi r',
  },
  {
    subject: 'Matemática',
    title: 'Volume do cilindro',
    latex: 'V = \\pi r^2 h',
  },
  {
    subject: 'Matemática',
    title: 'Volume da esfera',
    latex: 'V = \\frac{4}{3}\\pi r^3',
  },
  {
    subject: 'Matemática',
    title: 'Seno',
    formerTitle: 'Seno e cosseno',
    latex: '\\sin\\theta = \\frac{co}{h}',
    description: 'Cateto oposto sobre a hipotenusa.',
  },
  {
    subject: 'Matemática',
    title: 'Cosseno',
    latex: '\\cos\\theta = \\frac{ca}{h}',
    description: 'Cateto adjacente sobre a hipotenusa.',
  },
  {
    subject: 'Matemática',
    title: 'Lei dos senos',
    latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}',
  },
  {
    subject: 'Matemática',
    title: 'PA: termo geral',
    formerTitle: 'PA — termo geral e soma',
    latex: 'a_n = a_1 + (n-1)r',
  },
  {
    subject: 'Matemática',
    title: 'PA: soma dos termos',
    latex: 'S_n = \\frac{(a_1 + a_n)n}{2}',
  },
  {
    subject: 'Matemática',
    title: 'PG: termo geral',
    formerTitle: 'PG — termo geral e soma',
    latex: 'a_n = a_1 \\cdot q^{n-1}',
  },
  {
    subject: 'Matemática',
    title: 'PG: soma dos termos',
    latex: 'S_n = \\frac{a_1(q^n - 1)}{q - 1}',
    description: 'Soma finita; vale para q ≠ 1.',
  },
  {
    subject: 'Matemática',
    title: 'Combinação',
    latex: 'C_{n,p} = \\frac{n!}{p!(n-p)!}',
  },
  {
    subject: 'Matemática',
    title: 'Probabilidade',
    latex: 'P(A) = \\frac{\\text{favoráveis}}{\\text{possíveis}}',
  },

  // ---- Física ----
  {
    subject: 'Física',
    title: 'Velocidade média',
    latex: '\\bar{v} = \\frac{\\Delta s}{\\Delta t}',
  },
  {
    subject: 'Física',
    title: 'Função horária (MRU)',
    latex: 's = s_0 + vt',
  },
  {
    subject: 'Física',
    title: 'Função horária da posição (MUV)',
    formerTitle: 'Funções horárias (MUV)',
    latex: 's = s_0 + v_0 t + \\frac{at^2}{2}',
  },
  {
    subject: 'Física',
    title: 'Função horária da velocidade (MUV)',
    latex: 'v = v_0 + at',
  },
  {
    subject: 'Física',
    title: 'Torricelli',
    latex: 'v^2 = v_0^2 + 2a\\Delta s',
  },
  {
    subject: 'Física',
    title: '2ª Lei de Newton',
    latex: '\\vec{F}_{r} = m\\vec{a}',
  },
  {
    subject: 'Física',
    title: 'Peso',
    latex: 'P = mg',
    description: 'Na Terra, g ≈ 10 m/s².',
  },
  {
    subject: 'Física',
    title: 'Trabalho',
    latex: '\\tau = Fd\\cos\\theta',
  },
  {
    subject: 'Física',
    title: 'Potência',
    latex: 'P = \\frac{E}{t}',
  },
  {
    subject: 'Física',
    title: 'Potência elétrica',
    latex: 'P_{\\text{el}} = Ui',
  },
  {
    subject: 'Física',
    title: 'Energia cinética',
    formerTitle: 'Energia cinética e potencial',
    latex: 'E_c = \\frac{mv^2}{2}',
  },
  {
    subject: 'Física',
    title: 'Energia potencial gravitacional',
    latex: 'E_p = mgh',
  },
  {
    subject: 'Física',
    title: 'Conservação de energia',
    latex: 'E_{\\text{mec}} = E_c + E_p = \\text{constante}',
  },
  {
    subject: 'Física',
    title: 'Quantidade de movimento',
    latex: 'Q = mv',
  },
  {
    subject: 'Física',
    title: '1ª Lei de Ohm',
    latex: 'U = Ri',
  },
  {
    subject: 'Física',
    title: 'Resistores em série',
    formerTitle: 'Resistência equivalente',
    latex: 'R_{\\text{eq}} = R_1 + R_2',
    description: 'Resistência equivalente de resistores em série.',
  },
  {
    subject: 'Física',
    title: 'Resistores em paralelo',
    latex: '\\frac{1}{R_{\\text{eq}}} = \\frac{1}{R_1} + \\frac{1}{R_2}',
    description: 'Resistência equivalente de resistores em paralelo.',
  },
  {
    subject: 'Física',
    title: 'Dilatação térmica linear',
    latex: '\\Delta L = L_0\\alpha\\Delta\\theta',
  },
  {
    subject: 'Física',
    title: 'Calor sensível',
    latex: 'Q = mc\\Delta\\theta',
  },
  {
    subject: 'Física',
    title: 'Calor latente',
    latex: 'Q = mL',
    description: 'Mudança de estado físico, com a temperatura constante.',
  },

  // ---- Química ----
  {
    subject: 'Química',
    title: 'Densidade',
    latex: 'd = \\frac{m}{V}',
  },
  {
    subject: 'Química',
    title: 'Concentração comum',
    latex: 'C = \\frac{m_{\\text{soluto}}}{V_{\\text{solução}}}',
  },
  {
    subject: 'Química',
    title: 'Concentração molar',
    latex: 'M = \\frac{n_{\\text{mol}}}{V(L)}',
  },
  {
    subject: 'Química',
    title: 'Título',
    latex: '\\tau = \\frac{m_{\\text{soluto}}}{m_{\\text{solução}}}',
  },
  {
    subject: 'Química',
    title: 'Número de mols (pela massa)',
    formerTitle: 'Número de mols',
    latex: 'n = \\frac{m}{M}',
  },
  {
    subject: 'Química',
    title: 'Número de mols (gás nas CNTP)',
    latex: 'n = \\frac{V}{22{,}4}',
    description: 'Para gases nas CNTP.',
  },
  {
    subject: 'Química',
    title: 'Constante de Avogadro',
    latex: 'N_A = 6{,}02 \\times 10^{23}',
  },
  {
    subject: 'Química',
    title: 'Rendimento de reação',
    latex: 'R\\% = \\frac{m_{\\text{obtida}}}{m_{\\text{teórica}}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Grau de ionização',
    latex: '\\alpha = \\frac{n_{\\text{ionizado}}}{n_{\\text{inicial}}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Celsius ↔ Kelvin',
    latex: 'T(K) = t(C) + 273',
  },

  // ---- Biologia ----
  {
    subject: 'Biologia',
    title: 'Hardy-Weinberg: alelos',
    formerTitle: 'Hardy-Weinberg',
    latex: 'p + q = 1',
  },
  {
    subject: 'Biologia',
    title: 'Hardy-Weinberg: genótipos',
    latex: 'p^2 + 2pq + q^2 = 1',
  },
  {
    subject: 'Biologia',
    title: 'Aumento total (microscópio)',
    latex: 'A = a_{\\text{ocular}} \\times a_{\\text{objetiva}}',
  },
  {
    subject: 'Biologia',
    title: 'Crescimento populacional',
    latex: '\\frac{\\Delta N}{N \\cdot \\Delta t}',
  },

  // ---- Redação (atalho de estrutura, não fórmula matemática) ----
  {
    subject: 'Redação',
    title: 'Estrutura da redação ENEM',
    latex:
      '\\text{introdução} \\to \\text{2 desenv.} \\to \\text{conclusão}',
    description:
      '4 a 5 linhas por parágrafo; proposta de intervenção com agente, ação, meio, finalidade e detalhamento.',
  },
];

/**
 * Legenda de cada fórmula (issue #38), indexada pelo título. Fica separada do
 * array acima para manter as entradas de fórmula legíveis — a chave é o mesmo
 * `title`, que é único no schema.
 */
export const FORMULA_SYMBOLS: Record<string, FormulaSymbolSeed[]> = {
  // ---- Matemática ----
  'Equação do 2º grau (Bhaskara)': [
    { symbol: 'x', meaning: 'raízes da equação (os valores que a satisfazem)' },
    {
      symbol: 'a',
      meaning: 'coeficiente de x² — precisa ser diferente de zero',
    },
    { symbol: 'b', meaning: 'coeficiente de x' },
    { symbol: 'c', meaning: 'termo independente' },
    { symbol: '\\pm', meaning: 'gera as duas raízes: uma com +, outra com −' },
  ],
  'Delta (discriminante)': [
    {
      symbol: '\\Delta',
      meaning: 'discriminante — diz quantas raízes reais existem',
    },
    { symbol: 'a, b, c', meaning: 'coeficientes de ax² + bx + c = 0' },
  ],
  'Soma das raízes': [
    { symbol: 'S', meaning: 'soma das duas raízes' },
    { symbol: 'a, b', meaning: 'coeficientes de ax² + bx + c = 0' },
  ],
  'Produto das raízes': [
    { symbol: 'P', meaning: 'produto das duas raízes' },
    { symbol: 'a, c', meaning: 'coeficientes de ax² + bx + c = 0' },
  ],
  'Variação percentual': [
    {
      symbol: '\\Delta\\%',
      meaning: 'variação percentual — negativa se houve queda',
      unit: '%',
    },
    { symbol: 'V_f', meaning: 'valor final' },
    { symbol: 'V_i', meaning: 'valor inicial' },
  ],
  'Juros simples': [
    { symbol: 'J', meaning: 'juros acumulados' },
    { symbol: 'C', meaning: 'capital inicial (o valor aplicado)' },
    { symbol: 'i', meaning: 'taxa por período, em decimal (5% = 0,05)' },
    { symbol: 't', meaning: 'tempo, na mesma unidade da taxa' },
  ],
  'Montante (juros simples)': [
    { symbol: 'M', meaning: 'montante: capital mais juros' },
    { symbol: 'C', meaning: 'capital inicial (o valor aplicado)' },
    { symbol: 'J', meaning: 'juros acumulados' },
  ],
  'Juros compostos': [
    { symbol: 'M', meaning: 'montante ao fim do período' },
    { symbol: 'C', meaning: 'capital inicial' },
    { symbol: 'i', meaning: 'taxa por período, em decimal' },
    { symbol: 't', meaning: 'número de períodos' },
  ],
  'Área do triângulo': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'b', meaning: 'base — qualquer um dos lados' },
    { symbol: 'h', meaning: 'altura relativa a essa base' },
  ],
  'Área do triângulo (lados)': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'a, b, c', meaning: 'os três lados do triângulo' },
    { symbol: 'p', meaning: 'semiperímetro: metade da soma dos lados' },
  ],
  'Semiperímetro': [
    { symbol: 'p', meaning: 'semiperímetro: metade da soma dos lados' },
    { symbol: 'a, b, c', meaning: 'os três lados do triângulo' },
  ],
  'Teorema de Pitágoras': [
    { symbol: 'a', meaning: 'hipotenusa — o lado oposto ao ângulo reto' },
    { symbol: 'b, c', meaning: 'catetos — os lados que formam o ângulo reto' },
  ],
  'Área do círculo': [
    { symbol: 'A', meaning: 'área do círculo' },
    { symbol: 'r', meaning: 'raio' },
    { symbol: '\\pi', meaning: 'constante ≈ 3,14' },
  ],
  'Comprimento da circunferência': [
    { symbol: 'C', meaning: 'comprimento da circunferência' },
    { symbol: 'r', meaning: 'raio' },
    { symbol: '\\pi', meaning: 'constante ≈ 3,14' },
  ],
  'Volume do cilindro': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'r', meaning: 'raio da base circular' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Volume da esfera': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'r', meaning: 'raio da esfera' },
  ],
  'Seno': [
    { symbol: '\\theta', meaning: 'ângulo agudo de referência' },
    { symbol: 'co', meaning: 'cateto oposto ao ângulo' },
    { symbol: 'h', meaning: 'hipotenusa' },
  ],
  'Cosseno': [
    { symbol: '\\theta', meaning: 'ângulo agudo de referência' },
    { symbol: 'ca', meaning: 'cateto adjacente ao ângulo' },
    { symbol: 'h', meaning: 'hipotenusa' },
  ],
  'Lei dos senos': [
    { symbol: 'a, b, c', meaning: 'lados do triângulo' },
    { symbol: 'A, B, C', meaning: 'ângulos opostos aos lados a, b e c' },
  ],
  'PA: termo geral': [
    { symbol: 'a_n', meaning: 'termo que está na posição n' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'n', meaning: 'posição do termo (1, 2, 3…)' },
    { symbol: 'r', meaning: 'razão: o que se soma de um termo para o seguinte' },
  ],
  'PA: soma dos termos': [
    { symbol: 'S_n', meaning: 'soma dos n primeiros termos' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'a_n', meaning: 'último termo somado (o da posição n)' },
    { symbol: 'n', meaning: 'quantidade de termos somados' },
  ],
  'PG: termo geral': [
    { symbol: 'a_n', meaning: 'termo que está na posição n' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'q', meaning: 'razão: o que se multiplica de um termo para o seguinte' },
    { symbol: 'n', meaning: 'posição do termo' },
  ],
  'PG: soma dos termos': [
    { symbol: 'S_n', meaning: 'soma dos n primeiros termos' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'q', meaning: 'razão: o que se multiplica de um termo para o seguinte' },
    { symbol: 'n', meaning: 'quantidade de termos somados' },
  ],
  Combinação: [
    {
      symbol: 'C_{n,p}',
      meaning: 'quantos grupos de p dá para formar — a ordem não importa',
    },
    { symbol: 'n', meaning: 'total de elementos disponíveis' },
    { symbol: 'p', meaning: 'quantos elementos entram em cada grupo' },
    { symbol: 'n!', meaning: 'fatorial: n × (n−1) × … × 1' },
  ],
  Probabilidade: [
    { symbol: 'P(A)', meaning: 'probabilidade do evento A, de 0 a 1' },
    { symbol: '\\text{favoráveis}', meaning: 'casos em que o evento A acontece' },
    { symbol: '\\text{possíveis}', meaning: 'total de casos do espaço amostral' },
  ],

  // ---- Física ----
  'Velocidade média': [
    { symbol: '\\bar{v}', meaning: 'velocidade média no trecho', unit: 'm/s' },
    {
      symbol: '\\Delta s',
      meaning: 'deslocamento — posição final menos a inicial',
      unit: 'm',
    },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo gasto', unit: 's' },
  ],
  'Função horária (MRU)': [
    { symbol: 's', meaning: 'posição no instante t', unit: 'm' },
    { symbol: 's_0', meaning: 'posição inicial, em t = 0', unit: 'm' },
    { symbol: 'v', meaning: 'velocidade — constante no MRU', unit: 'm/s' },
    { symbol: 't', meaning: 'instante considerado', unit: 's' },
  ],
  'Função horária da posição (MUV)': [
    { symbol: 's', meaning: 'posição no instante t', unit: 'm' },
    { symbol: 's_0', meaning: 'posição inicial', unit: 'm' },
    { symbol: 'v_0', meaning: 'velocidade inicial', unit: 'm/s' },
    { symbol: 'a', meaning: 'aceleração, constante no MUV', unit: 'm/s²' },
    { symbol: 't', meaning: 'instante considerado', unit: 's' },
  ],
  'Função horária da velocidade (MUV)': [
    { symbol: 'v', meaning: 'velocidade no instante t', unit: 'm/s' },
    { symbol: 'v_0', meaning: 'velocidade inicial', unit: 'm/s' },
    { symbol: 'a', meaning: 'aceleração, constante no MUV', unit: 'm/s²' },
    { symbol: 't', meaning: 'instante considerado', unit: 's' },
  ],
  Torricelli: [
    { symbol: 'v', meaning: 'velocidade final', unit: 'm/s' },
    { symbol: 'v_0', meaning: 'velocidade inicial', unit: 'm/s' },
    { symbol: 'a', meaning: 'aceleração', unit: 'm/s²' },
    {
      symbol: '\\Delta s',
      meaning: 'deslocamento — use quando o tempo não é dado',
      unit: 'm',
    },
  ],
  '2ª Lei de Newton': [
    {
      symbol: '\\vec{F}_r',
      meaning: 'força resultante — a soma vetorial de todas as forças',
      unit: 'N',
    },
    { symbol: 'm', meaning: 'massa do corpo', unit: 'kg' },
    {
      symbol: '\\vec{a}',
      meaning: 'aceleração, na mesma direção da resultante',
      unit: 'm/s²',
    },
  ],
  'Peso': [
    { symbol: 'P', meaning: 'peso: a força com que a Terra atrai o corpo', unit: 'N' },
    { symbol: 'm', meaning: 'massa do corpo', unit: 'kg' },
    { symbol: 'g', meaning: 'aceleração da gravidade (≈ 10 na Terra)', unit: 'm/s²' },
  ],
  Trabalho: [
    { symbol: '\\tau', meaning: 'trabalho realizado pela força', unit: 'J' },
    { symbol: 'F', meaning: 'intensidade da força', unit: 'N' },
    { symbol: 'd', meaning: 'deslocamento do corpo', unit: 'm' },
    {
      symbol: '\\theta',
      meaning: 'ângulo entre a força e o deslocamento',
    },
  ],
  'Potência': [
    { symbol: 'P', meaning: 'potência: energia entregue por unidade de tempo', unit: 'W' },
    { symbol: 'E', meaning: 'energia (ou trabalho) envolvida', unit: 'J' },
    { symbol: 't', meaning: 'tempo', unit: 's' },
  ],
  'Potência elétrica': [
    { symbol: 'P_{\\text{el}}', meaning: 'potência elétrica dissipada', unit: 'W' },
    { symbol: 'U', meaning: 'tensão (ddp)', unit: 'V' },
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
  ],
  'Energia cinética': [
    { symbol: 'E_c', meaning: 'energia cinética: a do movimento', unit: 'J' },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
  ],
  'Energia potencial gravitacional': [
    { symbol: 'E_p', meaning: 'energia potencial gravitacional: a da altura', unit: 'J' },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'g', meaning: 'aceleração da gravidade', unit: 'm/s²' },
    { symbol: 'h', meaning: 'altura em relação ao referencial', unit: 'm' },
  ],
  'Conservação de energia': [
    {
      symbol: 'E_{\\text{mec}}',
      meaning: 'energia mecânica total — constante quando não há atrito',
      unit: 'J',
    },
    { symbol: 'E_c', meaning: 'energia cinética', unit: 'J' },
    { symbol: 'E_p', meaning: 'energia potencial', unit: 'J' },
  ],
  'Quantidade de movimento': [
    {
      symbol: 'Q',
      meaning: 'quantidade de movimento (momento linear)',
      unit: 'kg·m/s',
    },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
  ],
  '1ª Lei de Ohm': [
    { symbol: 'U', meaning: 'tensão (diferença de potencial)', unit: 'V' },
    { symbol: 'R', meaning: 'resistência elétrica', unit: 'Ω' },
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
  ],
  'Resistores em série': [
    { symbol: 'R_{\\text{eq}}', meaning: 'resistência equivalente', unit: 'Ω' },
    { symbol: 'R_1, R_2', meaning: 'resistências dos resistores associados', unit: 'Ω' },
  ],
  'Resistores em paralelo': [
    { symbol: 'R_{\\text{eq}}', meaning: 'resistência equivalente', unit: 'Ω' },
    { symbol: 'R_1, R_2', meaning: 'resistências dos resistores associados', unit: 'Ω' },
  ],
  'Dilatação térmica linear': [
    { symbol: '\\Delta L', meaning: 'variação de comprimento', unit: 'm' },
    { symbol: 'L_0', meaning: 'comprimento inicial', unit: 'm' },
    {
      symbol: '\\alpha',
      meaning: 'coeficiente de dilatação linear do material',
      unit: '°C⁻¹',
    },
    { symbol: '\\Delta\\theta', meaning: 'variação de temperatura', unit: '°C' },
  ],
  'Calor sensível': [
    {
      symbol: 'Q',
      meaning: 'calor trocado — só muda a temperatura, não o estado físico',
      unit: 'cal ou J',
    },
    { symbol: 'm', meaning: 'massa', unit: 'g ou kg' },
    { symbol: 'c', meaning: 'calor específico do material', unit: 'cal/g·°C' },
    { symbol: '\\Delta\\theta', meaning: 'variação de temperatura', unit: '°C' },
  ],
  'Calor latente': [
    {
      symbol: 'Q',
      meaning: 'calor trocado — só muda o estado físico, não a temperatura',
      unit: 'cal ou J',
    },
    { symbol: 'm', meaning: 'massa que muda de estado', unit: 'g ou kg' },
    {
      symbol: 'L',
      meaning:
        'calor latente da mudança de estado (ex.: fusão do gelo ≈ 80 cal/g); negativo na solidificação e na condensação',
      unit: 'cal/g',
    },
  ],

  // ---- Química ----
  Densidade: [
    { symbol: 'd', meaning: 'densidade', unit: 'g/cm³ ou g/L' },
    { symbol: 'm', meaning: 'massa da amostra', unit: 'g' },
    { symbol: 'V', meaning: 'volume ocupado', unit: 'cm³ ou L' },
  ],
  'Concentração comum': [
    { symbol: 'C', meaning: 'concentração comum', unit: 'g/L' },
    { symbol: 'm_{\\text{soluto}}', meaning: 'massa do soluto dissolvido', unit: 'g' },
    {
      symbol: 'V_{\\text{solução}}',
      meaning: 'volume da solução — não é o volume do solvente',
      unit: 'L',
    },
  ],
  'Concentração molar': [
    {
      symbol: 'M',
      meaning: 'concentração em quantidade de matéria (molaridade)',
      unit: 'mol/L',
    },
    { symbol: 'n_{\\text{mol}}', meaning: 'número de mols do soluto', unit: 'mol' },
    { symbol: 'V(L)', meaning: 'volume da solução', unit: 'L' },
  ],
  Título: [
    { symbol: '\\tau', meaning: 'título em massa — adimensional, de 0 a 1' },
    { symbol: 'm_{\\text{soluto}}', meaning: 'massa do soluto', unit: 'g' },
    {
      symbol: 'm_{\\text{solução}}',
      meaning: 'massa da solução: soluto mais solvente',
      unit: 'g',
    },
  ],
  'Número de mols (pela massa)': [
    { symbol: 'n', meaning: 'quantidade de matéria', unit: 'mol' },
    { symbol: 'm', meaning: 'massa da amostra', unit: 'g' },
    { symbol: 'M', meaning: 'massa molar da substância', unit: 'g/mol' },
  ],
  'Número de mols (gás nas CNTP)': [
    { symbol: 'n', meaning: 'quantidade de matéria', unit: 'mol' },
    { symbol: 'V', meaning: 'volume do gás nas CNTP', unit: 'L' },
    { symbol: '22{,}4', meaning: 'volume molar de qualquer gás nas CNTP', unit: 'L/mol' },
  ],
  'Constante de Avogadro': [
    {
      symbol: 'N_A',
      meaning: 'número de partículas contidas em 1 mol',
      unit: 'mol⁻¹',
    },
  ],
  'Rendimento de reação': [
    { symbol: 'R\\%', meaning: 'rendimento da reação', unit: '%' },
    {
      symbol: 'm_{\\text{obtida}}',
      meaning: 'massa realmente obtida no experimento',
      unit: 'g',
    },
    {
      symbol: 'm_{\\text{teórica}}',
      meaning: 'massa prevista pela estequiometria',
      unit: 'g',
    },
  ],
  'Grau de ionização': [
    {
      symbol: '\\alpha',
      meaning: 'grau de ionização — quanto do total se ionizou',
      unit: '%',
    },
    {
      symbol: 'n_{\\text{ionizado}}',
      meaning: 'mols que sofreram ionização',
      unit: 'mol',
    },
    {
      symbol: 'n_{\\text{inicial}}',
      meaning: 'mols dissolvidos no início',
      unit: 'mol',
    },
  ],
  'Celsius ↔ Kelvin': [
    { symbol: 'T(K)', meaning: 'temperatura absoluta', unit: 'K' },
    { symbol: 't(C)', meaning: 'temperatura em Celsius', unit: '°C' },
    {
      symbol: '273',
      meaning: 'deslocamento entre as escalas (273,15 arredondado)',
    },
  ],

  // ---- Biologia ----
  'Hardy-Weinberg: alelos': [
    { symbol: 'p', meaning: 'frequência do alelo dominante na população' },
    { symbol: 'q', meaning: 'frequência do alelo recessivo' },
  ],
  'Hardy-Weinberg: genótipos': [
    { symbol: 'p^2', meaning: 'proporção de homozigotos dominantes (AA)' },
    { symbol: '2pq', meaning: 'proporção de heterozigotos (Aa)' },
    { symbol: 'q^2', meaning: 'proporção de homozigotos recessivos (aa)' },
  ],
  'Aumento total (microscópio)': [
    { symbol: 'A', meaning: 'aumento total da imagem, em vezes' },
    { symbol: 'a_{\\text{ocular}}', meaning: 'aumento da lente ocular' },
    { symbol: 'a_{\\text{objetiva}}', meaning: 'aumento da lente objetiva' },
  ],
  'Crescimento populacional': [
    { symbol: '\\Delta N', meaning: 'variação no número de indivíduos' },
    { symbol: 'N', meaning: 'tamanho da população no início' },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo considerado' },
  ],
};

/**
 * Assunto (subtópico) de cada fórmula, indexado pelo título. Os nomes têm de
 * bater com a TAXONOMY do seed.ts — o seeding resolve por (matéria, nome) e
 * ignora silenciosamente o que não existir.
 *
 * É o que permite agrupar a cola por assunto dentro de cada matéria, em vez
 * de uma lista corrida de 18 fórmulas de Matemática.
 */
export const FORMULA_TOPICS: Record<string, string> = {
  // ---- Matemática ----
  'Equação do 2º grau (Bhaskara)': 'Equações do 2º grau',
  'Delta (discriminante)': 'Equações do 2º grau',
  'Soma das raízes': 'Equações do 2º grau',
  'Produto das raízes': 'Equações do 2º grau',
  'Variação percentual': 'Porcentagem',
  'Juros simples': 'Juros simples e compostos',
  'Montante (juros simples)': 'Juros simples e compostos',
  'Juros compostos': 'Juros simples e compostos',
  'Área do triângulo': 'Áreas e perímetros',
  'Área do triângulo (lados)': 'Áreas e perímetros',
  'Semiperímetro': 'Áreas e perímetros',
  'Área do círculo': 'Áreas e perímetros',
  'Comprimento da circunferência': 'Áreas e perímetros',
  'Teorema de Pitágoras': 'Geometria plana',
  'Volume do cilindro': 'Volumes',
  'Volume da esfera': 'Volumes',
  'Seno': 'Trigonometria',
  'Cosseno': 'Trigonometria',
  'Lei dos senos': 'Trigonometria',
  'PA: termo geral': 'Progressão aritmética',
  'PA: soma dos termos': 'Progressão aritmética',
  'PG: termo geral': 'Progressão geométrica',
  'PG: soma dos termos': 'Progressão geométrica',
  Combinação: 'Análise combinatória',
  Probabilidade: 'Probabilidade',

  // ---- Física ----
  'Velocidade média': 'Cinemática',
  'Função horária (MRU)': 'Cinemática',
  'Função horária da posição (MUV)': 'Cinemática',
  'Função horária da velocidade (MUV)': 'Cinemática',
  Torricelli: 'Cinemática',
  '2ª Lei de Newton': 'Leis de Newton',
  'Peso': 'Leis de Newton',
  Trabalho: 'Trabalho e energia',
  'Energia cinética': 'Trabalho e energia',
  'Energia potencial gravitacional': 'Trabalho e energia',
  'Conservação de energia': 'Trabalho e energia',
  'Potência': 'Energia e potência',
  'Potência elétrica': 'Energia e potência',
  'Quantidade de movimento': 'Impulso e quantidade de movimento',
  '1ª Lei de Ohm': 'Eletrodinâmica',
  'Resistores em série': 'Circuitos elétricos',
  'Resistores em paralelo': 'Circuitos elétricos',
  'Dilatação térmica linear': 'Termologia',
  'Calor sensível': 'Calorimetria',
  'Calor latente': 'Calorimetria',

  // ---- Química ----
  Densidade: 'Propriedades da matéria',
  'Concentração comum': 'Soluções',
  'Concentração molar': 'Soluções',
  Título: 'Soluções',
  'Número de mols (pela massa)': 'Estequiometria',
  'Número de mols (gás nas CNTP)': 'Estequiometria',
  'Constante de Avogadro': 'Estequiometria',
  'Rendimento de reação': 'Estequiometria',
  'Grau de ionização': 'Equilíbrio químico',
  'Celsius ↔ Kelvin': 'Termoquímica',

  // ---- Biologia ----
  'Hardy-Weinberg: alelos': 'Genética',
  'Hardy-Weinberg: genótipos': 'Genética',
  'Aumento total (microscópio)': 'Citologia',
  'Crescimento populacional': 'Ecologia',

  // ---- Redação ----
  'Estrutura da redação ENEM': 'Estrutura dissertativa',
};

/** Semeia as fórmulas por upsert (idempotente). Retorna quantas gravou. */
export async function seedFormulas(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const f of FORMULAS) {
    const subject = await prisma.subject.findUnique({
      where: { name: f.subject },
      select: { id: true },
    });
    if (!subject) {
      console.warn(`[seed-formulas] matéria não encontrada: ${f.subject}`);
      continue;
    }
    // Assunto: resolvido por (matéria, nome) na taxonomia. Um nome que não
    // exista mais vira null em vez de quebrar o seed.
    const topicName = FORMULA_TOPICS[f.title];
    const topic = topicName
      ? await prisma.topic.findUnique({
          where: {
            subjectId_name: { subjectId: subject.id, name: topicName },
          },
          select: { id: true },
        })
      : null;
    if (topicName && !topic) {
      console.warn(
        `[seed-formulas] assunto não encontrado: ${f.subject} / ${topicName}`,
      );
    }

    if (f.formerTitle) {
      const [atual, antiga] = await Promise.all([
        prisma.formula.findUnique({ where: { title: f.title } }),
        prisma.formula.findUnique({ where: { title: f.formerTitle } }),
      ]);
      if (antiga && !atual) {
        await prisma.formula.update({
          where: { id: antiga.id },
          data: { title: f.title },
        });
      }
    }

    const formula = await prisma.formula.upsert({
      where: { title: f.title },
      update: {
        latex: f.latex,
        description: f.description ?? null,
        subjectId: subject.id,
        topicId: topic?.id ?? null,
      },
      create: {
        title: f.title,
        latex: f.latex,
        description: f.description ?? null,
        subjectId: subject.id,
        topicId: topic?.id ?? null,
        isBuiltIn: true,
      },
      select: { id: true },
    });

    // Legenda: recria do zero a cada seed para refletir edições no catálogo.
    const symbols = FORMULA_SYMBOLS[f.title];
    if (symbols?.length) {
      await prisma.formulaSymbol.deleteMany({ where: { formulaId: formula.id } });
      await prisma.formulaSymbol.createMany({
        data: symbols.map((sym, i) => ({
          formulaId: formula.id,
          symbol: sym.symbol,
          meaning: sym.meaning,
          unit: sym.unit ?? null,
          position: i,
        })),
      });
    }
    count += 1;
  }
  return count;
}