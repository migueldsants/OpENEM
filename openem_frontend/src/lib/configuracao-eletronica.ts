// Distribuição eletrônica: diagrama de Pauling (ordem de Madelung), forma
// abreviada com cerne de gás nobre, elétrons por camada, exceções ao
// princípio de Aufbau e íons. Puro e testado; a configuração real de cada
// elemento vem do catálogo (NIST), e esta lógica só a reorganiza e compara.

export type L = 's' | 'p' | 'd' | 'f';

export interface Subnivel {
  n: number;
  l: L;
  e: number;
}

export const CAPACIDADE: Record<L, number> = { s: 2, p: 6, d: 10, f: 14 };
const ORDEM_L: Record<L, number> = { s: 0, p: 1, d: 2, f: 3 };

/**
 * A ordem do diagrama de Pauling: as diagonais, de cima para baixo. Vai até o
 * 7p, o bastante para o elemento 118.
 */
export const ORDEM_PAULING: string[] = [
  '1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p',
];

/** As linhas do diagrama como os livros desenham (camada por camada). */
export const LINHAS_DIAGRAMA: string[][] = [
  ['1s'],
  ['2s', '2p'],
  ['3s', '3p', '3d'],
  ['4s', '4p', '4d', '4f'],
  ['5s', '5p', '5d', '5f'],
  ['6s', '6p', '6d'],
  ['7s', '7p'],
];

export const CAMADAS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

const GASES_NOBRES: [number, string][] = [
  [86, 'Rn'],
  [54, 'Xe'],
  [36, 'Kr'],
  [18, 'Ar'],
  [10, 'Ne'],
  [2, 'He'],
];

export function chave(s: Pick<Subnivel, 'n' | 'l'>): string {
  return `${s.n}${s.l}`;
}

/** "3d6" → { n: 3, l: 'd', e: 6 }. */
export function lerSubnivel(texto: string): Subnivel {
  const m = /^(\d)([spdf])(\d+)$/.exec(texto);
  if (!m) throw new Error(`subnível inválido: ${texto}`);
  return { n: Number(m[1]), l: m[2] as L, e: Number(m[3]) };
}

export function lerConfiguracao(lista: string[]): Subnivel[] {
  return lista.map(lerSubnivel);
}

export function totalEletrons(c: Subnivel[]): number {
  return c.reduce((t, s) => t + s.e, 0);
}

const indicePauling = (s: Pick<Subnivel, 'n' | 'l'>) => ORDEM_PAULING.indexOf(chave(s));

/** Ordem energética (a do diagrama de Pauling). */
export function ordemEnergetica(c: Subnivel[]): Subnivel[] {
  return [...c].sort((a, b) => indicePauling(a) - indicePauling(b));
}

/** Ordem geométrica (camada por camada, s/p/d/f dentro dela). */
export function ordemGeometrica(c: Subnivel[]): Subnivel[] {
  return [...c].sort((a, b) => a.n - b.n || ORDEM_L[a.l] - ORDEM_L[b.l]);
}

/** Distribuição prevista pelo diagrama de Pauling, preenchendo na ordem. */
export function distribuicaoPauling(eletrons: number): Subnivel[] {
  const out: Subnivel[] = [];
  let resto = eletrons;
  for (const k of ORDEM_PAULING) {
    if (resto <= 0) break;
    const s = { n: Number(k[0]), l: k[1] as L, e: 0 };
    s.e = Math.min(CAPACIDADE[s.l], resto);
    resto -= s.e;
    out.push(s);
  }
  return out;
}

function mapa(c: Subnivel[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of c) if (s.e > 0) m.set(chave(s), (m.get(chave(s)) ?? 0) + s.e);
  return m;
}

export function mesmaDistribuicao(a: Subnivel[], b: Subnivel[]): boolean {
  const ma = mapa(a);
  const mb = mapa(b);
  if (ma.size !== mb.size) return false;
  for (const [k, v] of ma) if (mb.get(k) !== v) return false;
  return true;
}

/**
 * A configuração real foge da prevista pelo diagrama de Pauling? (Cr, Cu, Pd,
 * Au, La, Gd, U…). Devolve a prevista para a tela mostrar a comparação.
 */
export function excecaoAufbau(real: Subnivel[]): Subnivel[] | null {
  const prevista = distribuicaoPauling(totalEletrons(real));
  return mesmaDistribuicao(real, prevista) ? null : ordemEnergetica(prevista);
}

const SOBRESCRITOS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sobrescrito = (n: number) =>
  String(n)
    .split('')
    .map((d) => SOBRESCRITOS[Number(d)])
    .join('');

/** [{3,d,6}, {4,s,2}] → "3d⁶ 4s²". */
export function formatar(c: Subnivel[]): string {
  return c
    .filter((s) => s.e > 0)
    .map((s) => `${chave(s)}${sobrescrito(s.e)}`)
    .join(' ');
}

/** A mesma, em texto simples para leitor de tela ("3d6 4s2"). */
export function formatarSimples(c: Subnivel[]): string {
  return c
    .filter((s) => s.e > 0)
    .map((s) => `${chave(s)}${s.e}`)
    .join(' ');
}

/** Distribuição completa de um gás nobre (o cerne da forma abreviada). */
function cerne(z: number): Subnivel[] {
  return distribuicaoPauling(z);
}

/**
 * Forma abreviada com o cerne do gás nobre anterior, em ordem energética:
 * Fe → "[Ar] 4s² 3d⁶". O cerne só entra se a configuração o contém inteiro.
 */
export function abreviada(c: Subnivel[]): { cerne: string | null; resto: Subnivel[] } {
  const total = totalEletrons(c);
  const m = mapa(c);
  for (const [zg, simbolo] of GASES_NOBRES) {
    if (zg >= total) continue;
    const base = cerne(zg);
    if (!base.every((s) => (m.get(chave(s)) ?? 0) >= s.e)) continue;
    const resto = new Map(m);
    for (const s of base) {
      const sobra = (resto.get(chave(s)) ?? 0) - s.e;
      if (sobra > 0) resto.set(chave(s), sobra);
      else resto.delete(chave(s));
    }
    const lista = [...resto].map(([k, e]) => ({ n: Number(k[0]), l: k[1] as L, e }));
    return { cerne: simbolo, resto: ordemEnergetica(lista) };
  }
  return { cerne: null, resto: ordemEnergetica(c) };
}

export function formatarAbreviada(c: Subnivel[]): string {
  const { cerne: g, resto } = abreviada(c);
  return g ? `[${g}] ${formatar(resto)}`.trim() : formatar(resto);
}

/** Elétrons por camada, de K (n = 1) até a última ocupada. */
export function porCamada(c: Subnivel[]): number[] {
  const max = Math.max(...c.filter((s) => s.e > 0).map((s) => s.n), 0);
  const out = Array.from({ length: max }, () => 0);
  for (const s of c) out[s.n - 1] += s.e;
  return out;
}

/** Camada de valência (a mais externa ocupada) e quantos elétrons tem. */
export function valencia(c: Subnivel[]): { n: number; camada: string; eletrons: number } {
  const camadas = porCamada(c);
  const n = camadas.length;
  return { n, camada: CAMADAS[n - 1], eletrons: camadas[n - 1] ?? 0 };
}

/**
 * Subnível mais energético: o último do diagrama de Pauling que está ocupado
 * (no Fe, 3d⁶; no Ca, 4s²).
 */
export function maisEnergetico(c: Subnivel[]): Subnivel | null {
  const ocupados = ordemEnergetica(c.filter((s) => s.e > 0));
  return ocupados[ocupados.length - 1] ?? null;
}

/**
 * Configuração de um íon a partir da do átomo neutro (a real). Cátion: os
 * elétrons saem da camada mais externa primeiro (maior n; no empate, maior l):
 * Fe²⁺ perde os dois 4s antes de tocar no 3d. Ânion: os elétrons entram na
 * ordem do diagrama de Pauling, no primeiro subnível que não está cheio.
 * Devolve null se a carga não faz sentido (tirar mais elétrons do que há).
 */
export function distribuicaoIon(real: Subnivel[], carga: number): Subnivel[] | null {
  const lista = real.filter((s) => s.e > 0).map((s) => ({ ...s }));
  if (carga > 0) {
    if (carga > totalEletrons(lista)) return null;
    for (let i = 0; i < carga; i++) {
      const alvo = [...lista].filter((s) => s.e > 0).sort((a, b) => b.n - a.n || ORDEM_L[b.l] - ORDEM_L[a.l])[0];
      alvo.e -= 1;
    }
    return ordemGeometrica(lista.filter((s) => s.e > 0));
  }
  for (let i = 0; i < -carga; i++) {
    let colocado = false;
    for (const k of ORDEM_PAULING) {
      const n = Number(k[0]);
      const l = k[1] as L;
      let s = lista.find((x) => x.n === n && x.l === l);
      if (s && s.e >= CAPACIDADE[l]) continue;
      if (!s) {
        s = { n, l, e: 0 };
        lista.push(s);
      }
      s.e += 1;
      colocado = true;
      break;
    }
    if (!colocado) return null;
  }
  return ordemGeometrica(lista);
}

/** Um quadro da animação passo a passo do diagrama. */
export interface Passo {
  /** Elétrons em cada subnível neste quadro ("3d" → 6). */
  ocupacao: Record<string, number>;
  /** O subnível que mudou neste quadro. */
  destaque: string | null;
  tipo: 'encher' | 'ajuste' | 'retirar' | 'acrescentar';
  texto: string;
}

/**
 * Os quadros da distribuição passo a passo: enche o diagrama na ordem de
 * Pauling até o número de elétrons do átomo; se o elemento é uma exceção,
 * um quadro mostra o ajuste para a configuração real; e, para íons, um quadro
 * por subnível que perde ou ganha elétrons.
 */
export function passosDistribuicao(real: Subnivel[], carga = 0): Passo[] {
  const total = totalEletrons(real);
  const passos: Passo[] = [];
  const ocupacao: Record<string, number> = {};
  for (const s of distribuicaoPauling(total)) {
    ocupacao[chave(s)] = s.e;
    passos.push({
      ocupacao: { ...ocupacao },
      destaque: chave(s),
      tipo: 'encher',
      texto: `${chave(s)}${sobrescrito(s.e)}`,
    });
  }
  const excecao = excecaoAufbau(real);
  if (excecao) {
    const atual: Record<string, number> = {};
    for (const s of real) if (s.e > 0) atual[chave(s)] = s.e;
    const mudou = Object.keys({ ...ocupacao, ...atual }).filter((k) => (ocupacao[k] ?? 0) !== (atual[k] ?? 0));
    passos.push({
      ocupacao: atual,
      destaque: mudou.sort((a, b) => ORDEM_PAULING.indexOf(b) - ORDEM_PAULING.indexOf(a))[0] ?? null,
      tipo: 'ajuste',
      texto: `Na realidade: ${formatarAbreviada(ordemGeometrica(real))}`,
    });
  }
  if (carga !== 0) {
    const ion = distribuicaoIon(real, carga);
    if (ion) {
      let antes: Record<string, number> = {};
      for (const s of real) if (s.e > 0) antes[chave(s)] = s.e;
      const depois: Record<string, number> = {};
      for (const s of ion) depois[chave(s)] = s.e;
      // Um quadro por subnível alterado, na ordem em que os elétrons saem
      // (ou entram).
      const alterados = Object.keys({ ...antes, ...depois }).filter((k) => (antes[k] ?? 0) !== (depois[k] ?? 0));
      alterados.sort((a, b) =>
        carga > 0
          ? Number(b[0]) - Number(a[0]) || ORDEM_L[b[1] as L] - ORDEM_L[a[1] as L]
          : ORDEM_PAULING.indexOf(a) - ORDEM_PAULING.indexOf(b),
      );
      for (const k of alterados) {
        const proximo = { ...antes, [k]: depois[k] ?? 0 };
        if (!proximo[k]) delete proximo[k];
        const diff = (depois[k] ?? 0) - (antes[k] ?? 0);
        passos.push({
          ocupacao: proximo,
          destaque: k,
          tipo: carga > 0 ? 'retirar' : 'acrescentar',
          texto: diff < 0 ? `${-diff > 1 ? 'saem' : 'sai'} ${-diff} de ${k}` : `${diff > 1 ? 'entram' : 'entra'} ${diff} em ${k}`,
        });
        antes = proximo;
      }
    }
  }
  return passos;
}
