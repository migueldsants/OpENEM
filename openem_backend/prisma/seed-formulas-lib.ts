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
  {
    subject: 'Matemática',
    title: 'Probabilidade do complementar',
    latex: 'P(\\bar{A}) = 1 - P(A)',
    description: 'Chance de A não acontecer.',
  },
  {
    subject: 'Matemática',
    title: 'Probabilidade da união',
    latex: 'P(A \\cup B) = P(A) + P(B) - P(A \\cap B)',
    description:
      'Regra do "ou". Se A e B não podem ocorrer juntos, P(A ∩ B) = 0.',
  },
  {
    subject: 'Matemática',
    title: 'Probabilidade condicional',
    latex: 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}',
  },
  {
    subject: 'Matemática',
    title: 'Eventos independentes',
    latex: 'P(A \\cap B) = P(A) \\cdot P(B)',
    description: 'Regra do "e", quando um evento não muda a chance do outro.',
  },
  {
    subject: 'Matemática',
    title: 'Permutação simples',
    latex: 'P_n = n!',
  },
  {
    subject: 'Matemática',
    title: 'Arranjo simples',
    latex: 'A_{n,p} = \\frac{n!}{(n-p)!}',
  },
  {
    subject: 'Matemática',
    title: 'Permutação com repetição',
    latex: 'P_n^{a,b,\\ldots} = \\frac{n!}{a! \\, b! \\cdots}',
    description: 'Ex.: anagramas de uma palavra com letras repetidas.',
  },
  {
    subject: 'Matemática',
    title: 'Aumentos e descontos sucessivos',
    latex: 'V_f = V_i \\cdot (1 + i_1)(1 + i_2)\\cdots',
    description:
      'Desconto entra com taxa negativa: 20% de desconto multiplica por 0,80.',
  },
  {
    subject: 'Matemática',
    title: 'Escala',
    latex: 'E = \\frac{d}{D}',
    description: 'Mapas, plantas e maquetes. d e D na mesma unidade.',
  },
  {
    subject: 'Matemática',
    title: 'Função afim',
    latex: 'f(x) = ax + b',
    description:
      'O gráfico é uma reta: crescente se a > 0, decrescente se a < 0.',
  },
  {
    subject: 'Matemática',
    title: 'Coeficiente angular',
    latex: 'a = \\frac{\\Delta y}{\\Delta x} = \\frac{y_2 - y_1}{x_2 - x_1}',
    description: 'Taxa de variação da reta, a partir de dois pontos dela.',
  },
  {
    subject: 'Matemática',
    title: 'Abscissa do vértice',
    latex: 'x_v = -\\frac{b}{2a}',
    description: 'Onde a função quadrática atinge o máximo ou o mínimo.',
  },
  {
    subject: 'Matemática',
    title: 'Ordenada do vértice',
    latex: 'y_v = -\\frac{\\Delta}{4a}',
    description: 'Valor máximo (a < 0) ou mínimo (a > 0) da função quadrática.',
  },
  {
    subject: 'Matemática',
    title: 'Função exponencial',
    latex: 'f(x) = a \\cdot b^x',
    description: 'Cresce se b > 1 e decresce se 0 < b < 1.',
  },
  {
    subject: 'Matemática',
    title: 'Definição de logaritmo',
    latex: '\\log_b a = x \\iff b^x = a',
    description:
      'Vale para a > 0, b > 0 e b ≠ 1. Sem base escrita, a base é 10.',
  },
  {
    subject: 'Matemática',
    title: 'Logaritmo do produto',
    latex: '\\log_b (m \\cdot n) = \\log_b m + \\log_b n',
  },
  {
    subject: 'Matemática',
    title: 'Logaritmo do quociente',
    latex: '\\log_b \\left(\\frac{m}{n}\\right) = \\log_b m - \\log_b n',
  },
  {
    subject: 'Matemática',
    title: 'Logaritmo da potência',
    latex: '\\log_b (m^k) = k \\cdot \\log_b m',
  },
  {
    subject: 'Matemática',
    title: 'Mudança de base',
    latex: '\\log_b a = \\frac{\\log_c a}{\\log_c b}',
  },
  {
    subject: 'Matemática',
    title: 'Média aritmética',
    latex: '\\bar{x} = \\frac{x_1 + x_2 + \\cdots + x_n}{n}',
  },
  {
    subject: 'Matemática',
    title: 'Média ponderada',
    latex:
      '\\bar{x} = \\frac{p_1 x_1 + p_2 x_2 + \\cdots + p_n x_n}{p_1 + p_2 + \\cdots + p_n}',
  },
  {
    subject: 'Matemática',
    title: 'Posição da mediana',
    latex: '\\text{posição} = \\frac{n+1}{2}',
    description:
      'Com os dados em ordem. Se n for par, a mediana é a média dos dois termos centrais.',
  },
  {
    subject: 'Matemática',
    title: 'Variância',
    latex: '\\sigma^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n}',
    description: 'Variância populacional: média dos quadrados dos desvios.',
  },
  {
    subject: 'Matemática',
    title: 'Desvio padrão',
    latex: '\\sigma = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^2}{n}}',
    description: 'Raiz da variância. Quanto maior, mais dispersos os dados.',
  },
  {
    subject: 'Matemática',
    title: 'Área do retângulo',
    latex: 'A = b \\cdot h',
    description: 'Vale também para o paralelogramo.',
  },
  {
    subject: 'Matemática',
    title: 'Área do quadrado',
    latex: 'A = \\ell^2',
  },
  {
    subject: 'Matemática',
    title: 'Área do trapézio',
    latex: 'A = \\frac{(B + b) \\cdot h}{2}',
  },
  {
    subject: 'Matemática',
    title: 'Área do losango',
    latex: 'A = \\frac{D \\cdot d}{2}',
  },
  {
    subject: 'Matemática',
    title: 'Área do triângulo equilátero',
    latex: 'A = \\frac{\\ell^2 \\sqrt{3}}{4}',
  },
  {
    subject: 'Matemática',
    title: 'Área do triângulo (seno)',
    latex: 'A = \\frac{a \\cdot b \\cdot \\sin\\theta}{2}',
    description: 'Quando se conhecem dois lados e o ângulo entre eles.',
  },
  {
    subject: 'Matemática',
    title: 'Área do hexágono regular',
    latex: 'A = \\frac{3 \\ell^2 \\sqrt{3}}{2}',
    description: 'São seis triângulos equiláteros de lado ℓ.',
  },
  {
    subject: 'Matemática',
    title: 'Área do setor circular',
    latex: 'A = \\frac{\\alpha}{360^\\circ} \\cdot \\pi r^2',
  },
  {
    subject: 'Matemática',
    title: 'Comprimento de arco',
    latex: '\\ell = \\frac{\\alpha}{360^\\circ} \\cdot 2\\pi r',
  },
  {
    subject: 'Matemática',
    title: 'Altura do triângulo equilátero',
    latex: 'h = \\frac{\\ell \\sqrt{3}}{2}',
  },
  {
    subject: 'Matemática',
    title: 'Soma dos ângulos internos',
    latex: 'S_i = (n - 2) \\cdot 180^\\circ',
    description: 'Num polígono regular, cada ângulo interno mede Sᵢ / n.',
  },
  {
    subject: 'Matemática',
    title: 'Número de diagonais',
    latex: 'd = \\frac{n(n - 3)}{2}',
  },
  {
    subject: 'Matemática',
    title: 'Teorema de Tales',
    latex: '\\frac{a}{b} = \\frac{c}{d}',
    description:
      'Retas paralelas cortadas por duas transversais formam segmentos proporcionais.',
  },
  {
    subject: 'Matemática',
    title: 'Razão de semelhança (áreas)',
    latex: '\\frac{A_1}{A_2} = k^2',
    description:
      'Em figuras semelhantes com razão k entre os lados. Nos volumes, a razão é k³.',
  },
  {
    subject: 'Matemática',
    title: 'Tangente',
    latex: '\\tan\\theta = \\frac{co}{ca}',
    description: 'Cateto oposto sobre o cateto adjacente.',
  },
  {
    subject: 'Matemática',
    title: 'Relação fundamental da trigonometria',
    latex: '\\sin^2\\theta + \\cos^2\\theta = 1',
  },
  {
    subject: 'Matemática',
    title: 'Lei dos cossenos',
    latex: 'a^2 = b^2 + c^2 - 2bc \\cos A',
  },
  {
    subject: 'Matemática',
    title: 'Volume do prisma',
    latex: 'V = A_b \\cdot h',
  },
  {
    subject: 'Matemática',
    title: 'Volume do paralelepípedo',
    latex: 'V = a \\cdot b \\cdot c',
  },
  {
    subject: 'Matemática',
    title: 'Volume do cubo',
    latex: 'V = a^3',
  },
  {
    subject: 'Matemática',
    title: 'Volume da pirâmide',
    latex: 'V = \\frac{A_b \\cdot h}{3}',
    description: 'Um terço do prisma de mesma base e altura.',
  },
  {
    subject: 'Matemática',
    title: 'Volume do cone',
    latex: 'V = \\frac{\\pi r^2 h}{3}',
    description: 'Um terço do cilindro de mesma base e altura.',
  },
  {
    subject: 'Matemática',
    title: 'Área da superfície esférica',
    latex: 'A = 4\\pi r^2',
  },
  {
    subject: 'Matemática',
    title: 'Área lateral do cilindro',
    latex: 'A_\\ell = 2\\pi r h',
    description: 'O retângulo que aparece ao planificar a lateral.',
  },
  {
    subject: 'Matemática',
    title: 'Diagonal do cubo',
    latex: 'D = a\\sqrt{3}',
  },
  {
    subject: 'Matemática',
    title: 'Diagonal do paralelepípedo',
    latex: 'D = \\sqrt{a^2 + b^2 + c^2}',
  },
  {
    subject: 'Matemática',
    title: 'Relação de Euler',
    latex: 'V - A + F = 2',
    description: 'Vale para poliedros convexos.',
  },
  {
    subject: 'Matemática',
    title: 'Distância entre dois pontos',
    latex: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
  },
  {
    subject: 'Matemática',
    title: 'Ponto médio',
    latex: 'M = \\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)',
  },
  {
    subject: 'Matemática',
    title: 'Equação da circunferência',
    latex: '(x - a)^2 + (y - b)^2 = r^2',
  },
  {
    subject: 'Matemática',
    title: 'PG: soma infinita',
    latex: 'S_\\infty = \\frac{a_1}{1 - q}',
    description: 'Vale para −1 < q < 1.',
  },
  {
    subject: 'Matemática',
    title: 'Determinante 2×2',
    latex: '\\det \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc',
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
  {
    subject: 'Física',
    title: 'Aceleração média',
    latex: '\\bar{a} = \\frac{\\Delta v}{\\Delta t}',
  },
  {
    subject: 'Física',
    title: 'Queda livre',
    latex: 'h = \\frac{gt^2}{2}',
    description: 'Corpo largado do repouso, sem resistência do ar.',
  },
  {
    subject: 'Física',
    title: 'Velocidade angular',
    latex: '\\omega = \\frac{2\\pi}{T}',
    description: 'Movimento circular uniforme (MCU).',
  },
  {
    subject: 'Física',
    title: 'Velocidade linear (MCU)',
    latex: 'v = \\omega R',
  },
  {
    subject: 'Física',
    title: 'Aceleração centrípeta',
    latex: 'a_c = \\frac{v^2}{R}',
    description: 'Aponta para o centro da curva.',
  },
  {
    subject: 'Física',
    title: 'Força centrípeta',
    latex: 'F_c = \\frac{mv^2}{R}',
    description: 'Resultante que mantém o corpo na curva.',
  },
  {
    subject: 'Física',
    title: 'Força de atrito',
    latex: 'F_{\\text{at}} = \\mu N',
    description:
      'Parado, o atrito estático vai até μₑN; deslizando, vale μ_c N (cinético).',
  },
  {
    subject: 'Física',
    title: 'Força elástica (Lei de Hooke)',
    latex: 'F_{\\text{el}} = kx',
  },
  {
    subject: 'Física',
    title: 'Plano inclinado: componente do peso',
    latex: 'P_x = P \\sin\\theta',
    description: 'Parte do peso paralela à rampa, que puxa o corpo para baixo.',
  },
  {
    subject: 'Física',
    title: 'Plano inclinado: força normal',
    latex: 'N = P \\cos\\theta',
    description: 'Sem outras forças perpendiculares à rampa.',
  },
  {
    subject: 'Física',
    title: 'Energia potencial elástica',
    latex: 'E_{\\text{el}} = \\frac{kx^2}{2}',
  },
  {
    subject: 'Física',
    title: 'Teorema da energia cinética',
    latex: '\\tau_{\\text{total}} = \\Delta E_c',
    description: 'O trabalho da resultante é a variação da energia cinética.',
  },
  {
    subject: 'Física',
    title: 'Potência (força e velocidade)',
    latex: 'P = F v',
  },
  {
    subject: 'Física',
    title: 'Rendimento',
    latex: '\\eta = \\frac{P_{\\text{útil}}}{P_{\\text{total}}}',
    description: 'Fica entre 0 e 1 (0% e 100%). Vale também com energias.',
  },
  {
    subject: 'Física',
    title: 'Energia elétrica consumida',
    latex: 'E = P \\cdot \\Delta t',
    description:
      'Com P em kW e Δt em horas, a energia sai em kWh, a unidade da conta de luz.',
  },
  {
    subject: 'Física',
    title: 'Impulso',
    latex: 'I = F \\cdot \\Delta t',
  },
  {
    subject: 'Física',
    title: 'Teorema do impulso',
    latex: 'I = \\Delta Q',
    description:
      'O impulso da resultante é a variação da quantidade de movimento.',
  },
  {
    subject: 'Física',
    title: 'Conservação da quantidade de movimento',
    latex: 'Q_{\\text{antes}} = Q_{\\text{depois}}',
    description: 'Vale em sistemas isolados: colisões e explosões.',
  },
  {
    subject: 'Física',
    title: 'Lei da gravitação universal',
    latex: 'F = \\frac{G M m}{d^2}',
  },
  {
    subject: 'Física',
    title: '3ª Lei de Kepler',
    latex: '\\frac{T^2}{R^3} = k',
    description:
      'A constante é a mesma para todos os corpos que orbitam o mesmo astro.',
  },
  {
    subject: 'Física',
    title: 'Pressão',
    latex: 'p = \\frac{F}{A}',
  },
  {
    subject: 'Física',
    title: 'Pressão hidrostática (Stevin)',
    latex: 'p = p_0 + dgh',
    description: 'A cada 10 m de água, a pressão sobe cerca de 1 atm.',
  },
  {
    subject: 'Física',
    title: 'Empuxo (Arquimedes)',
    latex: 'E = d_{\\text{líq}} \\cdot V_{\\text{sub}} \\cdot g',
    description: 'Igual ao peso do líquido deslocado.',
  },
  {
    subject: 'Física',
    title: 'Princípio de Pascal (prensa hidráulica)',
    latex: '\\frac{F_1}{A_1} = \\frac{F_2}{A_2}',
  },
  {
    subject: 'Física',
    title: 'Equação fundamental da ondulatória',
    latex: 'v = \\lambda f',
  },
  {
    subject: 'Física',
    title: 'Período e frequência',
    latex: 'f = \\frac{1}{T}',
  },
  {
    subject: 'Física',
    title: 'Nível de intensidade sonora',
    latex: '\\beta = 10 \\log \\frac{I}{I_0}',
    description:
      'Em decibéis (dB). Cada +10 dB multiplica a intensidade por 10.',
  },
  {
    subject: 'Física',
    title: 'Índice de refração',
    latex: 'n = \\frac{c}{v}',
    description: 'c ≈ 3 × 10⁸ m/s é a velocidade da luz no vácuo.',
  },
  {
    subject: 'Física',
    title: 'Lei de Snell',
    latex: 'n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2',
    description: 'Ângulos medidos em relação à normal.',
  },
  {
    subject: 'Física',
    title: 'Equação de Gauss',
    latex: "\\frac{1}{f} = \\frac{1}{p} + \\frac{1}{p'}",
    description:
      'Espelhos esféricos e lentes. f > 0 para côncavo e convergente; imagem real tem p′ > 0.',
  },
  {
    subject: 'Física',
    title: 'Aumento linear',
    latex: "A = \\frac{i}{o} = -\\frac{p'}{p}",
    description: 'A < 0: imagem invertida; |A| > 1: imagem maior que o objeto.',
  },
  {
    subject: 'Física',
    title: 'Vergência (grau da lente)',
    latex: 'V = \\frac{1}{f}',
    description: 'Com f em metros, sai em dioptrias: os "graus" dos óculos.',
  },
  {
    subject: 'Física',
    title: 'Imagens em espelhos planos associados',
    latex: 'n = \\frac{360^\\circ}{\\alpha} - 1',
  },
  {
    subject: 'Física',
    title: 'Lei de Coulomb',
    latex: 'F = \\frac{k |Q| |q|}{d^2}',
    description: 'No vácuo, k ≈ 9 × 10⁹ N·m²/C².',
  },
  {
    subject: 'Física',
    title: 'Campo elétrico',
    latex: 'E = \\frac{F}{q}',
  },
  {
    subject: 'Física',
    title: 'Carga elétrica (quantização)',
    latex: 'Q = n e',
    description: 'e = 1,6 × 10⁻¹⁹ C, a carga elementar.',
  },
  {
    subject: 'Física',
    title: 'Corrente elétrica',
    latex: 'i = \\frac{\\Delta Q}{\\Delta t}',
  },
  {
    subject: 'Física',
    title: '2ª Lei de Ohm',
    latex: 'R = \\frac{\\rho L}{A}',
    description: 'Fio mais comprido resiste mais; fio mais grosso, menos.',
  },
  {
    subject: 'Física',
    title: 'Potência dissipada (corrente)',
    latex: 'P = R i^2',
  },
  {
    subject: 'Física',
    title: 'Potência dissipada (tensão)',
    latex: 'P = \\frac{U^2}{R}',
    description: 'Com a tensão fixa (tomada), menor resistência dissipa mais.',
  },
  {
    subject: 'Física',
    title: 'Força magnética sobre carga',
    latex: 'F = |q| v B \\sin\\theta',
  },
  {
    subject: 'Física',
    title: 'Força magnética sobre fio',
    latex: 'F = B i L \\sin\\theta',
  },
  {
    subject: 'Física',
    title: 'Lei de Faraday',
    latex: '\\varepsilon = -\\frac{\\Delta\\Phi}{\\Delta t}',
    description:
      'Indução: só há corrente induzida quando o fluxo magnético varia. O sinal é a Lei de Lenz.',
  },
  {
    subject: 'Física',
    title: 'Transformador',
    latex: '\\frac{U_1}{U_2} = \\frac{N_1}{N_2}',
    description: 'Só funciona com corrente alternada.',
  },
  {
    subject: 'Física',
    title: 'Equação de Clapeyron',
    latex: 'pV = nRT',
    description: 'Gás ideal, com a temperatura sempre em kelvin.',
  },
  {
    subject: 'Física',
    title: 'Lei geral dos gases',
    latex: '\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}',
    description: 'Mesma quantidade de gás, temperatura em kelvin.',
  },
  {
    subject: 'Física',
    title: '1ª Lei da Termodinâmica',
    latex: '\\Delta U = Q - \\tau',
  },
  {
    subject: 'Física',
    title: 'Trabalho de um gás (pressão constante)',
    latex: '\\tau = p \\Delta V',
    description: 'Expansão: trabalho positivo; compressão: negativo.',
  },
  {
    subject: 'Física',
    title: 'Rendimento da máquina térmica',
    latex: '\\eta = \\frac{\\tau}{Q_q} = 1 - \\frac{Q_f}{Q_q}',
  },
  {
    subject: 'Física',
    title: 'Rendimento de Carnot',
    latex: '\\eta = 1 - \\frac{T_f}{T_q}',
    description:
      'O máximo possível entre duas fontes, com as temperaturas em kelvin.',
  },
  {
    subject: 'Física',
    title: 'Dilatação térmica superficial',
    latex: '\\Delta A = A_0 \\beta \\Delta\\theta',
    description: 'β = 2α.',
  },
  {
    subject: 'Física',
    title: 'Dilatação térmica volumétrica',
    latex: '\\Delta V = V_0 \\gamma \\Delta\\theta',
    description: 'γ = 3α.',
  },
  {
    subject: 'Física',
    title: 'Celsius ↔ Fahrenheit',
    latex: '\\frac{T_C}{5} = \\frac{T_F - 32}{9}',
  },
  {
    subject: 'Física',
    title: 'Fluxo de calor (condução)',
    latex: '\\Phi = \\frac{k A \\Delta\\theta}{L}',
    description: 'Lei de Fourier.',
  },
  {
    subject: 'Física',
    title: 'Capacidade térmica',
    latex: 'C = \\frac{Q}{\\Delta\\theta} = mc',
  },
  {
    subject: 'Física',
    title: 'Trocas de calor (sistema isolado)',
    latex: '\\sum Q = 0',
    description: 'Calor recebido é positivo; calor cedido, negativo.',
  },
  {
    subject: 'Física',
    title: 'Energia do fóton',
    latex: 'E = hf',
    description: 'h ≈ 6,6 × 10⁻³⁴ J·s, a constante de Planck.',
  },
  {
    subject: 'Física',
    title: 'Equivalência massa-energia',
    latex: 'E = mc^2',
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
    latex:
      'R\\% = \\frac{m_{\\text{obtida}}}{m_{\\text{teórica}}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Grau de ionização',
    latex:
      '\\alpha = \\frac{n_{\\text{ionizado}}}{n_{\\text{inicial}}} \\times 100\\%',
  },
  {
    subject: 'Química',
    title: 'Celsius ↔ Kelvin',
    latex: 'T(K) = t(C) + 273',
  },
  {
    subject: 'Química',
    title: 'Número de massa',
    latex: 'A = Z + N',
  },
  {
    subject: 'Química',
    title: 'Diluição',
    latex: 'C_1 V_1 = C_2 V_2',
    description: 'A quantidade de soluto não muda; só entra solvente.',
  },
  {
    subject: 'Química',
    title: 'Mistura de soluções (mesmo soluto)',
    latex: 'C_f V_f = C_1 V_1 + C_2 V_2',
    description: 'O volume final é a soma dos volumes: V_f = V₁ + V₂.',
  },
  {
    subject: 'Química',
    title: 'Concentração comum pela molar',
    latex: 'C = M \\cdot MM',
  },
  {
    subject: 'Química',
    title: 'Concentração comum pelo título',
    latex: 'C = 1000 \\cdot d \\cdot \\tau',
    description: 'Com a densidade da solução em g/mL, C sai em g/L.',
  },
  {
    subject: 'Química',
    title: 'Partes por milhão (ppm)',
    latex:
      '\\text{ppm} = \\frac{m_{\\text{soluto}}}{m_{\\text{solução}}} \\times 10^6',
    description: 'Para soluções muito diluídas: 1 ppm = 1 mg por kg.',
  },
  {
    subject: 'Química',
    title: 'Constante de equilíbrio',
    latex: 'K_c = \\frac{[C]^c [D]^d}{[A]^a [B]^b}',
    description:
      'Para aA + bB ⇌ cC + dD. Sólidos e líquidos puros ficam de fora.',
  },
  {
    subject: 'Química',
    title: 'Lei de diluição de Ostwald',
    latex: 'K_i = \\frac{\\alpha^2 M}{1 - \\alpha}',
    description: 'Para eletrólitos fracos (α pequeno), K_i ≈ α² M.',
  },
  {
    subject: 'Química',
    title: 'pH',
    latex: '\\text{pH} = -\\log [\\text{H}^+]',
    description: 'pH < 7: ácido; pH = 7: neutro; pH > 7: básico (a 25 °C).',
  },
  {
    subject: 'Química',
    title: 'pOH',
    latex: '\\text{pOH} = -\\log [\\text{OH}^-]',
  },
  {
    subject: 'Química',
    title: 'Relação entre pH e pOH',
    latex: '\\text{pH} + \\text{pOH} = 14',
    description: 'A 25 °C.',
  },
  {
    subject: 'Química',
    title: 'Produto iônico da água',
    latex: 'K_w = [\\text{H}^+][\\text{OH}^-] = 10^{-14}',
    description: 'A 25 °C.',
  },
  {
    subject: 'Química',
    title: 'Variação de entalpia',
    latex: '\\Delta H = H_{\\text{produtos}} - H_{\\text{reagentes}}',
    description: 'ΔH < 0: exotérmica (libera calor); ΔH > 0: endotérmica.',
  },
  {
    subject: 'Química',
    title: 'Lei de Hess',
    latex: '\\Delta H = \\Delta H_1 + \\Delta H_2 + \\cdots',
    description:
      'O ΔH total não depende do caminho. Inverter uma etapa troca o sinal do seu ΔH.',
  },
  {
    subject: 'Química',
    title: 'Energia de ligação',
    latex:
      '\\Delta H = \\sum E_{\\text{quebradas}} - \\sum E_{\\text{formadas}}',
    description: 'Quebrar ligação absorve energia; formar libera.',
  },
  {
    subject: 'Química',
    title: 'Velocidade média de reação',
    latex: 'v_m = \\frac{|\\Delta [X]|}{\\Delta t}',
  },
  {
    subject: 'Química',
    title: 'Lei da velocidade',
    latex: 'v = k [A]^a [B]^b',
    description:
      'Os expoentes vêm da etapa lenta ou do experimento, não do balanceamento global.',
  },
  {
    subject: 'Química',
    title: 'Diferença de potencial da pilha',
    latex:
      '\\Delta E^\\circ = E^\\circ_{\\text{red, cátodo}} - E^\\circ_{\\text{red, ânodo}}',
    description: 'Pilha espontânea tem ΔE° > 0.',
  },
  {
    subject: 'Química',
    title: 'Carga na eletrólise',
    latex: 'Q = i \\cdot t',
  },
  {
    subject: 'Química',
    title: 'Constante de Faraday',
    latex: 'Q = n_{e} \\cdot F',
    description: 'F ≈ 96 500 C: a carga de 1 mol de elétrons.',
  },
  {
    subject: 'Química',
    title: 'Meia-vida',
    latex: 'm = \\frac{m_0}{2^n}',
    description: 'n é o número de meias-vidas passadas: t = n · P.',
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
  {
    subject: 'Biologia',
    title: 'Balanço populacional',
    latex: '\\Delta N = (N_{\\text{nat}} + I) - (M + E)',
    description: 'Entram nascimentos e imigrantes; saem mortes e emigrantes.',
  },
  {
    subject: 'Biologia',
    title: 'Produtividade primária líquida',
    latex: 'PPL = PPB - R',
    description: 'O que sobra para crescer e alimentar os consumidores.',
  },
  {
    subject: 'Biologia',
    title: 'Eficiência ecológica',
    latex: '\\text{Ef} = \\frac{E_{n+1}}{E_n} \\times 100\\%',
    description:
      'Em média, só cerca de 10% da energia passa de um nível trófico ao seguinte.',
  },
  {
    subject: 'Biologia',
    title: 'Número de tipos de gametas',
    latex: 'G = 2^n',
    description:
      'Ex.: AaBbCC tem n = 2 pares heterozigotos e forma 4 tipos de gameta.',
  },
  {
    subject: 'Biologia',
    title: 'Índice de massa corporal (IMC)',
    latex: '\\text{IMC} = \\frac{m}{h^2}',
    description: 'Em adultos, de 18,5 a 24,9 é a faixa considerada adequada.',
  },

  // ---- Geografia ----
  {
    subject: 'Geografia',
    title: 'Densidade demográfica',
    latex: 'D = \\frac{\\text{população}}{\\text{área}}',
  },
  {
    subject: 'Geografia',
    title: 'Crescimento vegetativo',
    latex: 'CV = TN - TM',
    description: 'Taxas por mil habitantes (‰). Não conta as migrações.',
  },
  {
    subject: 'Geografia',
    title: 'Fuso horário',
    latex: '\\Delta h = \\frac{\\Delta\\lambda}{15^\\circ}',
    description:
      'Cada 15° de longitude vale 1 hora. A leste, as horas estão adiantadas.',
  },

  // ---- Redação (atalho de estrutura, não fórmula matemática) ----
  {
    subject: 'Redação',
    title: 'Estrutura da redação ENEM',
    latex: '\\text{introdução} \\to \\text{2 desenv.} \\to \\text{conclusão}',
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
  Semiperímetro: [
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
  Seno: [
    { symbol: '\\theta', meaning: 'ângulo agudo de referência' },
    { symbol: 'co', meaning: 'cateto oposto ao ângulo' },
    { symbol: 'h', meaning: 'hipotenusa' },
  ],
  Cosseno: [
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
    {
      symbol: 'r',
      meaning: 'razão: o que se soma de um termo para o seguinte',
    },
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
    {
      symbol: 'q',
      meaning: 'razão: o que se multiplica de um termo para o seguinte',
    },
    { symbol: 'n', meaning: 'posição do termo' },
  ],
  'PG: soma dos termos': [
    { symbol: 'S_n', meaning: 'soma dos n primeiros termos' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    {
      symbol: 'q',
      meaning: 'razão: o que se multiplica de um termo para o seguinte',
    },
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
    {
      symbol: '\\text{favoráveis}',
      meaning: 'casos em que o evento A acontece',
    },
    {
      symbol: '\\text{possíveis}',
      meaning: 'total de casos do espaço amostral',
    },
  ],
  'Probabilidade do complementar': [
    { symbol: 'P(\\bar{A})', meaning: 'probabilidade de A não acontecer' },
    { symbol: 'P(A)', meaning: 'probabilidade de A acontecer' },
  ],
  'Probabilidade da união': [
    {
      symbol: 'P(A \\cup B)',
      meaning: 'probabilidade de acontecer A ou B (pelo menos um deles)',
    },
    { symbol: 'P(A), P(B)', meaning: 'probabilidade de cada evento' },
    {
      symbol: 'P(A \\cap B)',
      meaning:
        'probabilidade de A e B acontecerem juntos (contada duas vezes na soma)',
    },
  ],
  'Probabilidade condicional': [
    {
      symbol: 'P(A \\mid B)',
      meaning: 'probabilidade de A, sabendo que B aconteceu',
    },
    {
      symbol: 'P(A \\cap B)',
      meaning: 'probabilidade de A e B acontecerem juntos',
    },
    {
      symbol: 'P(B)',
      meaning: 'probabilidade de B, o espaço amostral reduzido',
    },
  ],
  'Eventos independentes': [
    {
      symbol: 'P(A \\cap B)',
      meaning: 'probabilidade de A e B acontecerem juntos',
    },
    { symbol: 'P(A), P(B)', meaning: 'probabilidade de cada evento' },
  ],
  'Permutação simples': [
    {
      symbol: 'P_n',
      meaning: 'quantas filas diferentes dá para formar com n elementos',
    },
    { symbol: 'n!', meaning: 'fatorial: n × (n−1) × … × 1' },
  ],
  'Arranjo simples': [
    {
      symbol: 'A_{n,p}',
      meaning:
        'quantos agrupamentos de p elementos dá para formar, com a ordem importando',
    },
    { symbol: 'n', meaning: 'total de elementos disponíveis' },
    { symbol: 'p', meaning: 'quantos elementos entram em cada agrupamento' },
  ],
  'Permutação com repetição': [
    {
      symbol: 'P_n^{a,b,\\ldots}',
      meaning: 'ordenações quando há elementos repetidos',
    },
    { symbol: 'n', meaning: 'total de elementos, contando as repetições' },
    {
      symbol: 'a, b, \\ldots',
      meaning: 'quantas vezes cada elemento se repete',
    },
  ],
  'Aumentos e descontos sucessivos': [
    { symbol: 'V_f', meaning: 'valor final' },
    { symbol: 'V_i', meaning: 'valor inicial' },
    {
      symbol: 'i_1, i_2',
      meaning: 'taxa de cada etapa, em decimal (desconto com sinal negativo)',
    },
  ],
  Escala: [
    { symbol: 'E', meaning: 'escala, como 1 : 50 000' },
    { symbol: 'd', meaning: 'medida no mapa, na planta ou na maquete' },
    { symbol: 'D', meaning: 'medida real, na mesma unidade de d' },
  ],
  'Função afim': [
    { symbol: 'f(x)', meaning: 'valor da função para cada x' },
    {
      symbol: 'a',
      meaning: 'coeficiente angular: quanto f(x) muda quando x aumenta 1',
    },
    {
      symbol: 'b',
      meaning:
        'coeficiente linear: o valor de f(0), onde a reta corta o eixo y',
    },
  ],
  'Coeficiente angular': [
    { symbol: 'a', meaning: 'coeficiente angular: a inclinação da reta' },
    { symbol: 'x_1, y_1', meaning: 'coordenadas de um ponto da reta' },
    { symbol: 'x_2, y_2', meaning: 'coordenadas de outro ponto da reta' },
  ],
  'Abscissa do vértice': [
    { symbol: 'x_v', meaning: 'valor de x no vértice da parábola' },
    { symbol: 'a, b', meaning: 'coeficientes de f(x) = ax² + bx + c' },
  ],
  'Ordenada do vértice': [
    { symbol: 'y_v', meaning: 'valor máximo ou mínimo da função' },
    { symbol: '\\Delta', meaning: 'discriminante: b² − 4ac' },
    { symbol: 'a', meaning: 'coeficiente de x²' },
  ],
  'Função exponencial': [
    { symbol: 'f(x)', meaning: 'valor da função para cada x' },
    { symbol: 'a', meaning: 'valor inicial, f(0)' },
    {
      symbol: 'b',
      meaning:
        'base: fator que multiplica o valor a cada unidade de x (b > 0, b ≠ 1)',
    },
  ],
  'Definição de logaritmo': [
    { symbol: '\\log_b a', meaning: 'logaritmo de a na base b: o expoente x' },
    { symbol: 'a', meaning: 'logaritmando (a > 0)' },
    { symbol: 'b', meaning: 'base (b > 0 e b ≠ 1)' },
  ],
  'Logaritmo do produto': [
    { symbol: 'm, n', meaning: 'números positivos' },
    { symbol: 'b', meaning: 'base, a mesma nos três logaritmos' },
  ],
  'Logaritmo do quociente': [
    { symbol: 'm, n', meaning: 'números positivos' },
    { symbol: 'b', meaning: 'base, a mesma nos três logaritmos' },
  ],
  'Logaritmo da potência': [
    { symbol: 'm', meaning: 'número positivo' },
    { symbol: 'k', meaning: 'expoente, que "desce" multiplicando' },
    { symbol: 'b', meaning: 'base' },
  ],
  'Mudança de base': [
    { symbol: 'a', meaning: 'logaritmando' },
    { symbol: 'b', meaning: 'base original' },
    { symbol: 'c', meaning: 'nova base (10 é a mais usada)' },
  ],
  'Média aritmética': [
    { symbol: '\\bar{x}', meaning: 'média' },
    { symbol: 'x_1, \\ldots, x_n', meaning: 'valores do conjunto' },
    { symbol: 'n', meaning: 'quantidade de valores' },
  ],
  'Média ponderada': [
    { symbol: '\\bar{x}', meaning: 'média ponderada' },
    { symbol: 'x_1, \\ldots, x_n', meaning: 'valores do conjunto' },
    { symbol: 'p_1, \\ldots, p_n', meaning: 'peso de cada valor' },
  ],
  'Posição da mediana': [
    { symbol: 'n', meaning: 'quantidade de valores, já em ordem crescente' },
  ],
  Variância: [
    { symbol: '\\sigma^2', meaning: 'variância' },
    { symbol: 'x_i', meaning: 'cada valor do conjunto' },
    { symbol: '\\bar{x}', meaning: 'média do conjunto' },
    { symbol: 'n', meaning: 'quantidade de valores' },
  ],
  'Desvio padrão': [
    { symbol: '\\sigma', meaning: 'desvio padrão, na mesma unidade dos dados' },
    { symbol: 'x_i', meaning: 'cada valor do conjunto' },
    { symbol: '\\bar{x}', meaning: 'média do conjunto' },
    { symbol: 'n', meaning: 'quantidade de valores' },
  ],
  'Área do retângulo': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'b', meaning: 'base' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Área do quadrado': [
    { symbol: 'A', meaning: 'área' },
    { symbol: '\\ell', meaning: 'lado' },
  ],
  'Área do trapézio': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'B', meaning: 'base maior' },
    { symbol: 'b', meaning: 'base menor' },
    { symbol: 'h', meaning: 'altura, a distância entre as bases' },
  ],
  'Área do losango': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'D', meaning: 'diagonal maior' },
    { symbol: 'd', meaning: 'diagonal menor' },
  ],
  'Área do triângulo equilátero': [
    { symbol: 'A', meaning: 'área' },
    { symbol: '\\ell', meaning: 'lado' },
  ],
  'Área do triângulo (seno)': [
    { symbol: 'A', meaning: 'área' },
    { symbol: 'a, b', meaning: 'dois lados do triângulo' },
    { symbol: '\\theta', meaning: 'ângulo entre esses dois lados' },
  ],
  'Área do hexágono regular': [
    { symbol: 'A', meaning: 'área' },
    { symbol: '\\ell', meaning: 'lado' },
  ],
  'Área do setor circular': [
    { symbol: 'A', meaning: 'área do setor (a "fatia")' },
    { symbol: '\\alpha', meaning: 'ângulo central do setor, em graus' },
    { symbol: 'r', meaning: 'raio' },
  ],
  'Comprimento de arco': [
    { symbol: '\\ell', meaning: 'comprimento do arco' },
    { symbol: '\\alpha', meaning: 'ângulo central, em graus' },
    { symbol: 'r', meaning: 'raio' },
  ],
  'Altura do triângulo equilátero': [
    { symbol: 'h', meaning: 'altura' },
    { symbol: '\\ell', meaning: 'lado' },
  ],
  'Soma dos ângulos internos': [
    { symbol: 'S_i', meaning: 'soma dos ângulos internos' },
    { symbol: 'n', meaning: 'número de lados do polígono' },
  ],
  'Número de diagonais': [
    { symbol: 'd', meaning: 'número de diagonais' },
    { symbol: 'n', meaning: 'número de lados do polígono' },
  ],
  'Teorema de Tales': [
    {
      symbol: 'a, b',
      meaning: 'segmentos que as paralelas marcam numa transversal',
    },
    {
      symbol: 'c, d',
      meaning: 'segmentos correspondentes na outra transversal',
    },
  ],
  'Razão de semelhança (áreas)': [
    { symbol: 'A_1, A_2', meaning: 'áreas das duas figuras semelhantes' },
    { symbol: 'k', meaning: 'razão entre lados correspondentes' },
  ],
  Tangente: [
    { symbol: '\\theta', meaning: 'ângulo agudo de referência' },
    { symbol: 'co', meaning: 'cateto oposto ao ângulo' },
    { symbol: 'ca', meaning: 'cateto adjacente ao ângulo' },
  ],
  'Relação fundamental da trigonometria': [
    { symbol: '\\theta', meaning: 'qualquer ângulo' },
  ],
  'Lei dos cossenos': [
    { symbol: 'a', meaning: 'lado oposto ao ângulo A' },
    { symbol: 'b, c', meaning: 'os outros dois lados' },
    { symbol: 'A', meaning: 'ângulo entre os lados b e c' },
  ],
  'Volume do prisma': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'A_b', meaning: 'área da base' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Volume do paralelepípedo': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'a, b, c', meaning: 'comprimento, largura e altura' },
  ],
  'Volume do cubo': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'a', meaning: 'aresta' },
  ],
  'Volume da pirâmide': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'A_b', meaning: 'área da base' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Volume do cone': [
    { symbol: 'V', meaning: 'volume' },
    { symbol: 'r', meaning: 'raio da base' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Área da superfície esférica': [
    { symbol: 'A', meaning: 'área da superfície' },
    { symbol: 'r', meaning: 'raio da esfera' },
  ],
  'Área lateral do cilindro': [
    { symbol: 'A_\\ell', meaning: 'área lateral' },
    { symbol: 'r', meaning: 'raio da base' },
    { symbol: 'h', meaning: 'altura' },
  ],
  'Diagonal do cubo': [
    { symbol: 'D', meaning: 'diagonal do cubo' },
    { symbol: 'a', meaning: 'aresta' },
  ],
  'Diagonal do paralelepípedo': [
    { symbol: 'D', meaning: 'diagonal do paralelepípedo' },
    { symbol: 'a, b, c', meaning: 'comprimento, largura e altura' },
  ],
  'Relação de Euler': [
    { symbol: 'V', meaning: 'número de vértices' },
    { symbol: 'A', meaning: 'número de arestas' },
    { symbol: 'F', meaning: 'número de faces' },
  ],
  'Distância entre dois pontos': [
    { symbol: 'd', meaning: 'distância entre os pontos' },
    { symbol: 'x_1, y_1', meaning: 'coordenadas do primeiro ponto' },
    { symbol: 'x_2, y_2', meaning: 'coordenadas do segundo ponto' },
  ],
  'Ponto médio': [
    { symbol: 'M', meaning: 'ponto médio do segmento' },
    { symbol: 'x_1, y_1', meaning: 'coordenadas de uma extremidade' },
    { symbol: 'x_2, y_2', meaning: 'coordenadas da outra extremidade' },
  ],
  'Equação da circunferência': [
    { symbol: 'a, b', meaning: 'coordenadas do centro' },
    { symbol: 'r', meaning: 'raio' },
    { symbol: 'x, y', meaning: 'coordenadas de um ponto da circunferência' },
  ],
  'PG: soma infinita': [
    { symbol: 'S_\\infty', meaning: 'soma de todos os termos da PG' },
    { symbol: 'a_1', meaning: 'primeiro termo' },
    { symbol: 'q', meaning: 'razão, entre −1 e 1' },
  ],
  'Determinante 2×2': [
    { symbol: 'a, d', meaning: 'diagonal principal' },
    { symbol: 'b, c', meaning: 'diagonal secundária' },
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
  Peso: [
    {
      symbol: 'P',
      meaning: 'peso: a força com que a Terra atrai o corpo',
      unit: 'N',
    },
    { symbol: 'm', meaning: 'massa do corpo', unit: 'kg' },
    {
      symbol: 'g',
      meaning: 'aceleração da gravidade (≈ 10 na Terra)',
      unit: 'm/s²',
    },
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
      meaning: 'potência: energia entregue por unidade de tempo',
      unit: 'W',
    },
    { symbol: 'E', meaning: 'energia (ou trabalho) envolvida', unit: 'J' },
    { symbol: 't', meaning: 'tempo', unit: 's' },
  ],
  'Potência elétrica': [
    {
      symbol: 'P_{\\text{el}}',
      meaning: 'potência elétrica dissipada',
      unit: 'W',
    },
    { symbol: 'U', meaning: 'tensão (ddp)', unit: 'V' },
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
  ],
  'Energia cinética': [
    { symbol: 'E_c', meaning: 'energia cinética: a do movimento', unit: 'J' },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
  ],
  'Energia potencial gravitacional': [
    {
      symbol: 'E_p',
      meaning: 'energia potencial gravitacional: a da altura',
      unit: 'J',
    },
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
    {
      symbol: 'R_1, R_2',
      meaning: 'resistências dos resistores associados',
      unit: 'Ω',
    },
  ],
  'Resistores em paralelo': [
    { symbol: 'R_{\\text{eq}}', meaning: 'resistência equivalente', unit: 'Ω' },
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
    {
      symbol: '\\Delta\\theta',
      meaning: 'variação de temperatura',
      unit: '°C',
    },
  ],
  'Calor sensível': [
    {
      symbol: 'Q',
      meaning: 'calor trocado — só muda a temperatura, não o estado físico',
      unit: 'cal ou J',
    },
    { symbol: 'm', meaning: 'massa', unit: 'g ou kg' },
    { symbol: 'c', meaning: 'calor específico do material', unit: 'cal/g·°C' },
    {
      symbol: '\\Delta\\theta',
      meaning: 'variação de temperatura',
      unit: '°C',
    },
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
  'Aceleração média': [
    { symbol: '\\bar{a}', meaning: 'aceleração média', unit: 'm/s²' },
    { symbol: '\\Delta v', meaning: 'variação da velocidade', unit: 'm/s' },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo', unit: 's' },
  ],
  'Queda livre': [
    { symbol: 'h', meaning: 'altura percorrida na queda', unit: 'm' },
    {
      symbol: 'g',
      meaning: 'aceleração da gravidade (≈ 10 na Terra)',
      unit: 'm/s²',
    },
    { symbol: 't', meaning: 'tempo de queda', unit: 's' },
  ],
  'Velocidade angular': [
    { symbol: '\\omega', meaning: 'velocidade angular', unit: 'rad/s' },
    { symbol: 'T', meaning: 'período: tempo de uma volta completa', unit: 's' },
  ],
  'Velocidade linear (MCU)': [
    {
      symbol: 'v',
      meaning: 'velocidade linear (tangente à trajetória)',
      unit: 'm/s',
    },
    { symbol: '\\omega', meaning: 'velocidade angular', unit: 'rad/s' },
    { symbol: 'R', meaning: 'raio da trajetória', unit: 'm' },
  ],
  'Aceleração centrípeta': [
    { symbol: 'a_c', meaning: 'aceleração centrípeta', unit: 'm/s²' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
    { symbol: 'R', meaning: 'raio da curva', unit: 'm' },
  ],
  'Força centrípeta': [
    {
      symbol: 'F_c',
      meaning: 'força resultante apontada para o centro',
      unit: 'N',
    },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
    { symbol: 'R', meaning: 'raio da curva', unit: 'm' },
  ],
  'Força de atrito': [
    {
      symbol: 'F_{\\text{at}}',
      meaning: 'força de atrito, contrária ao deslizamento',
      unit: 'N',
    },
    { symbol: '\\mu', meaning: 'coeficiente de atrito entre as superfícies' },
    {
      symbol: 'N',
      meaning: 'força normal: a que a superfície faz no corpo',
      unit: 'N',
    },
  ],
  'Força elástica (Lei de Hooke)': [
    { symbol: 'F_{\\text{el}}', meaning: 'força que a mola faz', unit: 'N' },
    {
      symbol: 'k',
      meaning: 'constante elástica: a rigidez da mola',
      unit: 'N/m',
    },
    {
      symbol: 'x',
      meaning: 'deformação: quanto a mola esticou ou encolheu',
      unit: 'm',
    },
  ],
  'Plano inclinado: componente do peso': [
    {
      symbol: 'P_x',
      meaning: 'componente do peso paralela ao plano',
      unit: 'N',
    },
    { symbol: 'P', meaning: 'peso do corpo', unit: 'N' },
    {
      symbol: '\\theta',
      meaning: 'inclinação do plano em relação à horizontal',
    },
  ],
  'Plano inclinado: força normal': [
    { symbol: 'N', meaning: 'força normal', unit: 'N' },
    { symbol: 'P', meaning: 'peso do corpo', unit: 'N' },
    {
      symbol: '\\theta',
      meaning: 'inclinação do plano em relação à horizontal',
    },
  ],
  'Energia potencial elástica': [
    {
      symbol: 'E_{\\text{el}}',
      meaning: 'energia guardada na mola deformada',
      unit: 'J',
    },
    { symbol: 'k', meaning: 'constante elástica da mola', unit: 'N/m' },
    { symbol: 'x', meaning: 'deformação da mola', unit: 'm' },
  ],
  'Teorema da energia cinética': [
    {
      symbol: '\\tau_{\\text{total}}',
      meaning: 'trabalho da força resultante',
      unit: 'J',
    },
    {
      symbol: '\\Delta E_c',
      meaning: 'variação da energia cinética',
      unit: 'J',
    },
  ],
  'Potência (força e velocidade)': [
    { symbol: 'P', meaning: 'potência', unit: 'W' },
    { symbol: 'F', meaning: 'força na direção do movimento', unit: 'N' },
    { symbol: 'v', meaning: 'velocidade', unit: 'm/s' },
  ],
  Rendimento: [
    { symbol: '\\eta', meaning: 'rendimento' },
    { symbol: 'P_{\\text{útil}}', meaning: 'potência aproveitada', unit: 'W' },
    { symbol: 'P_{\\text{total}}', meaning: 'potência recebida', unit: 'W' },
  ],
  'Energia elétrica consumida': [
    { symbol: 'E', meaning: 'energia consumida', unit: 'J ou kWh' },
    { symbol: 'P', meaning: 'potência do aparelho', unit: 'W ou kW' },
    { symbol: '\\Delta t', meaning: 'tempo de uso', unit: 's ou h' },
  ],
  Impulso: [
    { symbol: 'I', meaning: 'impulso', unit: 'N·s' },
    { symbol: 'F', meaning: 'força aplicada', unit: 'N' },
    { symbol: '\\Delta t', meaning: 'tempo de aplicação da força', unit: 's' },
  ],
  'Teorema do impulso': [
    { symbol: 'I', meaning: 'impulso da força resultante', unit: 'N·s' },
    {
      symbol: '\\Delta Q',
      meaning: 'variação da quantidade de movimento',
      unit: 'kg·m/s',
    },
  ],
  'Conservação da quantidade de movimento': [
    {
      symbol: 'Q_{\\text{antes}}',
      meaning: 'soma das quantidades de movimento antes do choque',
      unit: 'kg·m/s',
    },
    {
      symbol: 'Q_{\\text{depois}}',
      meaning: 'soma das quantidades de movimento depois',
      unit: 'kg·m/s',
    },
  ],
  'Lei da gravitação universal': [
    { symbol: 'F', meaning: 'força de atração entre os corpos', unit: 'N' },
    {
      symbol: 'G',
      meaning: 'constante gravitacional ≈ 6,7 × 10⁻¹¹',
      unit: 'N·m²/kg²',
    },
    { symbol: 'M, m', meaning: 'massas dos dois corpos', unit: 'kg' },
    { symbol: 'd', meaning: 'distância entre os centros', unit: 'm' },
  ],
  '3ª Lei de Kepler': [
    { symbol: 'T', meaning: 'período da órbita', unit: 's' },
    { symbol: 'R', meaning: 'raio médio da órbita', unit: 'm' },
    { symbol: 'k', meaning: 'constante do sistema' },
  ],
  Pressão: [
    { symbol: 'p', meaning: 'pressão', unit: 'Pa = N/m²' },
    { symbol: 'F', meaning: 'força perpendicular à superfície', unit: 'N' },
    { symbol: 'A', meaning: 'área de contato', unit: 'm²' },
  ],
  'Pressão hidrostática (Stevin)': [
    { symbol: 'p', meaning: 'pressão na profundidade h', unit: 'Pa' },
    {
      symbol: 'p_0',
      meaning: 'pressão na superfície (atmosférica)',
      unit: 'Pa',
    },
    { symbol: 'd', meaning: 'densidade do líquido', unit: 'kg/m³' },
    { symbol: 'g', meaning: 'aceleração da gravidade', unit: 'm/s²' },
    { symbol: 'h', meaning: 'profundidade', unit: 'm' },
  ],
  'Empuxo (Arquimedes)': [
    { symbol: 'E', meaning: 'empuxo: força do líquido para cima', unit: 'N' },
    {
      symbol: 'd_{\\text{líq}}',
      meaning: 'densidade do líquido',
      unit: 'kg/m³',
    },
    {
      symbol: 'V_{\\text{sub}}',
      meaning: 'volume submerso do corpo',
      unit: 'm³',
    },
    { symbol: 'g', meaning: 'aceleração da gravidade', unit: 'm/s²' },
  ],
  'Princípio de Pascal (prensa hidráulica)': [
    { symbol: 'F_1, F_2', meaning: 'forças em cada êmbolo', unit: 'N' },
    { symbol: 'A_1, A_2', meaning: 'áreas dos êmbolos', unit: 'm²' },
  ],
  'Equação fundamental da ondulatória': [
    { symbol: 'v', meaning: 'velocidade de propagação da onda', unit: 'm/s' },
    { symbol: '\\lambda', meaning: 'comprimento de onda', unit: 'm' },
    { symbol: 'f', meaning: 'frequência', unit: 'Hz' },
  ],
  'Período e frequência': [
    { symbol: 'f', meaning: 'frequência: oscilações por segundo', unit: 'Hz' },
    { symbol: 'T', meaning: 'período: tempo de uma oscilação', unit: 's' },
  ],
  'Nível de intensidade sonora': [
    { symbol: '\\beta', meaning: 'nível sonoro', unit: 'dB' },
    { symbol: 'I', meaning: 'intensidade do som', unit: 'W/m²' },
    { symbol: 'I_0', meaning: 'limiar da audição: 10⁻¹²', unit: 'W/m²' },
  ],
  'Índice de refração': [
    { symbol: 'n', meaning: 'índice de refração absoluto do meio' },
    { symbol: 'c', meaning: 'velocidade da luz no vácuo', unit: 'm/s' },
    { symbol: 'v', meaning: 'velocidade da luz no meio', unit: 'm/s' },
  ],
  'Lei de Snell': [
    { symbol: 'n_1, n_2', meaning: 'índices de refração dos dois meios' },
    { symbol: '\\theta_1', meaning: 'ângulo de incidência' },
    { symbol: '\\theta_2', meaning: 'ângulo de refração' },
  ],
  'Equação de Gauss': [
    { symbol: 'f', meaning: 'distância focal', unit: 'm' },
    {
      symbol: 'p',
      meaning: 'distância do objeto ao espelho ou lente',
      unit: 'm',
    },
    {
      symbol: "p'",
      meaning: 'distância da imagem ao espelho ou lente',
      unit: 'm',
    },
  ],
  'Aumento linear': [
    { symbol: 'A', meaning: 'aumento linear' },
    { symbol: 'i, o', meaning: 'altura da imagem e do objeto', unit: 'm' },
    { symbol: "p, p'", meaning: 'distâncias do objeto e da imagem', unit: 'm' },
  ],
  'Vergência (grau da lente)': [
    { symbol: 'V', meaning: 'vergência', unit: 'di' },
    {
      symbol: 'f',
      meaning: 'distância focal (negativa na lente divergente)',
      unit: 'm',
    },
  ],
  'Imagens em espelhos planos associados': [
    { symbol: 'n', meaning: 'número de imagens formadas' },
    { symbol: '\\alpha', meaning: 'ângulo entre os espelhos' },
  ],
  'Lei de Coulomb': [
    { symbol: 'F', meaning: 'força elétrica entre as cargas', unit: 'N' },
    {
      symbol: 'k',
      meaning: 'constante eletrostática do meio',
      unit: 'N·m²/C²',
    },
    { symbol: 'Q, q', meaning: 'cargas', unit: 'C' },
    { symbol: 'd', meaning: 'distância entre as cargas', unit: 'm' },
  ],
  'Campo elétrico': [
    { symbol: 'E', meaning: 'intensidade do campo elétrico', unit: 'N/C' },
    {
      symbol: 'F',
      meaning: 'força elétrica sobre a carga de prova',
      unit: 'N',
    },
    { symbol: 'q', meaning: 'carga de prova', unit: 'C' },
  ],
  'Carga elétrica (quantização)': [
    { symbol: 'Q', meaning: 'carga do corpo', unit: 'C' },
    { symbol: 'n', meaning: 'número de elétrons a mais ou a menos' },
    { symbol: 'e', meaning: 'carga elementar', unit: 'C' },
  ],
  'Corrente elétrica': [
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
    { symbol: '\\Delta Q', meaning: 'carga que atravessa o fio', unit: 'C' },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo', unit: 's' },
  ],
  '2ª Lei de Ohm': [
    { symbol: 'R', meaning: 'resistência do fio', unit: 'Ω' },
    { symbol: '\\rho', meaning: 'resistividade do material', unit: 'Ω·m' },
    { symbol: 'L', meaning: 'comprimento do fio', unit: 'm' },
    { symbol: 'A', meaning: 'área da seção transversal', unit: 'm²' },
  ],
  'Potência dissipada (corrente)': [
    { symbol: 'P', meaning: 'potência dissipada no resistor', unit: 'W' },
    { symbol: 'R', meaning: 'resistência', unit: 'Ω' },
    { symbol: 'i', meaning: 'corrente', unit: 'A' },
  ],
  'Potência dissipada (tensão)': [
    { symbol: 'P', meaning: 'potência dissipada no resistor', unit: 'W' },
    { symbol: 'U', meaning: 'tensão nos terminais', unit: 'V' },
    { symbol: 'R', meaning: 'resistência', unit: 'Ω' },
  ],
  'Força magnética sobre carga': [
    { symbol: 'F', meaning: 'força magnética', unit: 'N' },
    { symbol: 'q', meaning: 'carga em movimento', unit: 'C' },
    { symbol: 'v', meaning: 'velocidade da carga', unit: 'm/s' },
    { symbol: 'B', meaning: 'campo magnético', unit: 'T' },
    { symbol: '\\theta', meaning: 'ângulo entre a velocidade e o campo' },
  ],
  'Força magnética sobre fio': [
    { symbol: 'F', meaning: 'força magnética', unit: 'N' },
    { symbol: 'B', meaning: 'campo magnético', unit: 'T' },
    { symbol: 'i', meaning: 'corrente no fio', unit: 'A' },
    { symbol: 'L', meaning: 'comprimento do fio dentro do campo', unit: 'm' },
    { symbol: '\\theta', meaning: 'ângulo entre o fio e o campo' },
  ],
  'Lei de Faraday': [
    {
      symbol: '\\varepsilon',
      meaning: 'força eletromotriz induzida',
      unit: 'V',
    },
    {
      symbol: '\\Delta\\Phi',
      meaning: 'variação do fluxo magnético',
      unit: 'Wb',
    },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo', unit: 's' },
  ],
  Transformador: [
    {
      symbol: 'U_1, U_2',
      meaning: 'tensões no primário e no secundário',
      unit: 'V',
    },
    { symbol: 'N_1, N_2', meaning: 'número de espiras de cada bobina' },
  ],
  'Equação de Clapeyron': [
    { symbol: 'p', meaning: 'pressão do gás', unit: 'atm ou Pa' },
    { symbol: 'V', meaning: 'volume', unit: 'L ou m³' },
    { symbol: 'n', meaning: 'número de mols', unit: 'mol' },
    {
      symbol: 'R',
      meaning: 'constante dos gases: 0,082 atm·L/(mol·K) ou 8,31 J/(mol·K)',
    },
    { symbol: 'T', meaning: 'temperatura absoluta', unit: 'K' },
  ],
  'Lei geral dos gases': [
    {
      symbol: 'p_1, V_1, T_1',
      meaning: 'pressão, volume e temperatura no início',
    },
    {
      symbol: 'p_2, V_2, T_2',
      meaning: 'pressão, volume e temperatura no fim',
    },
  ],
  '1ª Lei da Termodinâmica': [
    {
      symbol: '\\Delta U',
      meaning: 'variação da energia interna do gás',
      unit: 'J',
    },
    { symbol: 'Q', meaning: 'calor recebido (positivo) ou cedido', unit: 'J' },
    { symbol: '\\tau', meaning: 'trabalho realizado pelo gás', unit: 'J' },
  ],
  'Trabalho de um gás (pressão constante)': [
    { symbol: '\\tau', meaning: 'trabalho do gás', unit: 'J' },
    { symbol: 'p', meaning: 'pressão, constante', unit: 'Pa' },
    { symbol: '\\Delta V', meaning: 'variação de volume', unit: 'm³' },
  ],
  'Rendimento da máquina térmica': [
    { symbol: '\\eta', meaning: 'rendimento' },
    { symbol: '\\tau', meaning: 'trabalho útil por ciclo', unit: 'J' },
    { symbol: 'Q_q', meaning: 'calor retirado da fonte quente', unit: 'J' },
    { symbol: 'Q_f', meaning: 'calor rejeitado para a fonte fria', unit: 'J' },
  ],
  'Rendimento de Carnot': [
    { symbol: '\\eta', meaning: 'rendimento máximo' },
    { symbol: 'T_f', meaning: 'temperatura da fonte fria', unit: 'K' },
    { symbol: 'T_q', meaning: 'temperatura da fonte quente', unit: 'K' },
  ],
  'Dilatação térmica superficial': [
    { symbol: '\\Delta A', meaning: 'variação da área', unit: 'm²' },
    { symbol: 'A_0', meaning: 'área inicial', unit: 'm²' },
    {
      symbol: '\\beta',
      meaning: 'coeficiente de dilatação superficial',
      unit: '°C⁻¹',
    },
    {
      symbol: '\\Delta\\theta',
      meaning: 'variação de temperatura',
      unit: '°C',
    },
  ],
  'Dilatação térmica volumétrica': [
    { symbol: '\\Delta V', meaning: 'variação do volume', unit: 'm³' },
    { symbol: 'V_0', meaning: 'volume inicial', unit: 'm³' },
    {
      symbol: '\\gamma',
      meaning: 'coeficiente de dilatação volumétrica',
      unit: '°C⁻¹',
    },
    {
      symbol: '\\Delta\\theta',
      meaning: 'variação de temperatura',
      unit: '°C',
    },
  ],
  'Celsius ↔ Fahrenheit': [
    { symbol: 'T_C', meaning: 'temperatura em Celsius', unit: '°C' },
    { symbol: 'T_F', meaning: 'temperatura em Fahrenheit', unit: '°F' },
  ],
  'Fluxo de calor (condução)': [
    {
      symbol: '\\Phi',
      meaning: 'fluxo de calor: calor por unidade de tempo',
      unit: 'W',
    },
    {
      symbol: 'k',
      meaning: 'condutividade térmica do material',
      unit: 'W/(m·K)',
    },
    { symbol: 'A', meaning: 'área da parede', unit: 'm²' },
    {
      symbol: '\\Delta\\theta',
      meaning: 'diferença de temperatura entre as faces',
      unit: '°C',
    },
    { symbol: 'L', meaning: 'espessura da parede', unit: 'm' },
  ],
  'Capacidade térmica': [
    { symbol: 'C', meaning: 'capacidade térmica do corpo', unit: 'cal/°C' },
    { symbol: 'Q', meaning: 'calor trocado', unit: 'cal' },
    {
      symbol: '\\Delta\\theta',
      meaning: 'variação de temperatura',
      unit: '°C',
    },
    { symbol: 'm', meaning: 'massa', unit: 'g' },
    { symbol: 'c', meaning: 'calor específico', unit: 'cal/g·°C' },
  ],
  'Trocas de calor (sistema isolado)': [
    {
      symbol: '\\sum Q',
      meaning: 'soma de todos os calores trocados',
      unit: 'cal ou J',
    },
  ],
  'Energia do fóton': [
    { symbol: 'E', meaning: 'energia de um fóton', unit: 'J' },
    { symbol: 'h', meaning: 'constante de Planck', unit: 'J·s' },
    { symbol: 'f', meaning: 'frequência da radiação', unit: 'Hz' },
  ],
  'Equivalência massa-energia': [
    { symbol: 'E', meaning: 'energia equivalente à massa', unit: 'J' },
    { symbol: 'm', meaning: 'massa', unit: 'kg' },
    { symbol: 'c', meaning: 'velocidade da luz ≈ 3 × 10⁸', unit: 'm/s' },
  ],

  // ---- Química ----
  Densidade: [
    { symbol: 'd', meaning: 'densidade', unit: 'g/cm³ ou g/L' },
    { symbol: 'm', meaning: 'massa da amostra', unit: 'g' },
    { symbol: 'V', meaning: 'volume ocupado', unit: 'cm³ ou L' },
  ],
  'Concentração comum': [
    { symbol: 'C', meaning: 'concentração comum', unit: 'g/L' },
    {
      symbol: 'm_{\\text{soluto}}',
      meaning: 'massa do soluto dissolvido',
      unit: 'g',
    },
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
    {
      symbol: 'n_{\\text{mol}}',
      meaning: 'número de mols do soluto',
      unit: 'mol',
    },
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
  'Número de massa': [
    { symbol: 'A', meaning: 'número de massa: prótons mais nêutrons' },
    { symbol: 'Z', meaning: 'número atômico: quantidade de prótons' },
    { symbol: 'N', meaning: 'quantidade de nêutrons' },
  ],
  Diluição: [
    { symbol: 'C_1, V_1', meaning: 'concentração e volume antes de diluir' },
    { symbol: 'C_2, V_2', meaning: 'concentração e volume depois' },
  ],
  'Mistura de soluções (mesmo soluto)': [
    { symbol: 'C_f, V_f', meaning: 'concentração e volume da mistura' },
    {
      symbol: 'C_1, V_1',
      meaning: 'concentração e volume da primeira solução',
    },
    { symbol: 'C_2, V_2', meaning: 'concentração e volume da segunda solução' },
  ],
  'Concentração comum pela molar': [
    { symbol: 'C', meaning: 'concentração comum', unit: 'g/L' },
    { symbol: 'M', meaning: 'concentração molar', unit: 'mol/L' },
    { symbol: 'MM', meaning: 'massa molar do soluto', unit: 'g/mol' },
  ],
  'Concentração comum pelo título': [
    { symbol: 'C', meaning: 'concentração comum', unit: 'g/L' },
    { symbol: 'd', meaning: 'densidade da solução', unit: 'g/mL' },
    { symbol: '\\tau', meaning: 'título em massa, de 0 a 1' },
  ],
  'Partes por milhão (ppm)': [
    {
      symbol: '\\text{ppm}',
      meaning: 'partes de soluto em um milhão de partes de solução',
    },
    { symbol: 'm_{\\text{soluto}}', meaning: 'massa do soluto', unit: 'g' },
    { symbol: 'm_{\\text{solução}}', meaning: 'massa da solução', unit: 'g' },
  ],
  'Constante de equilíbrio': [
    { symbol: 'K_c', meaning: 'constante de equilíbrio em concentração' },
    {
      symbol: '[A], [B]',
      meaning: 'concentrações dos reagentes no equilíbrio',
      unit: 'mol/L',
    },
    {
      symbol: '[C], [D]',
      meaning: 'concentrações dos produtos no equilíbrio',
      unit: 'mol/L',
    },
    { symbol: 'a, b, c, d', meaning: 'coeficientes da equação balanceada' },
  ],
  'Lei de diluição de Ostwald': [
    { symbol: 'K_i', meaning: 'constante de ionização' },
    { symbol: '\\alpha', meaning: 'grau de ionização, em decimal' },
    { symbol: 'M', meaning: 'concentração molar do eletrólito', unit: 'mol/L' },
  ],
  pH: [
    { symbol: '\\text{pH}', meaning: 'potencial hidrogeniônico' },
    {
      symbol: '[\\text{H}^+]',
      meaning: 'concentração de íons H⁺',
      unit: 'mol/L',
    },
  ],
  pOH: [
    { symbol: '\\text{pOH}', meaning: 'potencial hidroxiliônico' },
    {
      symbol: '[\\text{OH}^-]',
      meaning: 'concentração de íons OH⁻',
      unit: 'mol/L',
    },
  ],
  'Relação entre pH e pOH': [
    { symbol: '\\text{pH}', meaning: 'potencial hidrogeniônico' },
    { symbol: '\\text{pOH}', meaning: 'potencial hidroxiliônico' },
  ],
  'Produto iônico da água': [
    { symbol: 'K_w', meaning: 'produto iônico da água' },
    {
      symbol: '[\\text{H}^+]',
      meaning: 'concentração de íons H⁺',
      unit: 'mol/L',
    },
    {
      symbol: '[\\text{OH}^-]',
      meaning: 'concentração de íons OH⁻',
      unit: 'mol/L',
    },
  ],
  'Variação de entalpia': [
    {
      symbol: '\\Delta H',
      meaning: 'variação de entalpia da reação',
      unit: 'kJ/mol',
    },
    {
      symbol: 'H_{\\text{produtos}}',
      meaning: 'entalpia dos produtos',
      unit: 'kJ/mol',
    },
    {
      symbol: 'H_{\\text{reagentes}}',
      meaning: 'entalpia dos reagentes',
      unit: 'kJ/mol',
    },
  ],
  'Lei de Hess': [
    {
      symbol: '\\Delta H',
      meaning: 'variação de entalpia da reação global',
      unit: 'kJ/mol',
    },
    {
      symbol: '\\Delta H_1, \\Delta H_2',
      meaning: 'ΔH de cada etapa, já ajustado',
      unit: 'kJ/mol',
    },
  ],
  'Energia de ligação': [
    {
      symbol: '\\Delta H',
      meaning: 'variação de entalpia da reação',
      unit: 'kJ/mol',
    },
    {
      symbol: '\\sum E_{\\text{quebradas}}',
      meaning: 'soma das energias das ligações rompidas nos reagentes',
      unit: 'kJ/mol',
    },
    {
      symbol: '\\sum E_{\\text{formadas}}',
      meaning: 'soma das energias das ligações criadas nos produtos',
      unit: 'kJ/mol',
    },
  ],
  'Velocidade média de reação': [
    { symbol: 'v_m', meaning: 'velocidade média', unit: 'mol/(L·s)' },
    {
      symbol: '\\Delta [X]',
      meaning: 'variação da concentração de um participante',
      unit: 'mol/L',
    },
    { symbol: '\\Delta t', meaning: 'intervalo de tempo', unit: 's' },
  ],
  'Lei da velocidade': [
    { symbol: 'v', meaning: 'velocidade da reação', unit: 'mol/(L·s)' },
    {
      symbol: 'k',
      meaning: 'constante de velocidade (muda com a temperatura)',
    },
    {
      symbol: '[A], [B]',
      meaning: 'concentrações dos reagentes',
      unit: 'mol/L',
    },
    { symbol: 'a, b', meaning: 'ordens da reação em cada reagente' },
  ],
  'Diferença de potencial da pilha': [
    { symbol: '\\Delta E^\\circ', meaning: 'ddp da pilha', unit: 'V' },
    {
      symbol: 'E^\\circ_{\\text{red, cátodo}}',
      meaning: 'potencial de redução de quem reduz (polo positivo)',
      unit: 'V',
    },
    {
      symbol: 'E^\\circ_{\\text{red, ânodo}}',
      meaning: 'potencial de redução de quem oxida (polo negativo)',
      unit: 'V',
    },
  ],
  'Carga na eletrólise': [
    { symbol: 'Q', meaning: 'carga que passou pelo circuito', unit: 'C' },
    { symbol: 'i', meaning: 'corrente elétrica', unit: 'A' },
    { symbol: 't', meaning: 'tempo', unit: 's' },
  ],
  'Constante de Faraday': [
    { symbol: 'Q', meaning: 'carga elétrica', unit: 'C' },
    { symbol: 'n_e', meaning: 'mols de elétrons', unit: 'mol' },
    { symbol: 'F', meaning: 'constante de Faraday ≈ 96 500', unit: 'C/mol' },
  ],
  'Meia-vida': [
    { symbol: 'm', meaning: 'massa que ainda resta', unit: 'g' },
    { symbol: 'm_0', meaning: 'massa inicial', unit: 'g' },
    { symbol: 'n', meaning: 'número de meias-vidas passadas' },
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
  'Balanço populacional': [
    { symbol: '\\Delta N', meaning: 'variação no número de indivíduos' },
    { symbol: 'N_{\\text{nat}}', meaning: 'nascimentos (natalidade)' },
    { symbol: 'I', meaning: 'imigrantes' },
    { symbol: 'M', meaning: 'mortes (mortalidade)' },
    { symbol: 'E', meaning: 'emigrantes' },
  ],
  'Produtividade primária líquida': [
    { symbol: 'PPL', meaning: 'produtividade primária líquida' },
    {
      symbol: 'PPB',
      meaning: 'produtividade primária bruta: tudo o que a fotossíntese produz',
    },
    { symbol: 'R', meaning: 'o que os produtores gastam na respiração' },
  ],
  'Eficiência ecológica': [
    {
      symbol: '\\text{Ef}',
      meaning: 'eficiência da transferência de energia',
      unit: '%',
    },
    {
      symbol: 'E_{n+1}',
      meaning: 'energia que chega ao nível trófico seguinte',
    },
    { symbol: 'E_n', meaning: 'energia disponível no nível trófico anterior' },
  ],
  'Número de tipos de gametas': [
    { symbol: 'G', meaning: 'tipos diferentes de gameta' },
    { symbol: 'n', meaning: 'número de pares de genes em heterozigose' },
  ],
  'Índice de massa corporal (IMC)': [
    {
      symbol: '\\text{IMC}',
      meaning: 'índice de massa corporal',
      unit: 'kg/m²',
    },
    { symbol: 'm', meaning: 'massa da pessoa', unit: 'kg' },
    { symbol: 'h', meaning: 'altura', unit: 'm' },
  ],

  // ---- Geografia ----
  'Densidade demográfica': [
    { symbol: 'D', meaning: 'densidade demográfica', unit: 'hab/km²' },
    { symbol: '\\text{população}', meaning: 'número de habitantes' },
    { symbol: '\\text{área}', meaning: 'área do território', unit: 'km²' },
  ],
  'Crescimento vegetativo': [
    { symbol: 'CV', meaning: 'crescimento vegetativo (natural)', unit: '‰' },
    { symbol: 'TN', meaning: 'taxa de natalidade', unit: '‰' },
    { symbol: 'TM', meaning: 'taxa de mortalidade', unit: '‰' },
  ],
  'Fuso horário': [
    {
      symbol: '\\Delta h',
      meaning: 'diferença de horas entre os dois lugares',
      unit: 'h',
    },
    { symbol: '\\Delta\\lambda', meaning: 'diferença de longitude entre eles' },
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
  Semiperímetro: 'Áreas e perímetros',
  'Área do círculo': 'Áreas e perímetros',
  'Comprimento da circunferência': 'Áreas e perímetros',
  'Teorema de Pitágoras': 'Geometria plana',
  'Volume do cilindro': 'Volumes',
  'Volume da esfera': 'Volumes',
  Seno: 'Trigonometria',
  Cosseno: 'Trigonometria',
  'Lei dos senos': 'Trigonometria',
  'PA: termo geral': 'Progressão aritmética',
  'PA: soma dos termos': 'Progressão aritmética',
  'PG: termo geral': 'Progressão geométrica',
  'PG: soma dos termos': 'Progressão geométrica',
  Combinação: 'Análise combinatória',
  Probabilidade: 'Probabilidade',
  'Probabilidade do complementar': 'Probabilidade',
  'Probabilidade da união': 'Probabilidade',
  'Probabilidade condicional': 'Probabilidade',
  'Eventos independentes': 'Probabilidade',
  'Permutação simples': 'Análise combinatória',
  'Arranjo simples': 'Análise combinatória',
  'Permutação com repetição': 'Análise combinatória',
  'Aumentos e descontos sucessivos': 'Porcentagem',
  Escala: 'Razão e proporção',
  'Função afim': 'Função afim',
  'Coeficiente angular': 'Função afim',
  'Abscissa do vértice': 'Função quadrática',
  'Ordenada do vértice': 'Função quadrática',
  'Função exponencial': 'Função exponencial',
  'Definição de logaritmo': 'Função logarítmica',
  'Logaritmo do produto': 'Função logarítmica',
  'Logaritmo do quociente': 'Função logarítmica',
  'Logaritmo da potência': 'Função logarítmica',
  'Mudança de base': 'Função logarítmica',
  'Média aritmética': 'Média, mediana e moda',
  'Média ponderada': 'Média, mediana e moda',
  'Posição da mediana': 'Média, mediana e moda',
  Variância: 'Estatística',
  'Desvio padrão': 'Estatística',
  'Área do retângulo': 'Áreas e perímetros',
  'Área do quadrado': 'Áreas e perímetros',
  'Área do trapézio': 'Áreas e perímetros',
  'Área do losango': 'Áreas e perímetros',
  'Área do triângulo equilátero': 'Áreas e perímetros',
  'Área do triângulo (seno)': 'Áreas e perímetros',
  'Área do hexágono regular': 'Áreas e perímetros',
  'Área do setor circular': 'Áreas e perímetros',
  'Comprimento de arco': 'Áreas e perímetros',
  'Altura do triângulo equilátero': 'Geometria plana',
  'Soma dos ângulos internos': 'Geometria plana',
  'Número de diagonais': 'Geometria plana',
  'Teorema de Tales': 'Geometria plana',
  'Razão de semelhança (áreas)': 'Geometria plana',
  Tangente: 'Trigonometria',
  'Relação fundamental da trigonometria': 'Trigonometria',
  'Lei dos cossenos': 'Trigonometria',
  'Volume do prisma': 'Volumes',
  'Volume do paralelepípedo': 'Volumes',
  'Volume do cubo': 'Volumes',
  'Volume da pirâmide': 'Volumes',
  'Volume do cone': 'Volumes',
  'Área da superfície esférica': 'Geometria espacial',
  'Área lateral do cilindro': 'Geometria espacial',
  'Diagonal do cubo': 'Geometria espacial',
  'Diagonal do paralelepípedo': 'Geometria espacial',
  'Relação de Euler': 'Geometria espacial',
  'Distância entre dois pontos': 'Geometria analítica',
  'Ponto médio': 'Geometria analítica',
  'Equação da circunferência': 'Geometria analítica',
  'PG: soma infinita': 'Progressão geométrica',
  'Determinante 2×2': 'Matrizes e determinantes',

  // ---- Física ----
  'Velocidade média': 'Cinemática',
  'Função horária (MRU)': 'Cinemática',
  'Função horária da posição (MUV)': 'Cinemática',
  'Função horária da velocidade (MUV)': 'Cinemática',
  Torricelli: 'Cinemática',
  '2ª Lei de Newton': 'Leis de Newton',
  Peso: 'Leis de Newton',
  Trabalho: 'Trabalho e energia',
  'Energia cinética': 'Trabalho e energia',
  'Energia potencial gravitacional': 'Trabalho e energia',
  'Conservação de energia': 'Trabalho e energia',
  Potência: 'Energia e potência',
  'Potência elétrica': 'Energia e potência',
  'Quantidade de movimento': 'Impulso e quantidade de movimento',
  '1ª Lei de Ohm': 'Eletrodinâmica',
  'Resistores em série': 'Circuitos elétricos',
  'Resistores em paralelo': 'Circuitos elétricos',
  'Dilatação térmica linear': 'Termologia',
  'Calor sensível': 'Calorimetria',
  'Calor latente': 'Calorimetria',
  'Aceleração média': 'Cinemática',
  'Queda livre': 'Cinemática',
  'Velocidade angular': 'Cinemática',
  'Velocidade linear (MCU)': 'Cinemática',
  'Aceleração centrípeta': 'Cinemática',
  'Força centrípeta': 'Leis de Newton',
  'Força de atrito': 'Leis de Newton',
  'Força elástica (Lei de Hooke)': 'Leis de Newton',
  'Plano inclinado: componente do peso': 'Leis de Newton',
  'Plano inclinado: força normal': 'Leis de Newton',
  'Energia potencial elástica': 'Trabalho e energia',
  'Teorema da energia cinética': 'Trabalho e energia',
  'Potência (força e velocidade)': 'Energia e potência',
  Rendimento: 'Energia e potência',
  'Energia elétrica consumida': 'Energia e potência',
  Impulso: 'Impulso e quantidade de movimento',
  'Teorema do impulso': 'Impulso e quantidade de movimento',
  'Conservação da quantidade de movimento': 'Impulso e quantidade de movimento',
  'Lei da gravitação universal': 'Gravitação',
  '3ª Lei de Kepler': 'Gravitação',
  Pressão: 'Hidrostática',
  'Pressão hidrostática (Stevin)': 'Hidrostática',
  'Empuxo (Arquimedes)': 'Hidrostática',
  'Princípio de Pascal (prensa hidráulica)': 'Hidrostática',
  'Equação fundamental da ondulatória': 'Ondas',
  'Período e frequência': 'Ondas',
  'Nível de intensidade sonora': 'Acústica',
  'Índice de refração': 'Óptica geométrica',
  'Lei de Snell': 'Óptica geométrica',
  'Equação de Gauss': 'Óptica geométrica',
  'Aumento linear': 'Óptica geométrica',
  'Vergência (grau da lente)': 'Óptica geométrica',
  'Imagens em espelhos planos associados': 'Óptica geométrica',
  'Lei de Coulomb': 'Eletrostática',
  'Campo elétrico': 'Eletrostática',
  'Carga elétrica (quantização)': 'Eletrostática',
  'Corrente elétrica': 'Eletrodinâmica',
  '2ª Lei de Ohm': 'Eletrodinâmica',
  'Potência dissipada (corrente)': 'Eletrodinâmica',
  'Potência dissipada (tensão)': 'Eletrodinâmica',
  'Força magnética sobre carga': 'Magnetismo',
  'Força magnética sobre fio': 'Magnetismo',
  'Lei de Faraday': 'Eletromagnetismo',
  Transformador: 'Eletromagnetismo',
  'Equação de Clapeyron': 'Termodinâmica',
  'Lei geral dos gases': 'Termodinâmica',
  '1ª Lei da Termodinâmica': 'Termodinâmica',
  'Trabalho de um gás (pressão constante)': 'Termodinâmica',
  'Rendimento da máquina térmica': 'Termodinâmica',
  'Rendimento de Carnot': 'Termodinâmica',
  'Dilatação térmica superficial': 'Termologia',
  'Dilatação térmica volumétrica': 'Termologia',
  'Celsius ↔ Fahrenheit': 'Termologia',
  'Fluxo de calor (condução)': 'Termologia',
  'Capacidade térmica': 'Calorimetria',
  'Trocas de calor (sistema isolado)': 'Calorimetria',
  'Energia do fóton': 'Física moderna',
  'Equivalência massa-energia': 'Física moderna',

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
  'Número de massa': 'Estrutura atômica',
  Diluição: 'Soluções',
  'Mistura de soluções (mesmo soluto)': 'Soluções',
  'Concentração comum pela molar': 'Soluções',
  'Concentração comum pelo título': 'Soluções',
  'Partes por milhão (ppm)': 'Soluções',
  'Constante de equilíbrio': 'Equilíbrio químico',
  'Lei de diluição de Ostwald': 'Equilíbrio químico',
  pH: 'Equilíbrio químico',
  pOH: 'Equilíbrio químico',
  'Relação entre pH e pOH': 'Equilíbrio químico',
  'Produto iônico da água': 'Equilíbrio químico',
  'Variação de entalpia': 'Termoquímica',
  'Lei de Hess': 'Termoquímica',
  'Energia de ligação': 'Termoquímica',
  'Velocidade média de reação': 'Cinética química',
  'Lei da velocidade': 'Cinética química',
  'Diferença de potencial da pilha': 'Eletroquímica',
  'Carga na eletrólise': 'Eletroquímica',
  'Constante de Faraday': 'Eletroquímica',
  'Meia-vida': 'Radioatividade',

  // ---- Biologia ----
  'Hardy-Weinberg: alelos': 'Genética',
  'Hardy-Weinberg: genótipos': 'Genética',
  'Aumento total (microscópio)': 'Citologia',
  'Crescimento populacional': 'Ecologia',
  'Balanço populacional': 'Ecologia',
  'Produtividade primária líquida': 'Ecologia',
  'Eficiência ecológica': 'Ecologia',
  'Número de tipos de gametas': 'Genética',
  'Índice de massa corporal (IMC)': 'Saúde e doenças',

  // ---- Geografia ----
  'Densidade demográfica': 'População',
  'Crescimento vegetativo': 'População',
  'Fuso horário': 'Cartografia',

  // ---- Redação ----
  'Estrutura da redação ENEM': 'Estrutura dissertativa',
};

/**
 * Fórmula do catálogo com esse título. O título só é único por dono (ver
 * schema.prisma), então a busca fica no catálogo: sem esse recorte, uma
 * fórmula personalizada com o mesmo nome seria atualizada no lugar da do seed
 * e o catálogo sumiria para os outros alunos.
 */
function doCatalogo(prisma: PrismaClient, title: string) {
  return prisma.formula.findFirst({
    where: { title, ownerId: null, isBuiltIn: true },
    select: { id: true },
  });
}

/** Semeia as fórmulas (idempotente). Retorna quantas gravou. */
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
        doCatalogo(prisma, f.title),
        doCatalogo(prisma, f.formerTitle),
      ]);
      if (antiga && !atual) {
        await prisma.formula.update({
          where: { id: antiga.id },
          data: { title: f.title },
        });
      }
    }

    const dados = {
      latex: f.latex,
      description: f.description ?? null,
      subjectId: subject.id,
      topicId: topic?.id ?? null,
    };
    const existente = await doCatalogo(prisma, f.title);
    const formula = existente
      ? await prisma.formula.update({
          where: { id: existente.id },
          data: dados,
          select: { id: true },
        })
      : await prisma.formula.create({
          data: { title: f.title, ...dados, isBuiltIn: true },
          select: { id: true },
        });

    // Legenda: recria do zero a cada seed para refletir edições no catálogo.
    const symbols = FORMULA_SYMBOLS[f.title];
    if (symbols?.length) {
      await prisma.formulaSymbol.deleteMany({
        where: { formulaId: formula.id },
      });
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
