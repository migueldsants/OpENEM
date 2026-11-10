/**
 * Interferência na superfície da água (cuba de ondas): duas fontes pontuais
 * de mesma frequência. Cada uma faz ondas circulares cuja amplitude cai com
 * 1/√r (a energia se espalha num círculo); a superfície é a soma das duas.
 * Onde a diferença de caminho é um número inteiro de comprimentos de onda, as
 * cristas chegam juntas (interferência construtiva); onde é meio comprimento
 * a mais, crista encontra vale e a água fica parada (linha nodal).
 */

export interface Fontes {
  /** Frequência (Hz). */
  f: number;
  /** Velocidade da onda (m/s). Na água rasa, v = √(g·h). */
  v: number;
  /** Distância entre as fontes (m). */
  d: number;
  /** Diferença de fase da fonte 2 (rad). */
  fase: number;
  /** Só a fonte 1. */
  uma?: boolean;
  /** Amplitude na fonte (m). */
  A?: number;
}

export const comprimentoOnda = (p: Fontes) => p.v / p.f;

const TAU = Math.PI * 2;

/** Amplitude de uma fonte a distância r: cai com 1/√r, sem estourar perto dela. */
function amp(p: Fontes, r: number) {
  const lambda = comprimentoOnda(p);
  return (p.A ?? 0.01) / Math.sqrt(1 + r / (0.25 * lambda));
}

/** Altura da superfície no ponto (x, y) no instante t; fontes em (±d/2, 0). */
export function altura(p: Fontes, x: number, y: number, t: number): number {
  const k = TAU / comprimentoOnda(p);
  const w = TAU * p.f;
  const r1 = Math.hypot(x + p.d / 2, y);
  let h = amp(p, r1) * Math.sin(k * r1 - w * t);
  if (!p.uma) {
    const r2 = Math.hypot(x - p.d / 2, y);
    h += amp(p, r2) * Math.sin(k * r2 - w * t + p.fase);
  }
  return h;
}

/** Amplitude da oscilação no ponto (o envelope): o tamanho da soma dos dois fasores. */
export function envoltoria(p: Fontes, x: number, y: number): number {
  const k = TAU / comprimentoOnda(p);
  const r1 = Math.hypot(x + p.d / 2, y);
  const a1 = amp(p, r1);
  if (p.uma) return a1;
  const r2 = Math.hypot(x - p.d / 2, y);
  const a2 = amp(p, r2);
  const dphi = k * (r1 - r2) - p.fase;
  return Math.sqrt(a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(dphi));
}

/** Diferença de caminho em comprimentos de onda, já descontada a fase. */
export function ordem(p: Fontes, x: number, y: number) {
  const r1 = Math.hypot(x + p.d / 2, y);
  const r2 = Math.hypot(x - p.d / 2, y);
  return (r1 - r2) / comprimentoOnda(p) - p.fase / TAU;
}

/**
 * Linhas nodais (água parada) entre as fontes, contando os dois lados: as
 * diferenças de caminho Δ com |Δ| < d que caem em meio comprimento de onda
 * (descontada a fase).
 */
export function linhasNodais(p: Fontes): number {
  if (p.uma) return 0;
  const lambda = comprimentoOnda(p);
  const desloc = p.fase / TAU;
  let n = 0;
  // Δ/λ = m + ½ + desloc, com |Δ| < d.
  for (let m = -100; m <= 100; m++) {
    const delta = (m + 0.5 + desloc) * lambda;
    if (Math.abs(delta) < p.d - 1e-12) n++;
  }
  return n;
}

/** Linhas de reforço (ventrais), pela mesma conta com Δ/λ inteiro. */
export function linhasVentrais(p: Fontes): number {
  if (p.uma) return 0;
  const lambda = comprimentoOnda(p);
  const desloc = p.fase / TAU;
  let n = 0;
  for (let m = -100; m <= 100; m++) {
    const delta = (m + desloc) * lambda;
    if (Math.abs(delta) < p.d - 1e-12) n++;
  }
  return n;
}
