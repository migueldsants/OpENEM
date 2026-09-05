// Fórmulas essenciais (issue #38) — catálogo + seeding idempotente.
// Compartilhado entre prisma/seed.ts (db:seed) e prisma/seed-formulas.ts.
import type { PrismaClient } from '@prisma/client';

export interface FormulaSeed {
  subject: string; // nome canônico da matéria (da TAXONOMY do seed.ts)
  title: string;
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
    title: 'Soma e produto',
    latex: 'S = -\\frac{b}{a}, \\quad P = \\frac{c}{a}',
    description: 'Soma e produto das raízes do 2º grau.',
  },
  {
    subject: 'Matemática',
    title: 'Variação percentual',
    latex: '\\Delta\\% = \\frac{V_f - V_i}{V_i} \\times 100\\%',
  },
  {
    subject: 'Matemática',
    title: 'Juros simples',
    latex: 'J = C \\cdot i \\cdot t, \\quad M = C + J',
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
    latex: 'A = \\sqrt{p(p-a)(p-b)(p-c)}, \\quad p = \\frac{a+b+c}{2}',
    description: 'Fórmula de Heron.',
  },
  {
    subject: 'Matemática',
    title: 'Teorema de Pitágoras',
    latex: 'a^2 = b^2 + c^2',
  },
  {
    subject: 'Matemática',
    title: 'Círculo: área e circunferência',
    latex: 'A = \\pi r^2, \\quad C = 2\\pi r',
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
    title: 'Seno e cosseno',
    latex: '\\sin\\theta = \\frac{co}{h}, \\quad \\cos\\theta = \\frac{ca}{h}',
    description: 'cateto oposto / cateto adjacente sobre a hipotenusa.',
  },
  {
    subject: 'Matemática',
    title: 'Lei dos senos',
    latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}',
  },
  {
    subject: 'Matemática',
    title: 'PA — termo geral e soma',
    latex: 'a_n = a_1 + (n-1)r, \\quad S_n = \\frac{(a_1 + a_n)n}{2}',
  },
  {
    subject: 'Matemática',
    title: 'PG — termo geral e soma',
    latex: 'a_n = a_1 \\cdot q^{n-1}, \\quad S_n = \\frac{a_1(q^n - 1)}{q - 1}',
  },
  {
    subject: 'Matemática',
    title: 'Combinação',
    latex: 'C_{n,p} = \\frac{n!}{p!(n-p)!}',
  },
  {
    subject: 'Matemática',
    title: 'Probabilidade',
    latex: 'P(A) = \\frac{favor\\acute{a}veis}{poss\\acute{i}veis}',
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
    title: 'Funções horárias (MUV)',
    latex: 's = s_0 + v_0 t + \\frac{at^2}{2}, \\quad v = v_0 + at',
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
    latex: 'P = mg, \\quad g \\approx 10\\,m/s^2',
  },
  {
    subject: 'Física',
    title: 'Trabalho',
    latex: '\\tau = Fd\\cos\\theta',
  },
  {
    subject: 'Física',
    title: 'Potência',
    latex: 'P = \\frac{E}{t}, \\quad P_{el} = Ui',
  },
  {
    subject: 'Física',
    title: 'Energia cinética e potencial',
    latex: 'E_c = \\frac{mv^2}{2}, \\quad E_p = mgh',
  },
  {
    subject: 'Física',
    title: 'Conservação de energia',
    latex: 'E_{mec} = E_c + E_p = constante',
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
    title: 'Resistência equivalente',
    latex: 'R_{eq} = R_1 + R_2, \\quad \\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2}',
    description: 'Série e paralelo.',
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

  // ---- Química ----
  {
    subject: 'Química',
    title: 'Densidade',
    latex: 'd = \\frac{m}{V}',
  },
  {
    subject: 'Química',
    title: 'Concentração comum',
    latex: 'C = \\frac{m_{soluto}}{V_{solu\\c{c}\\c{a}o}}',
  },
  {
    subject: 'Química',
    title: 'Concentração molar',
    latex: 'M = \\frac{n_{mol}}{V(L)}',
  },
  {
    subject: 'Química',
    title: 'Título',
    latex: '\\tau = \\frac{m_{soluto}}{m_{solu\\c{c}\\c{a}o}}',
  },
  {
    subject: 'Química',
    title: 'Número de mols',
    latex: 'n = \\frac{m}{M}, \\quad n = \\frac{V}{22{,}4}',
    description: 'Por massa ou volume em STP.',
  },
  {
    subject: 'Química',
    title: 'Constante de Avogadro',
    latex: 'N_A = 6{,}02 \\times 10^{23}',
  },
  {
    subject: 'Química',
    title: 'Rendimento de reação',
    latex: 'R\\% = \\frac{m_{obtida}}{m_{teorica}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Grau de ionização',
    latex: '\\alpha = \\frac{n_{ionizado}}{n_{inicial}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Celsius ↔ Kelvin',
    latex: 'T(K) = t(C) + 273',
  },

  // ---- Biologia ----
  {
    subject: 'Biologia',
    title: 'Hardy-Weinberg',
    latex: 'p + q = 1, \\quad p^2 + 2pq + q^2 = 1',
  },
  {
    subject: 'Biologia',
    title: 'Aumento total (microscópio)',
    latex: 'A = a_{ocular} \\times a_{objetiva}',
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
      '\\text{introdu\\c{c}\\c{a}o} \\to \\text{2 desenv.} \\to \\text{conclus\\c{a}o}',
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
  'Soma e produto': [
    { symbol: 'S', meaning: 'soma das duas raízes' },
    { symbol: 'P', meaning: 'produto das duas raízes' },
    { symbol: 'a, b, c', meaning: 'coeficientes de ax² + bx + c = 0' },
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
    { symbol: 'M', meaning: 'montante — capital mais juros' },
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
    { symbol: 'p', meaning: 'semiperímetro — metade da soma dos lados' },
  ],
  'Teorema de Pitágoras': [
    { symbol: 'a', meaning: 'hipotenusa — o lado oposto ao ângulo reto' },
    { symbol: 'b, c', meaning: 'catetos — os lados que formam o ângulo reto' },
  ],
  'Círculo: área e circunferência': [
    { symbol: 'A', meaning: 'área do círculo' },
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
  'Seno e cosseno': [
    { symbol: '\\theta', meaning: 'ângulo agudo de referência' },
    { symbol: 'co', meaning: 'cateto oposto ao ângulo' },
    { symbol: 'ca', meaning: 'cateto adjacente ao ângulo' },
    { symbol: 'h', meaning: 'hipotenusa' },
  ],
  'Lei dos senos': [
    { symbol: 'a, b, c', meaning: 'lados do triângulo' },
    { symbol: 'A, B, C', meaning: 'ângulos opostos aos lados a, b e c' },
  ],
  'PA — termo geral e soma': [
    { symbol: 'a_n', meaning: 'termo que está na posição n' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'n', meaning: 'posição do termo (1, 2, 3…)' },
    {
      symbol: 'r',
      meaning: 'razão — o que se soma de um termo para o seguinte',
    },
    { symbol: 'S_n', meaning: 'soma dos n primeiros termos' },
  ],
  'PG — termo geral e soma': [
    { symbol: 'a_n', meaning: 'termo que está na posição n' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    {
      symbol: 'q',
      meaning: 'razão — o que se multiplica de um termo para o seguinte',
    },
    { symbol: 'n', meaning: 'posição do termo' },
    { symbol: 'S_n', meaning: 'soma dos n primeiros termos (vale para q ≠ 1)' },
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
  'Funções horárias (MUV)': [
    { symbol: 's', meaning: 'posição no instante t', unit: 'm' },
    { symbol: 's_0', meaning: 'posição inicial', unit: 'm' },
    { symbol: 'v_0', meaning: 'velocidade inicial', unit: 'm/s' },
    { symbol: 'v', meaning: 'velocidade no instante t', unit: 'm/s' },
    { symbol: 'a', meaning: 'aceleração — constante no MUV', unit: 'm/s²' },
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
  Peso: [
    {
      symbol: 'P',
      meaning: 'peso — a força com que a Terra atrai o corpo',
      unit: 'N',
    },
    { symbol: 'm', meaning: 'massa do corpo', unit: 'kg' },
    { symbol: 'g', meaning: 'aceleração da gravidade', unit: 'm/s²' },
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
  Potência: [
    {
      symbol: 'P',
      meaning: 'potência — energia entregue por unidade de tempo',
      unit: 'W',
    },
    { symbol: 'E', meaning: 'energia (ou trabalho) envolvida', unit: 'J' },
    { symbol: 't', meaning: 'tempo', unit: 's' },
    { symbol: 'P_{el}', meaning: 'potência elétrica dissipada', unit: 'W' },
    { symbol: 'U', meaning: 'tensão (ddp)', unit: 'V' },
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
  ],
  'Energia cinética e potencial': [
    { symbol: 'E_c', meaning: 'energia cinética — a do movimento', unit: 'J' },
    {
      symbol: 'E_p',
      meaning: 'energia potencial gravitacional — a da altura',
      unit: 'J',
    },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
    { symbol: 'g', meaning: 'aceleração da gravidade', unit: 'm/s²' },
    { symbol: 'h', meaning: 'altura em relação ao referencial', unit: 'm' },
  ],
  'Conservação de energia': [
    {
      symbol: 'E_{mec}',
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
  'Resistência equivalente': [
    {
      symbol: 'R_{eq}',
      meaning: 'resistência equivalente — a 1ª forma é série, a 2ª é paralelo',
      unit: 'Ω',
    },
    {
      symbol: 'R_1, R_2',
      meaning: 'resistências dos resistores associados',
      unit: 'Ω',
    },
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

  // ---- Química ----
  Densidade: [
    { symbol: 'd', meaning: 'densidade', unit: 'g/cm³ ou g/L' },
    { symbol: 'm', meaning: 'massa da amostra', unit: 'g' },
    { symbol: 'V', meaning: 'volume ocupado', unit: 'cm³ ou L' },
  ],
  'Concentração comum': [
    { symbol: 'C', meaning: 'concentração comum', unit: 'g/L' },
    { symbol: 'm_{soluto}', meaning: 'massa do soluto dissolvido', unit: 'g' },
    {
      symbol: 'V_{solução}',
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
    { symbol: 'n_{mol}', meaning: 'número de mols do soluto', unit: 'mol' },
    { symbol: 'V(L)', meaning: 'volume da solução', unit: 'L' },
  ],
  Título: [
    { symbol: '\\tau', meaning: 'título em massa — adimensional, de 0 a 1' },
    { symbol: 'm_{soluto}', meaning: 'massa do soluto', unit: 'g' },
    {
      symbol: 'm_{solução}',
      meaning: 'massa da solução: soluto mais solvente',
      unit: 'g',
    },
  ],
  'Número de mols': [
    { symbol: 'n', meaning: 'quantidade de matéria', unit: 'mol' },
    { symbol: 'm', meaning: 'massa da amostra', unit: 'g' },
    { symbol: 'M', meaning: 'massa molar da substância', unit: 'g/mol' },
    { symbol: 'V', meaning: 'volume do gás nas CNTP', unit: 'L' },
    {
      symbol: '22{,}4',
      meaning: 'volume molar de qualquer gás nas CNTP',
      unit: 'L/mol',
    },
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
      symbol: 'm_{obtida}',
      meaning: 'massa realmente obtida no experimento',
      unit: 'g',
    },
    {
      symbol: 'm_{teorica}',
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
      symbol: 'n_{ionizado}',
      meaning: 'mols que sofreram ionização',
      unit: 'mol',
    },
    {
      symbol: 'n_{inicial}',
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
  'Hardy-Weinberg': [
    { symbol: 'p', meaning: 'frequência do alelo dominante na população' },
    { symbol: 'q', meaning: 'frequência do alelo recessivo' },
    { symbol: 'p^2', meaning: 'proporção de homozigotos dominantes (AA)' },
    { symbol: '2pq', meaning: 'proporção de heterozigotos (Aa)' },
    { symbol: 'q^2', meaning: 'proporção de homozigotos recessivos (aa)' },
  ],
  'Aumento total (microscópio)': [
    { symbol: 'A', meaning: 'aumento total da imagem, em vezes' },
    { symbol: 'a_{ocular}', meaning: 'aumento da lente ocular' },
    { symbol: 'a_{objetiva}', meaning: 'aumento da lente objetiva' },
  ],
  'Crescimento populacional': [
    { symbol: '\\Delta N', meaning: 'variação no número de indivíduos' },
    { symbol: 'N', meaning: 'tamanho da população no início' },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo considerado' },
  ],
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
    const formula = await prisma.formula.upsert({
      where: { title: f.title },
      update: {
        latex: f.latex,
        description: f.description ?? null,
        subjectId: subject.id,
      },
      create: {
        title: f.title,
        latex: f.latex,
        description: f.description ?? null,
        subjectId: subject.id,
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