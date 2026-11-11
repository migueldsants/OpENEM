/**
 * Monte um átomo: prótons, nêutrons e elétrons, limitados ao que existe. O
 * elemento e as propriedades vêm do catálogo da tabela periódica
 * (`data/elementos.json`); os isótopos, da lista de nuclídeos já observados
 * da IAEA (`data/nuclideos.json`, gerada pela mesma ferramenta); os íons, dos
 * estados de oxidação do catálogo. A configuração eletrônica do átomo e do íon
 * usa as mesmas funções da tabela (`lib/configuracao-eletronica.ts`).
 */
import { distribuicaoIon, lerConfiguracao, porCamada, type Subnivel } from '../configuracao-eletronica';
import type { Elemento } from '../elementos';
import { criarRng } from './numerico';

export interface Nuclideo {
  a: number;
  /** null: estável (ou meia-vida desconhecida, ver `meiaVida`). */
  meiaVidaSeg: number | null;
  meiaVida: string;
  unidade: string;
  decaimento: string;
  /** Abundância natural (%), quando há. */
  abundancia: number | null;
}

export interface CatalogoNuclideos {
  fonte: string;
  conferidoEm: string;
  nuclideos: Record<string, [number, number | null, string, string, string, number | null][]>;
}

export function lerNuclideos(c: CatalogoNuclideos): Map<number, Nuclideo[]> {
  const m = new Map<number, Nuclideo[]>();
  for (const [z, lista] of Object.entries(c.nuclideos)) {
    m.set(
      Number(z),
      lista.map(([a, meiaVidaSeg, meiaVida, unidade, decaimento, abundancia]) => ({ a, meiaVidaSeg, meiaVida, unidade, decaimento, abundancia })),
    );
  }
  return m;
}

export const estavel = (n: Nuclideo) => n.meiaVida === 'estável';

/**
 * Isótopo que o simulador mostra ao trocar de elemento: o natural mais
 * abundante (NIST, pelo catálogo); sem isótopo natural, o de vida mais longa
 * (CIAAW/IAEA, pelo catálogo); sem nenhum dos dois, o de maior meia-vida da lista.
 */
export function isotopoPadrao(e: Elemento, nucs: Nuclideo[]): number {
  if (e.isotopos.length) {
    const ab = (s: string) => Number(s.replace(/\(.*\)/, ''));
    return [...e.isotopos].sort((x, y) => ab(y.abundancia) - ab(x.abundancia))[0].a;
  }
  if (e.isotopoMaisEstavel && nucs.some((n) => n.a === e.isotopoMaisEstavel!.a)) return e.isotopoMaisEstavel.a;
  return [...nucs].sort((x, y) => (y.meiaVidaSeg ?? 0) - (x.meiaVidaSeg ?? 0))[0]?.a ?? e.z * 2;
}

/** Próximo número de massa que existe, no sentido pedido (null se acabou). */
export function vizinhoA(nucs: Nuclideo[], a: number, sentido: 1 | -1): number | null {
  const as = nucs.map((n) => n.a).sort((x, y) => x - y);
  return sentido > 0 ? (as.find((x) => x > a) ?? null) : ([...as].reverse().find((x) => x < a) ?? null);
}

export type TipoIon = 'neutro' | 'comum' | 'conhecido' | 'plasma';

/**
 * Cargas que o simulador aceita para o elemento. Ânion só com carga que
 * aparece nos estados de oxidação do catálogo (Cl⁻ existe, Cl²⁻ não; o neônio
 * não forma ânion). Cátion pode ir até perder todos os elétrons, porque
 * arrancar elétrons sempre é possível (no plasma, no Sol); o rótulo diz se o
 * íon é comum, conhecido em compostos ou só existe arrancando à força.
 */
export function cargasPossiveis(e: Elemento): { min: number; max: number } {
  const negativas = e.oxidacao.todos.filter((x) => x < 0);
  return { min: negativas.length ? Math.min(...negativas) : 0, max: e.z };
}

export function tipoIon(e: Elemento, carga: number): TipoIon {
  if (carga === 0) return 'neutro';
  if (e.oxidacao.comuns.includes(carga)) return 'comum';
  if (e.oxidacao.todos.includes(carga)) return 'conhecido';
  return 'plasma';
}

/** Íons para os atalhos: os comuns primeiro, depois os outros conhecidos (máximo de seis). */
export function ionsSugeridos(e: Elemento): number[] {
  const ok = (c: number) => c !== 0 && c <= e.z;
  const comuns = e.oxidacao.comuns.filter(ok);
  const outros = e.oxidacao.todos.filter((c) => ok(c) && !comuns.includes(c));
  return [...comuns, ...outros].slice(0, 6);
}

/** Configuração eletrônica do átomo ou do íon, pela mesma regra da tabela periódica. */
export function configuracaoDe(e: Elemento, carga: number): Subnivel[] | null {
  const real = lerConfiguracao(e.configuracao);
  return carga === 0 ? real : distribuicaoIon(real, carga);
}

export const camadas = (c: Subnivel[]) => porCamada(c);

const SOB = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sobrescrito = (n: number) => String(n).replace(/\d/g, (d) => SOB[Number(d)]);

/** Carga escrita como na química: "", "+", "2+", "3−". */
export function textoCarga(carga: number): string {
  if (carga === 0) return '';
  const n = Math.abs(carga);
  return `${n === 1 ? '' : n}${carga > 0 ? '+' : '−'}`;
}

/** Notação de nuclídeo em texto: ¹⁴C, ²³⁵U. */
export const notacaoA = (simbolo: string, a: number) => `${sobrescrito(a)}${simbolo}`;

/** Meia-vida legível: "5 700 anos", "12,3 anos", "0,0163 s", "2,2·10⁻²¹ s". */
export function meiaVidaTexto(n: Nuclideo): string {
  if (estavel(n)) return 'estável';
  const s = n.meiaVidaSeg;
  if (s == null) return 'desconhecida';
  const ANO = 365.2422 * 86400;
  const fmt = (v: number) => {
    if (v >= 1e6 || v < 1e-3) {
      const exp = Math.floor(Math.log10(v));
      const man = v / 10 ** exp;
      return `${man.toFixed(1).replace('.', ',')}·10${String(exp).replace('-', '⁻').replace(/\d/g, (d) => SOB[Number(d)])}`;
    }
    return v.toLocaleString('pt-BR', { maximumSignificantDigits: 3 });
  };
  if (s >= ANO) return `${fmt(s / ANO)} anos`;
  if (s >= 86400) return `${fmt(s / 86400)} dias`;
  if (s >= 3600) return `${fmt(s / 3600)} h`;
  if (s >= 60) return `${fmt(s / 60)} min`;
  return `${fmt(s)} s`;
}

// ---------------------------------------------------------------------------
// Geometria para desenhar
// ---------------------------------------------------------------------------

export type V3 = [number, number, number];

/**
 * Núcleo como uma bola de A esferas: cada núcleon numa casca que cresce com a
 * raiz cúbica (densidade constante, R ∝ A^⅓) e espalhado pela espiral de
 * Fibonacci. Prótons e nêutrons sorteados com semente: o mesmo núcleo sempre
 * sai igual.
 */
export function nucleo(z: number, n: number, raioNucleon = 1): { pos: V3; proton: boolean }[] {
  const a = z + n;
  const R = raioNucleon * 1.05 * Math.cbrt(a);
  const ouro = Math.PI * (3 - Math.sqrt(5));
  const tipos = Array.from({ length: a }, (_, i) => i < z);
  const r = criarRng(a * 1000 + z);
  for (let i = a - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tipos[i], tipos[j]] = [tipos[j], tipos[i]];
  }
  return tipos.map((proton, i) => {
    const raio = a === 1 ? 0 : R * Math.cbrt((i + 0.5) / a);
    const y = 1 - (2 * (i + 0.5)) / a;
    const anel = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ouro * i;
    return { pos: [Math.cos(th) * anel * raio, y * raio, Math.sin(th) * anel * raio], proton };
  });
}

/** Caixinhas do diagrama de orbitais de um subnível pela regra de Hund: 1 = ↑, 2 = ↑↓. */
export function caixasHund(l: Subnivel['l'], eletrons: number): number[] {
  const n = { s: 1, p: 3, d: 5, f: 7 }[l];
  const caixas = new Array<number>(n).fill(0);
  for (let i = 0; i < eletrons; i++) caixas[i % n] += 1;
  return caixas;
}

/** Orbitais de um subnível com os elétrons de cada um (Hund), para a nuvem do modelo quântico. */
export function orbitais(s: Subnivel): { forma: string; eletrons: number }[] {
  const formas = { s: ['s'], p: ['px', 'py', 'pz'], d: ['dxy', 'dxz', 'dyz', 'dx2y2', 'dz2'], f: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] }[s.l];
  return caixasHund(s.l, s.e).map((e, i) => ({ forma: formas[i], eletrons: e })).filter((o) => o.eletrons > 0);
}

/** Peso angular |Y|² de cada forma de orbital (sem normalizar), para sortear a nuvem. */
function pesoAngular(forma: string, x: number, y: number, z: number): number {
  switch (forma) {
    case 's':
      return 1;
    case 'px':
      return x * x;
    case 'py':
      return y * y;
    case 'pz':
      return z * z;
    case 'dxy':
      return 4 * (x * y) ** 2;
    case 'dxz':
      return 4 * (x * z) ** 2;
    case 'dyz':
      return 4 * (y * z) ** 2;
    case 'dx2y2':
      return (x * x - y * y) ** 2;
    case 'dz2':
      return ((3 * z * z - 1) ** 2) / 4;
    default: {
      // Orbitais f: formas com lobos em várias direções (aproximação visual).
      const k = Number(forma.slice(1));
      const t = [x * y * z, x * (x * x - 3 * y * y), y * (3 * x * x - y * y), z * (5 * z * z - 3), x * (5 * z * z - 1), y * (5 * z * z - 1), z * (x * x - y * y)][k - 1];
      return 3 * t * t;
    }
  }
}

/**
 * Pontos de uma nuvem de probabilidade: direção sorteada pela forma do
 * orbital (aceitação e rejeição em |Y|²) e distância pela distribuição radial
 * do tipo hidrogênio, r² e^(−2r/n)·r^(2(n−1)), uma gama de forma 2n + 1,
 * normalizada para o raio médio crescer como n (no átomo de verdade a carga
 * do núcleo encolhe as camadas de dentro, e n² deixaria a nuvem enorme).
 */
export function nuvem(forma: string, nQuantico: number, pontos: number, semente: number, escala = 1): V3[] {
  const r = criarRng(semente);
  const out: V3[] = [];
  let tentativas = 0;
  while (out.length < pontos && tentativas < pontos * 60) {
    tentativas++;
    // Direção uniforme na esfera.
    const u = 2 * r() - 1;
    const phi = 2 * Math.PI * r();
    const s = Math.sqrt(1 - u * u);
    const x = s * Math.cos(phi);
    const y = s * Math.sin(phi);
    const z = u;
    if (r() > pesoAngular(forma, x, y, z)) continue;
    // Gama(2n + 1, n/2) como soma de exponenciais.
    let raio = 0;
    for (let k = 0; k < 2 * nQuantico + 1; k++) raio -= Math.log(1 - r() + 1e-12);
    raio *= (0.9 * nQuantico * escala) / (2 * nQuantico + 1);
    out.push([x * raio, z * raio, y * raio]);
  }
  return out;
}

/** Raio da camada n no modelo de Bohr desenhado (cresce menos que n² para caber na tela). */
export const raioCamada = (n: number) => 1.4 + n * 1.05;
