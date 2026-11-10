/**
 * Sólidos geométricos e as suas planificações. A planificação é uma árvore de
 * faces no plano: cada face filha gira em torno da aresta que a liga à mãe
 * (a "dobradiça"). Com `t = 1` tudo fica aberto no chão; com `t = 0` as faces
 * sobem até fechar o sólido. A dobra é calculada aqui (rotação de Rodrigues
 * composta pela árvore) e o teste confere que o sólido fecha de verdade.
 */

export type P2 = [number, number];
export type V3 = [number, number, number];

export interface Face {
  /** Polígono convexo no plano da planificação (x, y do papel). */
  pts: P2[];
  filhos: { face: Face; dobradica: [P2, P2]; /** ângulo de dobra quando fechado (rad) */ angulo: number }[];
}

export interface Solido {
  key: 'cubo' | 'paralelepipedo' | 'prisma' | 'piramide' | 'tetraedro';
  nome: string;
  vertices: number;
  arestas: number;
  faces: number;
  area: number;
  volume: number;
  formulaVolume: string;
  rede: Face;
}

const ret = (x: number, y: number, w: number, h: number): P2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const RETO = Math.PI / 2;

/** Paralelepípedo a × b × c: base a × b no centro, laterais em cruz e a tampa presa à lateral de cima. */
function redeCaixa(a: number, b: number, c: number): Face {
  const tampa: Face = { pts: ret(0, b + c, a, b), filhos: [] };
  return {
    pts: ret(0, 0, a, b),
    filhos: [
      { face: { pts: ret(0, -c, a, c), filhos: [] }, dobradica: [[0, 0], [a, 0]], angulo: RETO },
      { face: { pts: ret(0, b, a, c), filhos: [{ face: tampa, dobradica: [[0, b + c], [a, b + c]], angulo: RETO }] }, dobradica: [[0, b], [a, b]], angulo: RETO },
      { face: { pts: ret(-c, 0, c, b), filhos: [] }, dobradica: [[0, 0], [0, b]], angulo: RETO },
      { face: { pts: ret(a, 0, c, b), filhos: [] }, dobradica: [[a, 0], [a, b]], angulo: RETO },
    ],
  };
}

/** Triângulo com base no segmento UV, apontando para fora do polígono (lado oposto ao ponto `dentro`), de altura `h` no papel. */
function trianguloSobre(U: P2, V: P2, h: number, dentro: P2): P2[] {
  const m: P2 = [(U[0] + V[0]) / 2, (U[1] + V[1]) / 2];
  const dx = V[0] - U[0];
  const dy = V[1] - U[1];
  const L = Math.hypot(dx, dy);
  let n: P2 = [-dy / L, dx / L];
  if ((dentro[0] - m[0]) * n[0] + (dentro[1] - m[1]) * n[1] > 0) n = [-n[0], -n[1]];
  return [U, V, [m[0] + n[0] * h, m[1] + n[1] * h]];
}

function redePrisma(a: number, h: number): Face {
  // Base: triângulo equilátero de lado a; três retângulos nas arestas; tampa presa ao retângulo da aresta de baixo.
  const alt = (a * Math.sqrt(3)) / 2;
  const A: P2 = [0, 0];
  const B: P2 = [a, 0];
  const C: P2 = [a / 2, alt];
  const centro: P2 = [a / 2, alt / 3];
  const lateral = (U: P2, V: P2): { face: Face; dobradica: [P2, P2]; angulo: number } => {
    const tri = trianguloSobre(U, V, 1, centro);
    const n: P2 = [tri[2][0] - (U[0] + V[0]) / 2, tri[2][1] - (U[1] + V[1]) / 2];
    const U2: P2 = [U[0] + n[0] * h, U[1] + n[1] * h];
    const V2: P2 = [V[0] + n[0] * h, V[1] + n[1] * h];
    return { face: { pts: [U, V, V2, U2], filhos: [] }, dobradica: [U, V], angulo: RETO };
  };
  const debaixo = lateral(A, B);
  const [, , V2, U2] = debaixo.face.pts;
  debaixo.face.filhos.push({ face: { pts: trianguloSobre(U2, V2, alt, A), filhos: [] }, dobradica: [U2, V2], angulo: RETO });
  return { pts: [A, B, C], filhos: [debaixo, lateral(B, C), lateral(C, A)] };
}

function redePiramide(a: number, h: number): Face {
  const ap = Math.hypot(h, a / 2); // apótema da face lateral
  const beta = Math.atan2(h, a / 2); // ângulo entre a base e a face
  const base = ret(0, 0, a, a);
  const centro: P2 = [a / 2, a / 2];
  return {
    pts: base,
    filhos: base.map((U, i) => {
      const V = base[(i + 1) % 4];
      return { face: { pts: trianguloSobre(U, V, ap, centro), filhos: [] }, dobradica: [U, V] as [P2, P2], angulo: Math.PI - beta };
    }),
  };
}

function redeTetraedro(a: number): Face {
  const alt = (a * Math.sqrt(3)) / 2;
  const base: P2[] = [[0, 0], [a, 0], [a / 2, alt]];
  const centro: P2 = [a / 2, alt / 3];
  const diedro = Math.acos(1 / 3);
  return {
    pts: base,
    filhos: base.map((U, i) => {
      const V = base[(i + 1) % 3];
      return { face: { pts: trianguloSobre(U, V, alt, centro), filhos: [] }, dobradica: [U, V] as [P2, P2], angulo: Math.PI - diedro };
    }),
  };
}

export interface Medidas {
  a: number;
  b: number;
  c: number;
}

export function solido(key: Solido['key'], m: Medidas): Solido {
  const { a, b, c } = m;
  switch (key) {
    case 'cubo':
      return { key, nome: 'Cubo', vertices: 8, arestas: 12, faces: 6, area: 6 * a * a, volume: a ** 3, formulaVolume: 'V = a³', rede: redeCaixa(a, a, a) };
    case 'paralelepipedo':
      return { key, nome: 'Paralelepípedo', vertices: 8, arestas: 12, faces: 6, area: 2 * (a * b + a * c + b * c), volume: a * b * c, formulaVolume: 'V = a·b·c', rede: redeCaixa(a, b, c) };
    case 'prisma': {
      const ab = (Math.sqrt(3) / 4) * a * a;
      return { key, nome: 'Prisma triangular', vertices: 6, arestas: 9, faces: 5, area: 2 * ab + 3 * a * c, volume: ab * c, formulaVolume: 'V = Ab·h', rede: redePrisma(a, c) };
    }
    case 'piramide': {
      const ap = Math.hypot(c, a / 2);
      return { key, nome: 'Pirâmide quadrangular', vertices: 5, arestas: 8, faces: 5, area: a * a + 2 * a * ap, volume: (a * a * c) / 3, formulaVolume: 'V = Ab·h/3', rede: redePiramide(a, c) };
    }
    case 'tetraedro':
      return { key, nome: 'Tetraedro regular', vertices: 4, arestas: 6, faces: 4, area: Math.sqrt(3) * a * a, volume: (a ** 3) / (6 * Math.SQRT2), formulaVolume: 'V = a³√2/12', rede: redeTetraedro(a) };
  }
}

// ---------------------------------------------------------------------------
// Dobra: transformações rígidas compostas pela árvore
// ---------------------------------------------------------------------------

interface Rigida {
  R: number[][];
  t: V3;
}

const IDENT: Rigida = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };
const aplicar = (T: Rigida, p: V3): V3 => [
  T.R[0][0] * p[0] + T.R[0][1] * p[1] + T.R[0][2] * p[2] + T.t[0],
  T.R[1][0] * p[0] + T.R[1][1] * p[1] + T.R[1][2] * p[2] + T.t[1],
  T.R[2][0] * p[0] + T.R[2][1] * p[1] + T.R[2][2] * p[2] + T.t[2],
];
function compor(A: Rigida, B: Rigida): Rigida {
  const R = A.R.map((l) => [0, 1, 2].map((j) => l[0] * B.R[0][j] + l[1] * B.R[1][j] + l[2] * B.R[2][j]));
  return { R, t: aplicar(A, B.t) };
}
/** Rotação de ângulo θ em torno da reta que passa por P com direção unitária u. */
function rotacao(P: V3, u: V3, th: number): Rigida {
  const [x, y, z] = u;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const C = 1 - c;
  const R = [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
  const RP = [0, 1, 2].map((i) => R[i][0] * P[0] + R[i][1] * P[1] + R[i][2] * P[2]);
  return { R, t: [P[0] - RP[0], P[1] - RP[1], P[2] - RP[2]] };
}

/** O papel fica no plano do chão: x do papel → x, y do papel → z, com y para cima. */
const noChao = (p: P2): V3 => [p[0], 0, p[1]];

/**
 * Faces em 3D com a planificação aberta `aberta` (0 = sólido fechado, 1 = no
 * chão). Cada face filha gira para cima (para +y no referencial da mãe).
 */
export function dobrar(rede: Face, aberta: number): V3[][] {
  const out: V3[][] = [];
  const visitar = (f: Face, T: Rigida) => {
    out.push(f.pts.map((p) => aplicar(T, noChao(p))));
    for (const { face, dobradica, angulo } of f.filhos) {
      const P = noChao(dobradica[0]);
      const Q = noChao(dobradica[1]);
      const L = Math.hypot(Q[0] - P[0], Q[2] - P[2]);
      let u: V3 = [(Q[0] - P[0]) / L, 0, (Q[2] - P[2]) / L];
      // Sentido do eixo que faz a face subir: u × w com componente y positiva (w aponta para a face).
      const cx = face.pts.reduce((s, p) => s + p[0], 0) / face.pts.length - P[0];
      const cz = face.pts.reduce((s, p) => s + p[1], 0) / face.pts.length - P[2];
      const cruzY = u[2] * cx - u[0] * cz;
      if (cruzY < 0) u = [-u[0], 0, -u[2]];
      visitar(face, compor(T, rotacao(P, u, angulo * (1 - aberta))));
    }
  };
  visitar(rede, IDENT);
  return out;
}

/** Área de uma face plana em 3D (fórmula do produto vetorial). */
export function areaFace(f: V3[]): number {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 1; i + 1 < f.length; i++) {
    const a: V3 = [f[i][0] - f[0][0], f[i][1] - f[0][1], f[i][2] - f[0][2]];
    const b: V3 = [f[i + 1][0] - f[0][0], f[i + 1][1] - f[0][1], f[i + 1][2] - f[0][2]];
    sx += a[1] * b[2] - a[2] * b[1];
    sy += a[2] * b[0] - a[0] * b[2];
    sz += a[0] * b[1] - a[1] * b[0];
  }
  return Math.hypot(sx, sy, sz) / 2;
}
