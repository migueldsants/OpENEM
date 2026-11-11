/**
 * Isomeria: moléculas montadas em 3D a partir das ligações (sem coordenadas
 * tabeladas). Cada átomo tem hibridização sp³ (tetraedro, 109,5°) ou sp²
 * (triângulo plano, 120°); os átomos são colocados um a um a partir do
 * primeiro, com comprimentos de ligação medidos. Numa dupla C=C os vizinhos
 * ficam no mesmo plano, por isso cis e trans são moléculas diferentes; numa
 * ligação simples a rotação muda só a conformação.
 */

export type V3 = [number, number, number];
export type Elemento = 'C' | 'H' | 'O' | 'Cl' | 'Br' | 'F';

export interface AtomoSpec {
  el: Elemento;
  hib: 'sp3' | 'sp2';
  /** Vizinhos em ordem: índices de átomos pesados ou 'H'. Num sp², o primeiro depois da mãe fica cis à referência. */
  liga: (number | 'H')[];
}

export interface MoleculaSpec {
  nome: string;
  atomos: AtomoSpec[];
  /** Ligações duplas entre átomos pesados. */
  duplas?: [number, number][];
}

export interface Molecula {
  nome: string;
  el: Elemento[];
  pos: V3[];
  ligacoes: { a: number; b: number; ordem: 1 | 2 }[];
}

const COMP: Record<string, number> = {
  'C-C': 1.54, 'C=C': 1.34, 'C-H': 1.09, 'C-O': 1.43, 'C=O': 1.23, 'O-H': 0.96, 'C-Cl': 1.77, 'C-Br': 1.94, 'C-F': 1.35,
};
const comprimento = (a: Elemento, b: Elemento, ordem: number) =>
  COMP[`${a}${ordem === 2 ? '=' : '-'}${b}`] ?? COMP[`${b}${ordem === 2 ? '=' : '-'}${a}`] ?? 1.5;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subv = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => mul(a, 1 / Math.hypot(...a));

const TETRA = Math.acos(-1 / 3); // 109,47°

/**
 * Direções dos vizinhos de um átomo, dada a direção `d` para a mãe (unitária)
 * e uma referência `r` perpendicular (um vizinho da mãe): no sp³, os outros
 * três a 109,5° de d, o primeiro em anti a r (+ torção); no sp², os outros dois
 * no plano de d e r, o primeiro do lado de r (cis).
 */
function direcoes(hib: 'sp3' | 'sp2', d: V3, r: V3, torcao = 0): V3[] {
  const e1 = norm(subv(r, mul(d, dot(r, d))));
  const e2 = cross(d, e1);
  if (hib === 'sp2') {
    const ang = (120 * Math.PI) / 180;
    return [1, -1].map((s) => norm(add(mul(d, Math.cos(ang)), mul(e1, s * Math.sin(ang)))));
  }
  return [0, 1, 2].map((k) => {
    const phi = Math.PI + torcao + (k * 2 * Math.PI) / 3;
    const lado = add(mul(e1, Math.cos(phi)), mul(e2, Math.sin(phi)));
    return norm(add(mul(d, Math.cos(TETRA)), mul(lado, Math.sin(TETRA))));
  });
}

/**
 * Monta a molécula. `torcoes` gira os vizinhos de um átomo em torno da
 * ligação com a mãe (em graus): é a rotação da ligação simples.
 */
export function montar(spec: MoleculaSpec, torcoes: Record<number, number> = {}): Molecula {
  const el: Elemento[] = [];
  const hib: ('sp3' | 'sp2')[] = [];
  const viz: number[][] = [];
  const ordem = new Map<string, 1 | 2>();
  // Átomos pesados primeiro, hidrogênios criados conforme aparecem.
  spec.atomos.forEach((a) => {
    el.push(a.el);
    hib.push(a.hib);
    viz.push([]);
  });
  spec.atomos.forEach((a, i) => {
    for (const v of a.liga) {
      if (v === 'H') {
        const h = el.length;
        el.push('H');
        hib.push('sp3');
        viz.push([i]);
        viz[i].push(h);
      } else {
        viz[i].push(v);
      }
    }
  });
  for (const [a, b] of spec.duplas ?? []) {
    ordem.set(`${a}-${b}`, 2);
    ordem.set(`${b}-${a}`, 2);
  }
  const ord = (a: number, b: number) => ordem.get(`${a}-${b}`) ?? 1;

  const pos: (V3 | null)[] = el.map(() => null);
  const mae: number[] = el.map(() => -1);
  pos[0] = [0, 0, 0];
  // Raiz: primeiro vizinho no eixo x, os outros pela regra com uma referência fixa.
  const fila: number[] = [0];
  const colocarFilhos = (i: number) => {
    const filhos = viz[i].filter((j) => pos[j] === null);
    if (!filhos.length) return;
    let dirs: V3[];
    if (mae[i] < 0) {
      // Raiz: o primeiro vizinho vai para −x e os outros se arrumam em volta dele.
      const d: V3 = [-1, 0, 0];
      dirs = [d, ...direcoes(hib[i], d, [0, 1, 0])].slice(0, filhos.length);
    } else {
      const m = mae[i];
      const d = norm(subv(pos[m]!, pos[i]!));
      // Referência: o primeiro vizinho já colocado da mãe que não é este átomo.
      const irmao = viz[m].find((k) => k !== i && pos[k] !== null);
      const r: V3 = irmao !== undefined ? subv(pos[irmao]!, pos[m]!) : Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      dirs = direcoes(hib[i], d, r, ((torcoes[i] ?? 0) * Math.PI) / 180);
    }
    filhos.forEach((j, k) => {
      const L = comprimento(el[i], el[j], ord(i, j));
      pos[j] = add(pos[i]!, mul(dirs[k], L));
      mae[j] = i;
      fila.push(j);
    });
  };
  while (fila.length) colocarFilhos(fila.shift()!);

  const ligacoes: Molecula['ligacoes'] = [];
  viz.forEach((vs, a) => vs.forEach((b) => a < b && ligacoes.push({ a, b, ordem: ord(a, b) })));
  // Centraliza.
  const ps = pos as V3[];
  const c = mul(ps.reduce((s, p) => add(s, p), [0, 0, 0] as V3), 1 / ps.length);
  return { nome: spec.nome, el, pos: ps.map((p) => subv(p, c)), ligacoes };
}

/** Imagem no espelho (plano yz): o enantiômero. */
export const espelhar = (m: Molecula, nome: string): Molecula => ({ ...m, nome, pos: m.pos.map((p) => [-p[0], p[1], p[2]]) });

/** Fórmula molecular na ordem de Hill (C, H, depois alfabética). */
export function formula(m: Molecula): string {
  const cont: Record<string, number> = {};
  for (const e of m.el) cont[e] = (cont[e] ?? 0) + 1;
  const ordemEl = ['C', 'H', ...Object.keys(cont).filter((e) => e !== 'C' && e !== 'H').sort()];
  const sub = (n: number) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]));
  return ordemEl.filter((e) => cont[e]).map((e) => e + sub(cont[e])).join('');
}

export const distancia = (m: Molecula, i: number, j: number) => Math.hypot(...subv(m.pos[i], m.pos[j]));

export function angulo(m: Molecula, centro: number, i: number, j: number) {
  const u = norm(subv(m.pos[i], m.pos[centro]));
  const w = norm(subv(m.pos[j], m.pos[centro]));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, w)))) * 180) / Math.PI;
}

const Z: Record<Elemento, number> = { H: 1, C: 6, O: 8, F: 9, Cl: 17, Br: 35 };

/**
 * Configuração R ou S de um carbono com quatro vizinhos de elementos
 * diferentes (prioridade pelo número atômico, a regra de Cahn-Ingold-Prelog
 * no caso simples): olhando com o de menor prioridade para trás, 1→2→3 no
 * sentido horário é R.
 */
export function configuracao(m: Molecula, centro: number): 'R' | 'S' | null {
  const viz = m.ligacoes.filter((l) => l.a === centro || l.b === centro).map((l) => (l.a === centro ? l.b : l.a));
  if (viz.length !== 4) return null;
  const pr = [...viz].sort((a, b) => Z[m.el[b]] - Z[m.el[a]]);
  if (new Set(pr.map((i) => Z[m.el[i]])).size < 4) return null;
  const [a, b, c, d] = pr.map((i) => subv(m.pos[i], m.pos[centro]));
  // Volume orientado com o de menor prioridade (d) para trás.
  const v = dot(cross(subv(a, d), subv(b, d)), subv(c, d));
  return v < 0 ? 'R' : 'S';
}

// ---------------------------------------------------------------------------
// Pares de isômeros
// ---------------------------------------------------------------------------

export interface ParIsomeros {
  key: string;
  tipo: 'geométrica' | 'óptica' | 'de cadeia' | 'de posição' | 'de função';
  grupo: 'plana' | 'espacial';
  a: Molecula;
  b: Molecula;
  /** As duas moléculas montadas de novo com a ligação do `giro` torcida (graus). */
  girar: (graus: number) => [Molecula, Molecula];
  /** Átomo pesado cuja ligação com a mãe o aluno pode girar (`null`: nada a girar). */
  giro: { atomo: number; dupla: boolean } | null;
  /** Carbono quiral, nos pares ópticos. */
  quiral?: number;
  nota: string;
}

/** Par de duas moléculas montadas por especificação, com o mesmo átomo girável nas duas. */
function par(base: Omit<ParIsomeros, 'a' | 'b' | 'girar'>, A: MoleculaSpec, B: MoleculaSpec): ParIsomeros {
  const girar = (graus: number): [Molecula, Molecula] => {
    const t = base.giro && !base.giro.dupla ? { [base.giro.atomo]: graus } : {};
    return [montar(A, t), montar(B, t)];
  };
  const [a, b] = girar(0);
  return { ...base, a, b, girar };
}

/** Par de enantiômeros: a molécula e a sua imagem no espelho. */
function enantiomeros(base: Omit<ParIsomeros, 'a' | 'b' | 'girar'>, A: MoleculaSpec, nomeA: (m: Molecula) => string, nomeB: (m: Molecula) => string): ParIsomeros {
  const m = montar(A);
  const a = { ...m, nome: nomeA(m) };
  const b = espelhar(m, nomeB(m));
  return { ...base, a, b, girar: () => [a, b] };
}

const but2eno = (cis: boolean, nome: string): MoleculaSpec => ({
  nome,
  atomos: [
    { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
    { el: 'C', hib: 'sp2', liga: [0, 2, 'H'] },
    { el: 'C', hib: 'sp2', liga: cis ? [1, 3, 'H'] : [1, 'H', 3] },
    { el: 'C', hib: 'sp3', liga: [2, 'H', 'H', 'H'] },
  ],
  duplas: [[1, 2]],
});

const dicloroeteno = (cis: boolean, nome: string): MoleculaSpec => ({
  nome,
  atomos: [
    { el: 'C', hib: 'sp2', liga: [1, 2, 'H'] },
    { el: 'C', hib: 'sp2', liga: cis ? [0, 3, 'H'] : [0, 'H', 3] },
    { el: 'Cl', hib: 'sp3', liga: [0] },
    { el: 'Cl', hib: 'sp3', liga: [1] },
  ],
  duplas: [[0, 1]],
});

export const PARES: ParIsomeros[] = [
  par(
    {
      key: 'but-2-eno',
      tipo: 'geométrica',
      grupo: 'espacial',
      giro: { atomo: 2, dupla: true },
      nota: 'Os dois metilas do mesmo lado da dupla (cis) ou em lados opostos (trans). A dupla não gira, então um não vira o outro: são substâncias diferentes (o cis ferve a 3,7 °C, o trans a 0,9 °C).',
    },
    but2eno(true, 'cis-but-2-eno'),
    but2eno(false, 'trans-but-2-eno'),
  ),
  par(
    {
      key: 'dicloroeteno',
      tipo: 'geométrica',
      grupo: 'espacial',
      giro: { atomo: 1, dupla: true },
      nota: 'No cis os dois cloros ficam do mesmo lado e os dipolos se somam: a molécula é polar. No trans eles se cancelam e a molécula é apolar, por isso o cis ferve mais alto (60 °C contra 48 °C).',
    },
    dicloroeteno(true, 'cis-1,2-dicloroeteno'),
    dicloroeteno(false, 'trans-1,2-dicloroeteno'),
  ),
  enantiomeros(
    {
      key: 'chfclbr',
      tipo: 'óptica',
      grupo: 'espacial',
      giro: null,
      quiral: 0,
      nota: 'Um carbono com quatro grupos diferentes (carbono quiral, ou assimétrico). A molécula e a sua imagem no espelho não se sobrepõem, como a mão direita e a esquerda: são os enantiômeros, que desviam a luz polarizada em sentidos opostos.',
    },
    { nome: '', atomos: [{ el: 'C', hib: 'sp3', liga: [1, 2, 3, 'H'] }, { el: 'F', hib: 'sp3', liga: [0] }, { el: 'Cl', hib: 'sp3', liga: [0] }, { el: 'Br', hib: 'sp3', liga: [0] }] },
    (m) => `(${configuracao(m, 0)})-bromoclorofluorometano`,
    (m) => `(${configuracao(m, 0) === 'R' ? 'S' : 'R'})-bromoclorofluorometano`,
  ),
  enantiomeros(
    {
      key: 'butan-2-ol',
      tipo: 'óptica',
      grupo: 'espacial',
      giro: null,
      quiral: 0,
      nota: 'O carbono 2 tem H, OH, metil e etil: quatro grupos diferentes. Por isso existem dois butan-2-ol, um dextrogiro e um levogiro; a mistura meio a meio (racêmica) não desvia a luz.',
    },
    {
      nome: '',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 2, 3, 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 4, 'H', 'H'] },
        { el: 'O', hib: 'sp3', liga: [0, 'H'] },
        { el: 'C', hib: 'sp3', liga: [2, 'H', 'H', 'H'] },
      ],
    },
    () => 'butan-2-ol',
    () => 'butan-2-ol no espelho',
  ),
  par(
    {
      key: 'butano',
      tipo: 'de cadeia',
      grupo: 'plana',
      giro: { atomo: 2, dupla: false },
      nota: 'Mesma fórmula, C₄H₁₀, mas cadeia normal num e ramificada no outro. A ramificada é mais compacta, tem menos contato entre as moléculas e ferve mais baixo (−12 °C contra −1 °C).',
    },
    {
      nome: 'butano',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 2, 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [1, 3, 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [2, 'H', 'H', 'H'] },
      ],
    },
    {
      nome: 'metilpropano',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 2, 3, 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
      ],
    },
  ),
  par(
    {
      key: 'propanol',
      tipo: 'de posição',
      grupo: 'plana',
      giro: { atomo: 1, dupla: false },
      nota: 'Mesma cadeia e mesma função (álcool); muda só a posição do OH: no carbono da ponta ou no do meio. O propan-2-ol é o álcool isopropílico das farmácias.',
    },
    {
      nome: 'propan-1-ol',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 3, 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 2, 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
        { el: 'O', hib: 'sp3', liga: [0, 'H'] },
      ],
    },
    {
      nome: 'propan-2-ol',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 2, 3, 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 'H', 'H', 'H'] },
        { el: 'O', hib: 'sp3', liga: [0, 'H'] },
      ],
    },
  ),
  par(
    {
      key: 'etanol',
      tipo: 'de função',
      grupo: 'plana',
      giro: null,
      nota: 'Os dois são C₂H₆O, mas um é álcool e o outro é éter. O etanol faz pontes de hidrogênio (OH) e é líquido; o éter não faz e é gás à temperatura ambiente (ferve a −24 °C).',
    },
    {
      nome: 'etanol',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
        { el: 'C', hib: 'sp3', liga: [0, 2, 'H', 'H'] },
        { el: 'O', hib: 'sp3', liga: [1, 'H'] },
      ],
    },
    {
      nome: 'metoximetano',
      atomos: [
        { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
        { el: 'O', hib: 'sp3', liga: [0, 2] },
        { el: 'C', hib: 'sp3', liga: [1, 'H', 'H', 'H'] },
      ],
    },
  ),
];
