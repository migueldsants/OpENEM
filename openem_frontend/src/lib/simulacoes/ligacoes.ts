/**
 * Ligações químicas entre dois elementos do catálogo da tabela periódica:
 * o tipo (iônica, covalente polar ou apolar, metálica), a fórmula e a
 * estrutura de Lewis para desenhar. Regras de escola, ditas no texto da tela:
 *
 * - metal com ametal (ou hidrogênio): iônica, com as cargas dos íons comuns
 *   do catálogo e a fórmula pelo balanço das cargas (Al³⁺ e O²⁻ → Al₂O₃);
 * - ametal com ametal: covalente, pela regra do octeto (cada átomo faz
 *   8 − elétrons de valência ligações; o H faz 1), apolar se a diferença de
 *   eletronegatividade (Pauling, do catálogo) for menor que 0,4;
 * - metal com metal: metálica;
 * - gás nobre: não se liga nas condições do dia a dia.
 */
import type { Elemento } from '../elementos';

export type Natureza = 'metal' | 'ametal' | 'semimetal' | 'nobre' | 'hidrogenio';

export function natureza(e: Elemento): Natureza {
  if (e.z === 1) return 'hidrogenio';
  switch (e.categoria) {
    case 'gas-nobre':
      return 'nobre';
    case 'nao-metal':
    case 'halogenio':
      return 'ametal';
    case 'semimetal':
      return 'semimetal';
    default:
      return 'metal';
  }
}

/** Elétrons de valência dos elementos representativos (grupos 1, 2 e 13 a 18). */
export function eletronsValencia(e: Elemento): number | null {
  if (e.z === 1) return 1;
  if (e.z === 2) return 2;
  if (e.grupo === 1 || e.grupo === 2) return e.grupo;
  if (e.grupo >= 13 && e.grupo <= 18) return e.grupo - 10;
  return null;
}

/** Ligações que o átomo faz para completar o octeto (dueto no H); boro e alumínio fazem 3. */
export function ligacoesOcteto(e: Elemento): number | null {
  const v = eletronsValencia(e);
  if (v === null) return null;
  if (e.z === 1) return 1;
  if (v <= 3) return v;
  return 8 - v;
}

export const eletronegatividade = (e: Elemento) => e.eletronegatividade?.valor ?? null;

/** Caráter iônico estimado pela fórmula de Pauling: 1 − e^(−Δχ²/4). */
export const carateriIonico = (dEN: number) => 1 - Math.exp(-(dEN * dEN) / 4);

export type TipoLigacao = 'ionica' | 'covalente-apolar' | 'covalente-polar' | 'metalica' | 'nenhuma';

export interface AtomoLewis {
  el: string;
  x: number;
  y: number;
  /** Ângulos (graus, 0 = direita, anti-horário) dos pares isolados. */
  pares: number[];
  /** Elétrons isolados (radical), quando sobra um ímpar. */
  impares?: number[];
  carga?: number;
}

export interface LigacaoLewis {
  a: number;
  b: number;
  ordem: 1 | 2 | 3;
  /** Uma das ligações é dativa (os dois elétrons vieram de `a`). */
  dativa?: boolean;
}

export interface Estrutura {
  atomos: AtomoLewis[];
  ligacoes: LigacaoLewis[];
}

export interface Resultado {
  tipo: TipoLigacao;
  formula: string;
  /** Diferença de eletronegatividade (Pauling), quando os dois têm valor. */
  dEN: number | null;
  explicacao: string;
  /** Iônica: os íons e quantos de cada. */
  ions?: { cation: { simbolo: string; carga: number; n: number }; anion: { simbolo: string; carga: number; n: number }; eletronsPorCation: number };
  /** Covalente: a molécula. */
  estrutura?: Estrutura;
  geometria?: string;
  molecula?: 'polar' | 'apolar';
  /** Covalente que forma rede (diamante, quartzo) em vez de molécula. */
  rede?: boolean;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => SUB[Number(d)]));
const mdc = (a: number, b: number): number => (b ? mdc(b, a % b) : a);

/** Fórmula iônica pelo balanço das cargas: Al³⁺ + O²⁻ → Al₂O₃. */
export function formulaIonica(cation: string, cargaC: number, anion: string, cargaA: number) {
  const g = mdc(cargaC, Math.abs(cargaA));
  const nC = Math.abs(cargaA) / g;
  const nA = cargaC / g;
  return { formula: `${cation}${sub(nC)}${anion}${sub(nA)}`, nC, nA };
}

/** Disposição de Lewis em volta do átomo central: os ligantes nas primeiras posições, os pares nas que sobram. */
const POSICOES: Record<number, number[]> = { 1: [0], 2: [180, 0], 3: [90, 210, 330], 4: [180, 0, 90, 270] };

function moleculaCentral(c: Elemento, t: Elemento, n: number, ordem: 1 | 2 | 3, paresCentral: number): Estrutura {
  const dominios = n + paresCentral;
  const pos = POSICOES[Math.min(4, Math.max(1, dominios))] ?? POSICOES[4];
  const L = 1.6;
  const atomos: AtomoLewis[] = [{ el: c.simbolo, x: 0, y: 0, pares: pos.slice(n, n + paresCentral) }];
  const ligacoes: LigacaoLewis[] = [];
  const vT = eletronsValencia(t) ?? 0;
  const paresT = t.z === 1 ? 0 : Math.max(0, (vT - ordem) / 2);
  for (let i = 0; i < n; i++) {
    const ang = pos[i];
    const r = (ang * Math.PI) / 180;
    // Pares do terminal: para fora da ligação, espalhados.
    const fora = [ang, ang + 90, ang - 90, ang + 180].slice(0, paresT);
    atomos.push({ el: t.simbolo, x: Math.cos(r) * L, y: Math.sin(r) * L, pares: fora });
    ligacoes.push({ a: 0, b: i + 1, ordem });
  }
  return { atomos, ligacoes };
}

/** Elementos cuja molécula de verdade não é a de dois átomos que o octeto sugere. */
const FORMA_REAL: Record<number, string> = {
  15: ' Na prática, o fósforo prefere ligações simples e forma P₄ (fósforo branco, um tetraedro) e cadeias (fósforo vermelho).',
  16: ' Na prática, o enxofre prefere ligações simples e forma anéis de oito átomos, o S₈.',
  34: ' Na prática, o selênio forma cadeias e anéis com ligações simples.',
};

const GEOMETRIA: Record<string, string> = {
  '1-0': 'linear',
  '1-1': 'linear',
  '1-2': 'linear',
  '1-3': 'linear',
  '2-0': 'linear',
  '2-1': 'angular',
  '2-2': 'angular',
  '2-3': 'linear',
  '3-0': 'trigonal plana',
  '3-1': 'piramidal',
  '3-2': 'em T',
  '4-0': 'tetraédrica',
  '4-1': 'gangorra',
  '4-2': 'quadrado plana',
};

/** Pares de ametais que não fecham uma molécula simples pelo octeto: o que acontece de verdade. */
const FORA_DO_OCTETO: Record<string, string> = {
  'N-O': 'Nitrogênio e oxigênio formam NO e NO₂, moléculas com número ímpar de elétrons que não fecham o octeto (radicais livres), e o N₂O, com ligação dativa.',
  'O-S': 'Enxofre e oxigênio formam SO₂ e SO₃: o enxofre faz uma dupla e uma ligação dativa (veja o exemplo do SO₂).',
  'O-P': 'Fósforo e oxigênio formam P₄O₆ e P₄O₁₀, moléculas em gaiola com várias ligações; não há uma molécula simples PO.',
  'C-N': 'Carbono e nitrogênio sozinhos formam o cianogênio (NC–CN); com hidrogênio, o HCN (H–C≡N).',
  'O-Se': 'Selênio e oxigênio formam SeO₂, parecido com o SO₂.',
  'Cl-O': 'Cloro e oxigênio formam Cl₂O (o oxigênio no centro, como no OF₂) e óxidos com mais oxigênio, que fogem do octeto.',
};

/** Cargas positivas comuns de um metal (para escolher entre Fe²⁺ e Fe³⁺, Cu⁺ e Cu²⁺). */
export function cargasCation(m: Elemento): number[] {
  const c = m.oxidacao.comuns.filter((x) => x > 0);
  return c.length ? c : m.oxidacao.todos.filter((x) => x > 0).slice(0, 1);
}

export function ligar(a: Elemento, b: Elemento, opcoes: { cargaCation?: number } = {}): Resultado {
  const na = natureza(a);
  const nb = natureza(b);
  const ea = eletronegatividade(a);
  const eb = eletronegatividade(b);
  const dEN = ea !== null && eb !== null ? Math.abs(ea - eb) : null;

  if (na === 'nobre' || nb === 'nobre') {
    return {
      tipo: 'nenhuma',
      formula: '–',
      dEN,
      explicacao: 'Gases nobres já têm a camada de valência completa e quase não se ligam. Só em condições especiais o xenônio forma compostos com flúor e oxigênio (XeF₂, XeO₃).',
    };
  }

  if (na === 'metal' && nb === 'metal') {
    const formula = a.z === b.z ? a.simbolo : `${a.simbolo} + ${b.simbolo}`;
    const ligas: Record<string, string> = { 'Cu-Zn': 'latão', 'Cu-Sn': 'bronze', 'Au-Cu': 'ouro 18 quilates (com cobre)', 'Ag-Au': 'ouro branco antigo', 'Pb-Sn': 'solda', 'Ni-Ti': 'nitinol (memória de forma)' };
    const chave = [a.simbolo, b.simbolo].sort().join('-');
    return {
      tipo: 'metalica',
      formula,
      dEN,
      explicacao:
        a.z === b.z
          ? `No metal, os átomos de ${a.nome.toLowerCase()} viram cátions arrumados num retículo e os elétrons de valência ficam livres, num "mar de elétrons" que conduz corrente e calor.`
          : `Dois metais misturados formam uma liga metálica${ligas[chave] ? ` (${ligas[chave]})` : ''}: os mesmos cátions num mar de elétrons, agora de dois tamanhos.`,
    };
  }

  // Metal com ametal, semimetal ou hidrogênio: iônica.
  if (na === 'metal' || nb === 'metal') {
    const [m, x] = na === 'metal' ? [a, b] : [b, a];
    const cargaM = opcoes.cargaCation ?? m.oxidacao.comuns.find((c) => c > 0) ?? m.oxidacao.todos.find((c) => c > 0) ?? eletronsValencia(m) ?? 1;
    const cargaX = x.oxidacao.comuns.find((c) => c < 0) ?? x.oxidacao.todos.find((c) => c < 0) ?? -(ligacoesOcteto(x) ?? 1);
    const { formula, nC, nA } = formulaIonica(m.simbolo, cargaM, x.simbolo, cargaX);
    return {
      tipo: 'ionica',
      formula,
      dEN,
      ions: { cation: { simbolo: m.simbolo, carga: cargaM, n: nC }, anion: { simbolo: x.simbolo, carga: cargaX, n: nA }, eletronsPorCation: cargaM },
      explicacao: `O ${m.nome.toLowerCase()} perde ${cargaM} elétron${cargaM > 1 ? 's' : ''} e vira cátion; o ${x.nome.toLowerCase()} ganha ${-cargaX} e vira ânion. A atração entre cargas opostas forma um retículo cristalino, e a fórmula ${formula} é a menor proporção que deixa o total neutro.`,
    };
  }

  // Ametais (com H e semimetais): covalente.
  const va = ligacoesOcteto(a);
  const vb = ligacoesOcteto(b);
  if (va === null || vb === null) {
    return { tipo: 'covalente-polar', formula: '?', dEN, explicacao: 'Sem regra simples de octeto para esse par.' };
  }
  const tipo: TipoLigacao = (dEN ?? 0) < 0.4 ? 'covalente-apolar' : 'covalente-polar';

  if (a.z === b.z) {
    if (va >= 4 || na === 'semimetal') {
      return {
        tipo,
        formula: `${a.simbolo} (rede)`,
        dEN,
        rede: true,
        explicacao: `Cada átomo de ${a.nome.toLowerCase()} faz ${va} ligações e não cabe numa molécula de dois: forma uma rede covalente gigante (como o diamante e o grafite no carbono).`,
      };
    }
    const ordem = va as 1 | 2 | 3;
    const pares = a.z === 1 ? 0 : ((eletronsValencia(a) ?? 0) - ordem) / 2;
    const ang = (i: number) => [180, 90, 270][i];
    return {
      tipo: 'covalente-apolar',
      formula: `${a.simbolo}₂`,
      dEN: 0,
      geometria: 'linear',
      molecula: 'apolar',
      estrutura: {
        atomos: [
          { el: a.simbolo, x: -0.8, y: 0, pares: Array.from({ length: pares }, (_, i) => ang(i)) },
          { el: a.simbolo, x: 0.8, y: 0, pares: Array.from({ length: pares }, (_, i) => (ang(i) + 180) % 360) },
        ],
        ligacoes: [{ a: 0, b: 1, ordem }],
      },
      explicacao: `Dois átomos iguais compartilham ${ordem} par${ordem > 1 ? 'es' : ''} de elétrons (ligação ${['simples', 'dupla', 'tripla'][ordem - 1]}) e cada um fica com o octeto${a.z === 1 ? ' (o dueto, no hidrogênio)' : ''}. Mesma eletronegatividade: ligação apolar.${FORMA_REAL[a.z] ?? ''}`,
    };
  }

  // O central é o que faz mais ligações (no empate, o menos eletronegativo); o H nunca é central.
  let [c, t] = [a, b];
  let [vc, vt] = [va, vb];
  if (c.z === 1 || (t.z !== 1 && (vt > vc || (vt === vc && (eletronegatividade(t) ?? 0) < (eletronegatividade(c) ?? 0))))) {
    [c, t] = [t, c];
    [vc, vt] = [vt, vc];
  }
  const n = vc / vt;
  const chave = [a.simbolo, b.simbolo].sort().join('-');
  if (!Number.isInteger(n) || vt > 3 || (vc === vt && vc > 1)) {
    return {
      tipo,
      formula: '–',
      dEN,
      explicacao: FORA_DO_OCTETO[chave] ?? `${c.nome} e ${t.nome.toLowerCase()} não fecham o octeto numa molécula simples só com os dois.`,
    };
  }
  const ordem = vt as 1 | 2 | 3;
  const paresC = Math.max(0, ((eletronsValencia(c) ?? 0) - vc) / 2);
  const geometria = GEOMETRIA[`${n}-${paresC}`] ?? '–';
  const polarLig = (dEN ?? 0) >= 0.4;
  const simetrica = paresC === 0 || (n === 2 && paresC === 3) || (n === 4 && paresC === 2);
  const molecula = n === 1 ? (polarLig ? 'polar' : 'apolar') : polarLig && !simetrica ? 'polar' : 'apolar';
  const formula = c.z === 1 ? `${c.simbolo}${t.simbolo}` : t.z === 1 && ['O', 'S', 'Se', 'Te', 'F', 'Cl', 'Br', 'I'].includes(c.simbolo) ? `H${sub(n)}${c.simbolo}` : `${c.simbolo}${t.simbolo}${sub(n)}`;
  const rede = chave === 'O-Si';
  return {
    tipo,
    formula: rede ? 'SiO₂ (rede)' : formula,
    dEN,
    rede,
    geometria,
    molecula,
    estrutura: moleculaCentral(c, t, n, ordem, paresC),
    explicacao: `${c.nome} precisa de ${vc} ligaç${vc > 1 ? 'ões' : 'ão'} para o octeto e ${t.nome.toLowerCase()}, de ${vt}: ${n} ${t.simbolo} em volta de um ${c.simbolo}, com ligaç${n > 1 ? 'ões' : 'ão'} ${ordem === 1 ? 'simples' : `${ordem === 2 ? 'dupla' : 'tripla'}${n > 1 ? 's' : ''}`}. ${polarLig ? `A diferença de eletronegatividade (${dEN!.toFixed(2).replace('.', ',')}) faz cada ligação polar` : 'Eletronegatividades quase iguais: ligações apolares'}${n > 1 ? `; com a geometria ${geometria}, a molécula é ${molecula}` : ''}.${rede ? ' Na verdade, o SiO₂ não forma moléculas soltas: é uma rede covalente (o quartzo da areia).' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Exemplos de ligação dativa (coordenada)
// ---------------------------------------------------------------------------

export interface ExemploDativa {
  key: string;
  formula: string;
  nome: string;
  estrutura: Estrutura;
  texto: string;
}

export const DATIVAS: ExemploDativa[] = [
  {
    key: 'nh4',
    formula: 'NH₄⁺',
    nome: 'Amônio',
    estrutura: {
      atomos: [
        { el: 'N', x: 0, y: 0, pares: [], carga: 1 },
        { el: 'H', x: -1.6, y: 0, pares: [] },
        { el: 'H', x: 1.6, y: 0, pares: [] },
        { el: 'H', x: 0, y: 1.6, pares: [] },
        { el: 'H', x: 0, y: -1.6, pares: [] },
      ],
      ligacoes: [
        { a: 0, b: 1, ordem: 1 },
        { a: 0, b: 2, ordem: 1 },
        { a: 0, b: 3, ordem: 1 },
        { a: 0, b: 4, ordem: 1, dativa: true },
      ],
    },
    texto: 'A amônia (NH₃) tem um par de elétrons sobrando no nitrogênio. O íon H⁺ não tem elétron nenhum: o nitrogênio entra com o par inteiro e forma a quarta ligação, a dativa. Depois de formada, ela é igual às outras três.',
  },
  {
    key: 'h3o',
    formula: 'H₃O⁺',
    nome: 'Hidrônio',
    estrutura: {
      atomos: [
        { el: 'O', x: 0, y: 0, pares: [90], carga: 1 },
        { el: 'H', x: -1.6, y: 0, pares: [] },
        { el: 'H', x: 1.6, y: 0, pares: [] },
        { el: 'H', x: 0, y: -1.6, pares: [] },
      ],
      ligacoes: [
        { a: 0, b: 1, ordem: 1 },
        { a: 0, b: 2, ordem: 1 },
        { a: 0, b: 3, ordem: 1, dativa: true },
      ],
    },
    texto: 'Na água, um dos dois pares isolados do oxigênio recebe um H⁺: é assim que o ácido "existe" na solução. A ligação dativa explica por que a água aceita prótons.',
  },
  {
    key: 'co',
    formula: 'CO',
    nome: 'Monóxido de carbono',
    estrutura: {
      atomos: [
        { el: 'C', x: -0.8, y: 0, pares: [180] },
        { el: 'O', x: 0.8, y: 0, pares: [0] },
      ],
      ligacoes: [{ a: 1, b: 0, ordem: 3, dativa: true }],
    },
    texto: 'O carbono faz duas ligações comuns com o oxigênio, e o oxigênio ainda doa um par para o carbono, que ficaria sem o octeto: uma tripla com uma dativa. É por isso que o CO se prende tão bem ao ferro da hemoglobina.',
  },
  {
    key: 'so2',
    formula: 'SO₂',
    nome: 'Dióxido de enxofre',
    estrutura: {
      atomos: [
        { el: 'S', x: 0, y: 0, pares: [90] },
        { el: 'O', x: -1.6, y: -0.6, pares: [180, 90] },
        { el: 'O', x: 1.6, y: -0.6, pares: [0, 90, 270] },
      ],
      ligacoes: [
        { a: 0, b: 1, ordem: 2 },
        { a: 0, b: 2, ordem: 1, dativa: true },
      ],
    },
    texto: 'O enxofre faz uma dupla com um oxigênio e ainda tem pares sobrando: doa um deles ao segundo oxigênio. O SO₂ sai da queima de combustíveis com enxofre e, no ar, vira ácido sulfúrico (a chuva ácida).',
  },
  {
    key: 'o3',
    formula: 'O₃',
    nome: 'Ozônio',
    estrutura: {
      atomos: [
        { el: 'O', x: 0, y: 0.3, pares: [90] },
        { el: 'O', x: -1.6, y: -0.5, pares: [180, 90] },
        { el: 'O', x: 1.6, y: -0.5, pares: [0, 90, 270] },
      ],
      ligacoes: [
        { a: 0, b: 1, ordem: 2 },
        { a: 0, b: 2, ordem: 1, dativa: true },
      ],
    },
    texto: 'O oxigênio do meio faz uma dupla com um vizinho e doa um par ao outro. Na verdade os elétrons se espalham pelas duas ligações (ressonância), e as duas têm o mesmo tamanho. O ozônio da estratosfera filtra o ultravioleta.',
  },
];
