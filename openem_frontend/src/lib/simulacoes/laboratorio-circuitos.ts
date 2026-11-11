/**
 * Laboratório de eletrodinâmica: o aluno monta o circuito numa bancada em
 * grade, com cada peça ligando dois pontos vizinhos, e o circuito é resolvido
 * por análise nodal (leis de Kirchhoff) a cada mudança.
 *
 * Modelos:
 * - fio, chave fechada e amperímetro: resistência quase nula (1 mΩ);
 * - bateria: fonte ideal ε em série com a resistência interna r, escrita como
 *   o equivalente de Norton (corrente ε/r em paralelo com 1/r), sem incógnita
 *   extra na matriz;
 * - lâmpada: resistor de R = U²/P (valores nominais, filamento a quente);
 *   queima quando dissipa mais que `QUEIMA` vezes a potência nominal;
 * - resistor: R escolhido pelo aluno;
 * - voltímetro ideal e chave aberta: não conduzem.
 */
import { resolverLinear } from './eletromagnetismo';

export type TipoPeca = 'fio' | 'bateria' | 'lampada' | 'resistor' | 'chave' | 'amperimetro' | 'voltimetro';

/** Ponto da bancada: coluna e linha da grade. */
export type Ponto = readonly [number, number];

export interface Peca {
  id: string;
  tipo: TipoPeca;
  /** Pontos vizinhos na grade. Na bateria, `a` é o polo negativo e `b` o positivo. */
  a: Ponto;
  b: Ponto;
  /** Bateria: fem em V. Resistor: resistência em Ω. Lâmpada: potência nominal em W. */
  valor?: number;
  /** Chave: fechada conduz. */
  fechada?: boolean;
  queimada?: boolean;
}

export const COLUNAS = 8;
export const LINHAS = 5;

export const R_FIO = 1e-3;
export const R_INTERNA = 0.5;
/** Todas as lâmpadas da bancada são de 6 V; o aluno escolhe a potência. */
export const U_LAMPADA = 6;
/** Uma lâmpada aguenta até 2,25× a potência nominal (1,5× a tensão) antes de queimar. */
export const QUEIMA = 2.25;
/** Acima disso a bateria está em curto (a corrente só é limitada pela resistência interna). */
export const CORRENTE_CURTO = 5;

const GMIN = 1e-9;

export const resistenciaLampada = (P: number) => (U_LAMPADA * U_LAMPADA) / P;

/** Resistência da peça no circuito; `null` quando não conduz. */
export function resistenciaDa(p: Peca): number | null {
  switch (p.tipo) {
    case 'fio':
    case 'amperimetro':
      return R_FIO;
    case 'chave':
      return p.fechada ? R_FIO : null;
    case 'lampada':
      return p.queimada ? null : resistenciaLampada(p.valor ?? 3);
    case 'resistor':
      return p.valor ?? 10;
    case 'bateria':
      return R_INTERNA;
    case 'voltimetro':
      return null;
  }
}

export const chavePonto = (p: Ponto) => `${p[0]},${p[1]}`;

/** Chave da aresta, igual nos dois sentidos. */
export function chaveAresta(a: Ponto, b: Ponto) {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? [a, b] : [b, a];
  return `${chavePonto(p)}|${chavePonto(q)}`;
}

export const saoVizinhos = (a: Ponto, b: Ponto) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

export interface ResultadoLab {
  /** Corrente de `a` para `b` (A); na bateria, de − para + por dentro, isto é, a que ela entrega. */
  correntes: Record<string, number>;
  /** V(b) − V(a) (V). Na bateria, a tensão nos terminais; no voltímetro, a leitura. */
  tensoes: Record<string, number>;
  /** Potência dissipada (W); na bateria, a entregue ao circuito. */
  potencias: Record<string, number>;
  /** Potencial de cada ponto usado, pela chave do ponto. */
  potenciais: Record<string, number>;
  curto: boolean;
}

/** Resolve a bancada por análise nodal. */
export function resolverLab(pecas: readonly Peca[]): ResultadoLab {
  // Só os pontos que alguma peça usa entram na matriz.
  const indice = new Map<string, number>();
  for (const p of pecas) {
    for (const pt of [p.a, p.b]) {
      const k = chavePonto(pt);
      if (!indice.has(k)) indice.set(k, indice.size);
    }
  }
  const n = indice.size;
  const G = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const I = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) G[i][i] += GMIN;
  const estampar = (ia: number, ib: number, g: number) => {
    G[ia][ia] += g;
    G[ib][ib] += g;
    G[ia][ib] -= g;
    G[ib][ia] -= g;
  };
  for (const p of pecas) {
    const R = resistenciaDa(p);
    if (R === null) continue;
    const ia = indice.get(chavePonto(p.a))!;
    const ib = indice.get(chavePonto(p.b))!;
    estampar(ia, ib, 1 / R);
    if (p.tipo === 'bateria') {
      // Norton: a fonte empurra ε/r do polo negativo (a) para o positivo (b).
      const fonte = (p.valor ?? 9) / R;
      I[ib] += fonte;
      I[ia] -= fonte;
    }
  }
  const V = n ? resolverLinear(G, I) : [];
  const potenciais: Record<string, number> = {};
  for (const [k, i] of indice) potenciais[k] = V[i];
  const correntes: Record<string, number> = {};
  const tensoes: Record<string, number> = {};
  const potencias: Record<string, number> = {};
  let curto = false;
  for (const p of pecas) {
    const va = potenciais[chavePonto(p.a)];
    const vb = potenciais[chavePonto(p.b)];
    const u = vb - va;
    tensoes[p.id] = u;
    const R = resistenciaDa(p);
    if (R === null) {
      correntes[p.id] = 0;
      potencias[p.id] = 0;
    } else if (p.tipo === 'bateria') {
      const eps = p.valor ?? 9;
      const i = (eps - u) / R;
      correntes[p.id] = i;
      potencias[p.id] = u * i;
      if (Math.abs(i) > CORRENTE_CURTO) curto = true;
    } else {
      const i = -u / R; // de a para b: do potencial maior para o menor
      correntes[p.id] = i;
      potencias[p.id] = i * i * R;
    }
  }
  return { correntes, tensoes, potencias, potenciais, curto };
}

/** Lâmpadas que passam do limite e queimam com o resultado atual. */
export function lampadasQueimando(pecas: readonly Peca[], r: ResultadoLab): string[] {
  return pecas
    .filter((p) => p.tipo === 'lampada' && !p.queimada && r.potencias[p.id] > QUEIMA * (p.valor ?? 3))
    .map((p) => p.id);
}

/**
 * Resolve e queima as lâmpadas em excesso, uma rodada por vez: a primeira que
 * queima muda o circuito e pode salvar ou condenar as outras.
 */
export function resolverComQueima(pecas: readonly Peca[]): { pecas: Peca[]; resultado: ResultadoLab; queimaram: string[] } {
  let atual = [...pecas];
  const queimaram: string[] = [];
  for (let rodada = 0; rodada < 20; rodada++) {
    const r = resolverLab(atual);
    const alvo = lampadasQueimando(atual, r)
      .map((id) => ({ id, excesso: r.potencias[id] / (atual.find((p) => p.id === id)!.valor ?? 3) }))
      .sort((x, y) => y.excesso - x.excesso)[0];
    if (!alvo) return { pecas: atual, resultado: r, queimaram };
    queimaram.push(alvo.id);
    atual = atual.map((p) => (p.id === alvo.id ? { ...p, queimada: true } : p));
  }
  return { pecas: atual, resultado: resolverLab(atual), queimaram };
}

/** Brilho de uma lâmpada entre 0 e 1 (1 = potência nominal). */
export function brilho(p: Peca, r: ResultadoLab) {
  if (p.tipo !== 'lampada' || p.queimada) return 0;
  return Math.min(1.4, (r.potencias[p.id] ?? 0) / (p.valor ?? 3));
}

/**
 * Resistência equivalente vista pela bateria: ε/I − r (sem sentido em curto
 * ou com o circuito aberto).
 */
export function resistenciaEquivalente(bateria: Peca, r: ResultadoLab): number {
  const i = r.correntes[bateria.id];
  if (!(Math.abs(i) > 1e-6)) return Infinity;
  return (bateria.valor ?? 9) / i - R_INTERNA;
}

// ---------------------------------------------------------------------------
// Montagens prontas
// ---------------------------------------------------------------------------

let contador = 0;
export const novoId = () => `p${++contador}-${Math.random().toString(36).slice(2, 7)}`;

const peca = (tipo: TipoPeca, a: Ponto, b: Ponto, extra: Partial<Peca> = {}): Peca => ({ id: novoId(), tipo, a, b, ...extra });

/** Caminho de fios por uma lista de pontos vizinhos. */
function fios(pts: Ponto[]): Peca[] {
  const out: Peca[] = [];
  for (let i = 1; i < pts.length; i++) out.push(peca('fio', pts[i - 1], pts[i]));
  return out;
}

export type Montagem = 'serie' | 'paralelo' | 'misto' | 'vazia';

export function montagem(tipo: Montagem): Peca[] {
  const bateria = (a: Ponto, b: Ponto) => peca('bateria', a, b, { valor: 6 });
  const lamp = (a: Ponto, b: Ponto) => peca('lampada', a, b, { valor: 6 });
  switch (tipo) {
    case 'vazia':
      return [];
    case 'serie':
      // Bateria à esquerda, duas lâmpadas em série no alto, chave e amperímetro embaixo.
      return [
        bateria([1, 3], [1, 2]),
        ...fios([[1, 2], [1, 1], [2, 1]]),
        lamp([2, 1], [3, 1]),
        ...fios([[3, 1], [4, 1]]),
        lamp([4, 1], [5, 1]),
        ...fios([[5, 1], [6, 1], [6, 2], [6, 3]]),
        peca('amperimetro', [6, 3], [5, 3]),
        ...fios([[5, 3], [4, 3]]),
        peca('chave', [4, 3], [3, 3], { fechada: true }),
        ...fios([[3, 3], [2, 3], [1, 3]]),
      ];
    case 'paralelo':
      return [
        bateria([1, 3], [1, 2]),
        ...fios([[1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]),
        ...fios([[1, 3], [2, 3], [3, 3], [4, 3], [5, 3]]),
        ...fios([[3, 1], [3, 2]]),
        lamp([3, 2], [3, 3]),
        ...fios([[5, 1], [5, 2]]),
        lamp([5, 2], [5, 3]),
        peca('voltimetro', [4, 1], [4, 2]),
        ...fios([[4, 2], [4, 3]]),
      ];
    case 'misto':
      return [
        bateria([1, 3], [1, 2]),
        ...fios([[1, 2], [1, 1]]),
        lamp([1, 1], [2, 1]),
        ...fios([[2, 1], [3, 1], [4, 1], [5, 1]]),
        ...fios([[3, 1], [3, 2]]),
        lamp([3, 2], [3, 3]),
        ...fios([[5, 1], [5, 2]]),
        peca('resistor', [5, 2], [5, 3], { valor: 6 }),
        ...fios([[5, 3], [4, 3], [3, 3], [2, 3], [1, 3]]),
      ];
  }
}
