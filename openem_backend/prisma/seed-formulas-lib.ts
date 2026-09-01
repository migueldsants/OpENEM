// Fórmulas essenciais (issue #38) — catálogo + seeding idempotente.
// Compartilhado entre prisma/seed.ts (db:seed) e prisma/seed-formulas.ts.
import type { PrismaClient } from '@prisma/client';

export interface FormulaSeed {
  subject: string; // nome canônico da matéria (da TAXONOMY do seed.ts)
  title: string;
  latex: string;
  description?: string;
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
    await prisma.formula.upsert({
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
    });
    count += 1;
  }
  return count;
}