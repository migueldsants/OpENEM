/**
 * Modelos pequenos das simulações interativas: soma de vetores (Física),
 * cruzamentos de Mendel com o quadro de Punnett (Biologia) e fusos horários
 * (Geografia).
 */

// ---------------------------------------------------------------------------
// Vetores
// ---------------------------------------------------------------------------

export type Vetor = readonly [number, number];

export const somaVetores = (vs: readonly Vetor[]): [number, number] => vs.reduce<[number, number]>((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
export const modulo = (v: Vetor) => Math.hypot(v[0], v[1]);
/** Direção em graus, de 0 a 360, a partir do eixo x no sentido anti-horário. */
export const direcao = (v: Vetor) => ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360;
/** Ângulo entre dois vetores (graus, 0 a 180). */
export function anguloEntre(a: Vetor, b: Vetor) {
  const c = (a[0] * b[0] + a[1] * b[1]) / (modulo(a) * modulo(b) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
/** Módulo da soma de dois vetores pela lei dos cossenos: |R|² = a² + b² + 2ab·cos θ. */
export const leiDosCossenos = (a: number, b: number, thetaGraus: number) => Math.sqrt(Math.max(0, a * a + b * b + 2 * a * b * Math.cos((thetaGraus * Math.PI) / 180)));

// ---------------------------------------------------------------------------
// Genética de Mendel
// ---------------------------------------------------------------------------

export type Dominancia = 'completa' | 'incompleta';

/** Genótipo de um gene: dois alelos, maiúsculo dominante (ex.: "Aa"). No ligado ao X o macho tem um só ("XᴬY" vira "A" + "Y"). */
export type Genotipo = string;

export interface Gene {
  letra: string;
  dominante: string; // fenótipo do alelo dominante
  recessivo: string;
  intermediario?: string; // na dominância incompleta
  dominancia: Dominancia;
}

/** Normaliza a ordem dos alelos de um gene (dominante primeiro): "aA" → "Aa". */
export const ordenarAlelos = (g: string) => [...g].sort((x, y) => (x === y ? 0 : x === x.toUpperCase() ? -1 : 1)).join('');

/** Gametas de um genótipo de vários genes (segregação independente, 2ª lei de Mendel), com a proporção. */
export function gametas(genes: Genotipo[]): { gameta: string[]; p: number }[] {
  let out: { gameta: string[]; p: number }[] = [{ gameta: [], p: 1 }];
  for (const g of genes) {
    const alelos = [...g];
    const novo: { gameta: string[]; p: number }[] = [];
    for (const o of out) for (const a of alelos) novo.push({ gameta: [...o.gameta, a], p: o.p / alelos.length });
    out = novo;
  }
  // Junta gametas iguais (AA dá um gameta só).
  const mapa = new Map<string, { gameta: string[]; p: number }>();
  for (const o of out) {
    const k = o.gameta.join('');
    const e = mapa.get(k);
    if (e) e.p += o.p;
    else mapa.set(k, { ...o });
  }
  return [...mapa.values()];
}

export function fenotipo(gene: Gene, par: string): string {
  const dom = par.split('').filter((a) => a === gene.letra.toUpperCase()).length;
  if (gene.dominancia === 'incompleta') return dom === 2 ? gene.dominante : dom === 1 ? (gene.intermediario ?? gene.dominante) : gene.recessivo;
  return dom > 0 ? gene.dominante : gene.recessivo;
}

export interface Resultado {
  quadro: { linha: string[]; coluna: string[]; filho: string[] }[][];
  gametasPai: { gameta: string[]; p: number }[];
  gametasMae: { gameta: string[]; p: number }[];
  genotipos: { g: string; p: number }[];
  fenotipos: { f: string; p: number }[];
}

/** Cruzamento com o quadro de Punnett. */
export function cruzar(genes: Gene[], pai: Genotipo[], mae: Genotipo[]): Resultado {
  const gp = gametas(pai);
  const gm = gametas(mae);
  const contaG = new Map<string, number>();
  const contaF = new Map<string, number>();
  const quadro = gp.map((a) =>
    gm.map((b) => {
      const filho = genes.map((_, i) => ordenarAlelos(a.gameta[i] + b.gameta[i]));
      const p = a.p * b.p;
      const g = filho.join(' ');
      contaG.set(g, (contaG.get(g) ?? 0) + p);
      const f = genes.map((gene, i) => fenotipo(gene, filho[i])).join(', ');
      contaF.set(f, (contaF.get(f) ?? 0) + p);
      return { linha: a.gameta, coluna: b.gameta, filho };
    }),
  );
  const ordenar = <T extends { p: number }>(xs: T[]) => xs.sort((x, y) => y.p - x.p);
  return {
    quadro,
    gametasPai: gp,
    gametasMae: gm,
    genotipos: ordenar([...contaG].map(([g, p]) => ({ g, p }))),
    fenotipos: ordenar([...contaF].map(([f, p]) => ({ f, p }))),
  };
}

/** Proporção em números inteiros pequenos (ex.: [0,75, 0,25] → "3 : 1"). */
export function proporcao(ps: number[]): string {
  for (let d = 1; d <= 64; d++) {
    const ns = ps.map((p) => p * d);
    if (ns.every((n) => Math.abs(n - Math.round(n)) < 1e-9)) return ns.map((n) => Math.round(n)).join(' : ');
  }
  return ps.map((p) => p.toFixed(2)).join(' : ');
}

// ---------------------------------------------------------------------------
// Fusos horários
// ---------------------------------------------------------------------------

export interface Cidade {
  nome: string;
  lat: number;
  lon: number;
  /** Fuso oficial em horas (sem horário de verão). */
  fuso: number;
}

export const CIDADES: Cidade[] = [
  { nome: 'Brasília', lat: -15.8, lon: -47.9, fuso: -3 },
  { nome: 'Manaus', lat: -3.1, lon: -60.0, fuso: -4 },
  { nome: 'Rio Branco', lat: -9.97, lon: -67.8, fuso: -5 },
  { nome: 'Fernando de Noronha', lat: -3.85, lon: -32.4, fuso: -2 },
  { nome: 'Lisboa', lat: 38.7, lon: -9.1, fuso: 0 },
  { nome: 'Londres', lat: 51.5, lon: -0.1, fuso: 0 },
  { nome: 'Luanda', lat: -8.8, lon: 13.2, fuso: 1 },
  { nome: 'Moscou', lat: 55.8, lon: 37.6, fuso: 3 },
  { nome: 'Nova Délhi', lat: 28.6, lon: 77.2, fuso: 5.5 },
  { nome: 'Pequim', lat: 39.9, lon: 116.4, fuso: 8 },
  { nome: 'Tóquio', lat: 35.7, lon: 139.7, fuso: 9 },
  { nome: 'Sydney', lat: -33.9, lon: 151.2, fuso: 10 },
  { nome: 'Nova York', lat: 40.7, lon: -74.0, fuso: -5 },
  { nome: 'Los Angeles', lat: 34.1, lon: -118.2, fuso: -8 },
];

/** Fuso teórico: faixas de 15° centradas nos meridianos múltiplos de 15°. */
export const fusoTeorico = (lon: number) => Math.round(lon / 15);

/** Hora solar média do lugar (h), a partir da hora de Greenwich: 4 minutos por grau. */
export const horaSolar = (utc: number, lon: number) => (((utc + lon / 15) % 24) + 24) % 24;

/** Hora oficial (h) a partir da hora de Greenwich. */
export const horaOficial = (utc: number, fuso: number) => (((utc + fuso) % 24) + 24) % 24;

/** "07:30" a partir de horas decimais. */
export function relogio(h: number): string {
  const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Diferença de horário de B em relação a A (h): positiva se em B já é mais tarde. */
export const diferenca = (a: Cidade, b: Cidade) => b.fuso - a.fuso;

// ---------------------------------------------------------------------------
// Colisão em uma dimensão
// ---------------------------------------------------------------------------

/**
 * Velocidades depois da colisão frontal de dois corpos. O momento linear se
 * conserva sempre; o coeficiente de restituição `e` diz quanto da velocidade
 * relativa volta: 1 = elástica (a energia cinética se conserva), 0 =
 * perfeitamente inelástica (saem grudados).
 */
export function colisao1D(m1: number, v1: number, m2: number, v2: number, e: number): [number, number] {
  const p = m1 * v1 + m2 * v2;
  const M = m1 + m2;
  return [(p - m2 * e * (v1 - v2)) / M, (p + m1 * e * (v1 - v2)) / M];
}

export const energiaCinetica = (m: number, v: number) => (m * v * v) / 2;

// ---------------------------------------------------------------------------
// Osmose
// ---------------------------------------------------------------------------

export type TipoCelula = 'animal' | 'vegetal';

/** Concentração do interior da célula no início (osmol/L): a do soro fisiológico, 0,9% de NaCl. */
export const C_CELULA = 0.3;
/** A célula animal estoura (lise) com 1,6× o volume; a parede da vegetal segura em 1,25×. */
export const V_LISE = 1.6;
export const V_PAREDE = 1.25;
export const V_MIN = 0.35;

/** A solução de fora em relação à célula. */
export function tonicidade(cFora: number, cDentro: number): 'hipotônica' | 'isotônica' | 'hipertônica' {
  if (Math.abs(cFora - cDentro) <= 0.02 * Math.max(cDentro, 0.01)) return 'isotônica';
  return cFora < cDentro ? 'hipotônica' : 'hipertônica';
}

/**
 * Um passo da osmose. A água atravessa a membrana para o lado mais
 * concentrado: dV/dt = P·(c_dentro − c_fora), com c_dentro = n/V (o soluto
 * não atravessa, então n é constante). V em unidades do volume inicial.
 */
export function passoOsmose(V: number, n: number, cFora: number, dt: number, P: number, tipo: TipoCelula): number {
  const novo = V + P * (n / V - cFora) * dt;
  return Math.max(V_MIN, Math.min(tipo === 'animal' ? V_LISE : V_PAREDE, novo));
}

/** Volume em que as concentrações se igualam (infinito em água pura). */
export const volumeEquilibrio = (n: number, cFora: number) => (cFora > 0 ? n / cFora : Infinity);

export function estadoCelula(tipo: TipoCelula, V: number): string {
  if (tipo === 'animal') {
    if (V >= V_LISE - 1e-6) return 'lise (estourou)';
    if (V > 1.08) return 'inchada';
    if (V < 0.92) return 'murcha (crenada)';
    return 'normal';
  }
  if (V >= V_PAREDE - 1e-6) return 'túrgida';
  if (V > 1.08) return 'quase túrgida';
  if (V < 0.85) return 'plasmolisada';
  return 'flácida';
}
