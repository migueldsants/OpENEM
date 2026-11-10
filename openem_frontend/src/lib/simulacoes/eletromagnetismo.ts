/**
 * Eletricidade e magnetismo: circuitos de corrente contínua resolvidos por
 * análise nodal (leis de Kirchhoff) e partícula carregada num campo magnético
 * uniforme (força de Lorentz, integrador de Boris).
 */

// ---------------------------------------------------------------------------
// Circuitos
// ---------------------------------------------------------------------------

export interface Resistor {
  id: string;
  a: number; // nó
  b: number; // nó
  R: number; // Ω
  /** Lâmpada queimada / chave aberta: o ramo deixa de conduzir. */
  aberto?: boolean;
}

export interface Circuito {
  nos: number; // nós 0..nos-1; o nó 0 é o terra (polo negativo)
  fonte: { pos: number; V: number }; // fonte ideal entre `pos` e o terra
  resistores: Resistor[];
}

export interface ResultadoCircuito {
  potenciais: number[];
  correntes: Record<string, number>; // de a para b (A)
  tensoes: Record<string, number>; // Va − Vb (V)
  potencias: Record<string, number>; // W
  correnteFonte: number;
  potenciaFonte: number;
  resistenciaEquivalente: number;
}

/** Condutância mínima a terra (como o GMIN do SPICE): nó solto não deixa a matriz singular. */
const GMIN = 1e-12;

/** Resolve A·x = b por eliminação de Gauss com pivotamento parcial. */
export function resolverLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) throw new Error('sistema singular');
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Análise nodal modificada: incógnitas são V1..Vn−1 e a corrente da fonte. */
export function resolverCircuito(c: Circuito): ResultadoCircuito {
  const n = c.nos - 1; // sem o terra
  const tam = n + 1;
  const A = Array.from({ length: tam }, () => new Array<number>(tam).fill(0));
  const b = new Array<number>(tam).fill(0);
  const idx = (no: number) => no - 1;
  for (let i = 0; i < n; i++) A[i][i] += GMIN;
  for (const r of c.resistores) {
    if (r.aberto) continue;
    const g = 1 / r.R;
    const ia = idx(r.a);
    const ib = idx(r.b);
    if (r.a !== 0) A[ia][ia] += g;
    if (r.b !== 0) A[ib][ib] += g;
    if (r.a !== 0 && r.b !== 0) {
      A[ia][ib] -= g;
      A[ib][ia] -= g;
    }
  }
  // Fonte: V(pos) − V(0) = V; a corrente entra pelo polo positivo no circuito.
  const k = n;
  const ip = idx(c.fonte.pos);
  A[ip][k] -= 1;
  A[k][ip] = 1;
  b[k] = c.fonte.V;
  const x = resolverLinear(A, b);
  const potenciais = [0, ...x.slice(0, n)];
  // Pela estampa (−1 na linha do nó positivo), x[k] é a corrente que a fonte entrega.
  const correnteFonte = x[k];
  const correntes: Record<string, number> = {};
  const tensoes: Record<string, number> = {};
  const potencias: Record<string, number> = {};
  for (const r of c.resistores) {
    const v = potenciais[r.a] - potenciais[r.b];
    const i = r.aberto ? 0 : v / r.R;
    correntes[r.id] = i;
    tensoes[r.id] = v;
    potencias[r.id] = i * v;
  }
  const I = correnteFonte;
  return {
    potenciais,
    correntes,
    tensoes,
    potencias,
    correnteFonte: I,
    potenciaFonte: c.fonte.V * I,
    resistenciaEquivalente: I < 1e-9 ? Infinity : c.fonte.V / I,
  };
}

export type Montagem = 'serie' | 'paralelo' | 'misto';

/**
 * As três montagens clássicas com três lâmpadas (R1, R2, R3):
 * - série: + → R1 → R2 → R3 → −
 * - paralelo: cada lâmpada ligada direto aos polos
 * - misto: R1 em série com (R2 ∥ R3)
 */
export function montarCircuito(
  montagem: Montagem,
  V: number,
  R: [number, number, number],
  abertos: [boolean, boolean, boolean] = [false, false, false],
): Circuito {
  const mk = (i: number, a: number, b: number): Resistor => ({ id: `R${i + 1}`, a, b, R: R[i], aberto: abertos[i] });
  if (montagem === 'serie') {
    return { nos: 4, fonte: { pos: 1, V }, resistores: [mk(0, 1, 2), mk(1, 2, 3), mk(2, 3, 0)] };
  }
  if (montagem === 'paralelo') {
    return { nos: 2, fonte: { pos: 1, V }, resistores: [mk(0, 1, 0), mk(1, 1, 0), mk(2, 1, 0)] };
  }
  return { nos: 3, fonte: { pos: 1, V }, resistores: [mk(0, 1, 2), mk(1, 2, 0), mk(2, 2, 0)] };
}

export const serie = (...r: number[]) => r.reduce((a, b) => a + b, 0);
export const paralelo = (...r: number[]) => 1 / r.reduce((a, b) => a + 1 / b, 0);

/**
 * Resistência de uma lâmpada incandescente de potência nominal P a tensão U:
 * R = U²/P (a quente; o filamento frio tem bem menos).
 */
export const resistenciaLampada = (Pnominal: number, Unominal: number) => (Unominal * Unominal) / Pnominal;

// ---------------------------------------------------------------------------
// Partícula num campo magnético
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

export const cruz = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const escalar = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norma = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

export const CARGA_E = 1.602176634e-19;

export const PARTICULAS = [
  { key: 'proton', nome: 'Próton', q: CARGA_E, m: 1.67262192e-27 },
  { key: 'eletron', nome: 'Elétron', q: -CARGA_E, m: 9.1093837e-31 },
  { key: 'alfa', nome: 'Partícula alfa', q: 2 * CARGA_E, m: 6.6446573e-27 },
  { key: 'positron', nome: 'Pósitron', q: CARGA_E, m: 9.1093837e-31 },
] as const;

export const raioCiclotron = (m: number, v: number, q: number, B: number) => (m * v) / (Math.abs(q) * B);
export const periodoCiclotron = (m: number, q: number, B: number) => (2 * Math.PI * m) / (Math.abs(q) * B);

/**
 * Um passo do integrador de Boris (o padrão em física de plasmas): conserva a
 * energia exatamente quando só há campo magnético.
 */
export function passoBoris(
  pos: Vec3,
  vel: Vec3,
  q: number,
  m: number,
  E: Vec3,
  B: Vec3,
  dt: number,
): { pos: Vec3; vel: Vec3 } {
  const qm = (q / m) * (dt / 2);
  const vMenos: Vec3 = [vel[0] + qm * E[0], vel[1] + qm * E[1], vel[2] + qm * E[2]];
  const t: Vec3 = [qm * B[0], qm * B[1], qm * B[2]];
  const t2 = escalar(t, t);
  const s: Vec3 = [(2 * t[0]) / (1 + t2), (2 * t[1]) / (1 + t2), (2 * t[2]) / (1 + t2)];
  const vLinha = cruz(vMenos, t);
  const vl: Vec3 = [vMenos[0] + vLinha[0], vMenos[1] + vLinha[1], vMenos[2] + vLinha[2]];
  const vMaisRot = cruz(vl, s);
  const vMais: Vec3 = [vMenos[0] + vMaisRot[0], vMenos[1] + vMaisRot[1], vMenos[2] + vMaisRot[2]];
  const nv: Vec3 = [vMais[0] + qm * E[0], vMais[1] + qm * E[1], vMais[2] + qm * E[2]];
  return { pos: [pos[0] + nv[0] * dt, pos[1] + nv[1] * dt, pos[2] + nv[2] * dt], vel: nv };
}

/** Velocidade inicial com módulo v e ângulo α em relação a B (B no eixo z). */
export function velocidadeInicial(v: number, alfaGraus: number): Vec3 {
  const a = (alfaGraus * Math.PI) / 180;
  return [v * Math.sin(a), 0, v * Math.cos(a)];
}

/** Passo da hélice: avanço ao longo de B em uma volta. */
export const passoHelice = (vParalela: number, periodo: number) => vParalela * periodo;
