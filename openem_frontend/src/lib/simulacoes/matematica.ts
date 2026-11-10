/**
 * Matemática das simulações: funções definidas por pontos que o aluno arrasta,
 * ciclo trigonométrico, triângulo com pontos notáveis, probabilidade com dados
 * e projeções ortográficas de um sólido de cubos. Tudo puro e testado.
 */

export type P2 = readonly [number, number];

// ---------------------------------------------------------------------------
// Funções
// ---------------------------------------------------------------------------

export type Familia = 'afim' | 'quadratica' | 'exponencial' | 'logaritmica' | 'seno';

/** Reta pelos pontos A e B: f(x) = a·x + b. */
export function afimPorPontos(A: P2, B: P2) {
  const dx = B[0] - A[0];
  const a = Math.abs(dx) < 1e-9 ? 0 : (B[1] - A[1]) / dx;
  return { a, b: A[1] - a * A[0] };
}

/** Parábola com vértice V passando por P: f(x) = a(x − h)² + k. */
export function quadraticaPorVertice(V: P2, P: P2) {
  const d = (P[0] - V[0]) ** 2;
  const a = d < 1e-9 ? 1 : (P[1] - V[1]) / d;
  return { a, h: V[0], k: V[1] };
}

/** Coeficientes a, b, c da forma geral a partir da forma canônica. */
export const formaGeral = (q: { a: number; h: number; k: number }) => ({ a: q.a, b: -2 * q.a * q.h, c: q.a * q.h * q.h + q.k });

/** Raízes reais de a·x² + b·x + c (Bhaskara), em ordem. */
export function raizes(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const delta = b * b - 4 * a * c;
  if (delta < -1e-12) return [];
  if (Math.abs(delta) <= 1e-12) return [-b / (2 * a)];
  const r = Math.sqrt(delta);
  return [(-b - r) / (2 * a), (-b + r) / (2 * a)].sort((x, y) => x - y);
}

/** Exponencial f(x) = k·bˣ passando por (0, k) e (1, k·b). */
export function exponencialPorPontos(P0: P2, P1: P2) {
  const k = P0[1];
  const base = Math.abs(k) < 1e-9 ? 1 : P1[1] / k;
  return { k, base };
}

/** Logaritmo f(x) = log_b(x) passando por (b, 1): o aluno arrasta o ponto na reta y = 1. */
export const logaritmo = (base: number) => (x: number) => (x > 0 && base > 0 && base !== 1 ? Math.log(x) / Math.log(base) : NaN);

/** Seno f(x) = A·sen(B·(x − C)) + D com um pico em (xp, yp) e período T. */
export function senoPorPico(pico: P2, periodo: number, D: number) {
  const A = pico[1] - D;
  const B = (2 * Math.PI) / periodo;
  // sen(B(xp − C)) = 1  →  xp − C = T/4.
  const C = pico[0] - periodo / 4;
  return { A, B, C, D };
}

// ---------------------------------------------------------------------------
// Ciclo trigonométrico
// ---------------------------------------------------------------------------

const NOTAVEIS: [number, string][] = [
  [0, '0'], [30, 'π/6'], [45, 'π/4'], [60, 'π/3'], [90, 'π/2'], [120, '2π/3'], [135, '3π/4'], [150, '5π/6'],
  [180, 'π'], [210, '7π/6'], [225, '5π/4'], [240, '4π/3'], [270, '3π/2'], [300, '5π/3'], [315, '7π/4'], [330, '11π/6'], [360, '2π'],
];

/** Ângulo em radianos escrito com π, se for um ângulo notável (senão, com duas casas). */
export function radianosEmPi(graus: number): string {
  const g = ((graus % 360) + 360) % 360;
  const n = NOTAVEIS.find(([a]) => Math.abs(a - g) < 1e-6);
  if (n) return n[1];
  return `${((g * Math.PI) / 180).toFixed(2).replace('.', ',')} rad`;
}

/** Ângulo notável mais perto (para o ponto "grudar" quando o aluno chega perto). */
export function notavelMaisPerto(graus: number, tolerancia = 3): number | null {
  const g = ((graus % 360) + 360) % 360;
  for (const [a] of NOTAVEIS) {
    const d = Math.min(Math.abs(a - g), 360 - Math.abs(a - g));
    if (d <= tolerancia) return a % 360;
  }
  return null;
}

/** Quadrante (1 a 4) ou 0 sobre um eixo. */
export function quadrante(graus: number): 0 | 1 | 2 | 3 | 4 {
  const g = ((graus % 360) + 360) % 360;
  if (g % 90 === 0) return 0;
  return (Math.floor(g / 90) + 1) as 1 | 2 | 3 | 4;
}

/** Ângulo correspondente no 1º quadrante (redução ao primeiro quadrante). */
export function reducao(graus: number): number {
  const g = ((graus % 360) + 360) % 360;
  if (g <= 90) return g;
  if (g <= 180) return 180 - g;
  if (g <= 270) return g - 180;
  return 360 - g;
}

// ---------------------------------------------------------------------------
// Triângulo
// ---------------------------------------------------------------------------

const sub = (a: P2, b: P2): [number, number] => [a[0] - b[0], a[1] - b[1]];
const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export interface Triangulo {
  lados: { a: number; b: number; c: number }; // a oposto a A…
  angulos: { A: number; B: number; C: number }; // graus
  area: number;
  perimetro: number;
  tipoLados: 'equilátero' | 'isósceles' | 'escaleno';
  tipoAngulos: 'acutângulo' | 'retângulo' | 'obtusângulo';
  baricentro: P2;
  circuncentro: P2 | null;
  raioCircunscrito: number;
  incentro: P2;
  raioInscrito: number;
  ortocentro: P2 | null;
}

function anguloEm(v: P2, p: P2, q: P2) {
  const [ux, uy] = sub(p, v);
  const [wx, wy] = sub(q, v);
  const cos = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export function triangulo(A: P2, B: P2, C: P2, tolGraus = 0.5): Triangulo {
  const a = dist(B, C);
  const b = dist(A, C);
  const c = dist(A, B);
  const angulos = { A: anguloEm(A, B, C), B: anguloEm(B, A, C), C: anguloEm(C, A, B) };
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const perimetro = a + b + c;
  const iguais = (x: number, y: number) => Math.abs(x - y) <= Math.max(x, y) * 0.005;
  const tipoLados = iguais(a, b) && iguais(b, c) ? 'equilátero' : iguais(a, b) || iguais(b, c) || iguais(a, c) ? 'isósceles' : 'escaleno';
  const maior = Math.max(angulos.A, angulos.B, angulos.C);
  const tipoAngulos = Math.abs(maior - 90) <= tolGraus ? 'retângulo' : maior > 90 ? 'obtusângulo' : 'acutângulo';
  const baricentro: P2 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const D = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  let circuncentro: P2 | null = null;
  if (Math.abs(D) > 1e-12) {
    const a2 = A[0] ** 2 + A[1] ** 2;
    const b2 = B[0] ** 2 + B[1] ** 2;
    const c2 = C[0] ** 2 + C[1] ** 2;
    circuncentro = [(a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / D, (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / D];
  }
  const incentro: P2 = [(a * A[0] + b * B[0] + c * C[0]) / perimetro, (a * A[1] + b * B[1] + c * C[1]) / perimetro];
  // Ortocentro: H = A + B + C − 2·O (reta de Euler).
  const ortocentro: P2 | null = circuncentro ? [A[0] + B[0] + C[0] - 2 * circuncentro[0], A[1] + B[1] + C[1] - 2 * circuncentro[1]] : null;
  return {
    lados: { a, b, c },
    angulos,
    area,
    perimetro,
    tipoLados,
    tipoAngulos,
    baricentro,
    circuncentro,
    raioCircunscrito: area > 1e-12 ? (a * b * c) / (4 * area) : Infinity,
    incentro,
    raioInscrito: perimetro > 0 ? (2 * area) / perimetro : 0,
    ortocentro,
  };
}

/** Pé da perpendicular de P sobre a reta UV (para desenhar as alturas). */
export function pePerpendicular(P: P2, U: P2, V: P2): P2 {
  const [dx, dy] = sub(V, U);
  const t = ((P[0] - U[0]) * dx + (P[1] - U[1]) * dy) / (dx * dx + dy * dy || 1);
  return [U[0] + t * dx, U[1] + t * dy];
}

// ---------------------------------------------------------------------------
// Probabilidade
// ---------------------------------------------------------------------------

/** Distribuição exata da soma de `n` dados de `faces` lados (convolução): índice = soma. */
export function distribuicaoSoma(n: number, faces = 6): number[] {
  let dist: number[] = [1];
  for (let k = 0; k < n; k++) {
    const nova = new Array<number>(dist.length + faces).fill(0);
    dist.forEach((p, s) => {
      for (let f = 1; f <= faces; f++) nova[s + f] += p / faces;
    });
    dist = nova;
  }
  return dist;
}

export const esperanca = (dist: number[]) => dist.reduce((s, p, i) => s + p * i, 0);

// ---------------------------------------------------------------------------
// Projeções ortográficas de um sólido de cubos
// ---------------------------------------------------------------------------

/**
 * Sólido como alturas de pilhas numa grade: `h[linha][coluna]`, com a linha 0
 * no fundo e a última na frente (perto do observador da vista frontal).
 */
export type Pilhas = number[][];

export interface Vistas {
  /** Vista de cima: quais casas têm cubo (linha 0 no alto do desenho). */
  superior: boolean[][];
  /** Vista de frente: altura máxima de cada coluna. */
  frontal: number[];
  /** Vista lateral esquerda: altura máxima de cada linha, da frente para o fundo, vista da esquerda. */
  lateral: number[];
}

export function vistas(h: Pilhas): Vistas {
  const linhas = h.length;
  const cols = h[0]?.length ?? 0;
  const frontal = Array.from({ length: cols }, (_, j) => Math.max(0, ...h.map((l) => l[j])));
  // Olhando da esquerda, a frente do sólido fica à direita do desenho.
  const lateral = Array.from({ length: linhas }, (_, i) => Math.max(0, ...h[i]));
  return { superior: h.map((l) => l.map((v) => v > 0)), frontal, lateral };
}

export const totalCubos = (h: Pilhas) => h.reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0);

export function vistasIguais(a: Vistas, b: Vistas) {
  return JSON.stringify(a) === JSON.stringify(b);
}
