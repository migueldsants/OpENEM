/**
 * Ferramentas numéricas das simulações: integradores, gerador aleatório com
 * semente e busca de raiz. Tudo puro, sem DOM, para poder ser testado contra
 * as soluções analíticas.
 */

export type Estado = readonly number[];
export type Derivada = (t: number, y: Estado) => number[];

/** Um passo de Runge-Kutta de 4ª ordem (erro global ~h⁴). */
export function rk4(f: Derivada, t: number, y: Estado, h: number): number[] {
  const n = y.length;
  const k1 = f(t, y);
  const y2 = new Array<number>(n);
  for (let i = 0; i < n; i++) y2[i] = y[i] + (h / 2) * k1[i];
  const k2 = f(t + h / 2, y2);
  const y3 = new Array<number>(n);
  for (let i = 0; i < n; i++) y3[i] = y[i] + (h / 2) * k2[i];
  const k3 = f(t + h / 2, y3);
  const y4 = new Array<number>(n);
  for (let i = 0; i < n; i++) y4[i] = y[i] + h * k3[i];
  const k4 = f(t + h, y4);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return out;
}

/**
 * Avança `y` por `duracao` segundos em passos de no máximo `hMax`. Usado pela
 * animação: o quadro tem duração variável, o passo do integrador não.
 */
export function avancar(
  f: Derivada,
  t: number,
  y: Estado,
  duracao: number,
  hMax: number,
): { t: number; y: number[] } {
  let atual = [...y];
  let tempo = t;
  if (duracao <= 0) return { t, y: atual };
  const passos = Math.max(1, Math.ceil(duracao / hMax));
  const h = duracao / passos;
  for (let i = 0; i < passos; i++) {
    atual = rk4(f, tempo, atual, h);
    tempo += h;
  }
  return { t: tempo, y: atual };
}

/** Gerador pseudoaleatório com semente (mulberry32): testes reprodutíveis. */
export function criarRng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal padrão (Box-Muller). */
export function normal(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Sorteio binomial exato (soma de Bernoullis): n até alguns milhares. */
export function binomial(n: number, p: number, rng: () => number): number {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

/** Raiz de `f` em [a, b] por bissecção; exige mudança de sinal. */
export function bissecao(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-12,
  maxIter = 200,
): number {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error('bissecao: sem troca de sinal no intervalo');
  let lo = a;
  let hi = b;
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    const m = (lo + hi) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (fa * fm < 0) hi = m;
    else {
      lo = m;
      fa = fm;
    }
  }
  return (lo + hi) / 2;
}

/** Média aritmético-geométrica (base da integral elíptica completa). */
export function agm(a: number, b: number): number {
  let x = a;
  let y = b;
  for (let i = 0; i < 40 && Math.abs(x - y) > 1e-15 * x; i++) {
    const m = (x + y) / 2;
    y = Math.sqrt(x * y);
    x = m;
  }
  return x;
}

/** Integral elíptica completa de 1ª espécie K(k), módulo k. */
export function elipticaK(k: number): number {
  return Math.PI / (2 * agm(1, Math.sqrt(1 - k * k)));
}

export const clamp = (x: number, min: number, max: number) =>
  Math.min(max, Math.max(min, x));

export const grausParaRad = (g: number) => (g * Math.PI) / 180;
export const radParaGraus = (r: number) => (r * 180) / Math.PI;

/** Formata número em pt-BR com casas fixas (vírgula decimal). */
export function fmt(x: number, casas = 2): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Notação científica legível: 1,23 × 10⁻⁴. */
export function fmtCientifico(x: number, casas = 2): string {
  if (x === 0) return '0';
  if (!Number.isFinite(x)) return fmt(x);
  const exp = Math.floor(Math.log10(Math.abs(x)));
  if (exp >= -2 && exp <= 4) return fmt(x, Math.max(0, casas - Math.max(0, exp)));
  const mant = x / 10 ** exp;
  const sup: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  };
  const e = String(exp).split('').map((c) => sup[c]).join('');
  return `${fmt(mant, casas)} × 10${e}`;
}
