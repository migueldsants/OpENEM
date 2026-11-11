/**
 * DNA: pareamento de bases (A–T, C–G), transcrição para o RNA mensageiro e
 * tradução pelo código genético padrão, e a geometria da dupla hélice B
 * (10,5 pares por volta, 0,34 nm entre pares, 2 nm de diâmetro).
 */

export type Base = 'A' | 'T' | 'C' | 'G';
export const BASES: Base[] = ['A', 'T', 'C', 'G'];

const PAR: Record<Base, Base> = { A: 'T', T: 'A', C: 'G', G: 'C' };

export const complementar = (seq: string) => [...seq].map((b) => PAR[b as Base]).join('');

/** Só A, T, C e G, em maiúsculas (o resto é descartado). */
export const limparSequencia = (s: string) => s.toUpperCase().replace(/[^ATCG]/g, '');

/** RNA mensageiro: a cópia da fita codificadora, com U no lugar de T (a RNA polimerase lê a fita molde). */
export const transcrever = (codificadora: string) => codificadora.replace(/T/g, 'U');

/** Código genético padrão, códon de RNA → aminoácido (abreviação de 3 letras; "Pare" nos de parada). */
export const CODIGO: Record<string, string> = (() => {
  const b = 'UCAG';
  // Ordem clássica da tabela: 1ª base na linha, 2ª na coluna, 3ª dentro da célula.
  const aa = [
    'Phe Phe Leu Leu Ser Ser Ser Ser Tyr Tyr Pare Pare Cys Cys Pare Trp',
    'Leu Leu Leu Leu Pro Pro Pro Pro His His Gln Gln Arg Arg Arg Arg',
    'Ile Ile Ile Met Thr Thr Thr Thr Asn Asn Lys Lys Ser Ser Arg Arg',
    'Val Val Val Val Ala Ala Ala Ala Asp Asp Glu Glu Gly Gly Gly Gly',
  ];
  const t: Record<string, string> = {};
  for (let i = 0; i < 4; i++) {
    const linha = aa[i].split(' ');
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) t[b[i] + b[j] + b[k]] = linha[j * 4 + k];
  }
  return t;
})();

export const NOME_AMINOACIDO: Record<string, string> = {
  Ala: 'alanina', Arg: 'arginina', Asn: 'asparagina', Asp: 'ácido aspártico', Cys: 'cisteína', Gln: 'glutamina',
  Glu: 'ácido glutâmico', Gly: 'glicina', His: 'histidina', Ile: 'isoleucina', Leu: 'leucina', Lys: 'lisina',
  Met: 'metionina', Phe: 'fenilalanina', Pro: 'prolina', Ser: 'serina', Thr: 'treonina', Trp: 'triptofano',
  Tyr: 'tirosina', Val: 'valina',
};

export interface Traducao {
  /** Posição (no RNA) do AUG de início, ou −1 sem início. */
  inicio: number;
  codons: string[];
  aminoacidos: string[];
  /** Terminou num códon de parada (e não no fim da sequência). */
  parou: boolean;
}

/** Traduz a partir do primeiro AUG até o códon de parada. */
export function traduzir(rna: string): Traducao {
  const inicio = rna.indexOf('AUG');
  if (inicio < 0) return { inicio, codons: [], aminoacidos: [], parou: false };
  const codons: string[] = [];
  const aminoacidos: string[] = [];
  for (let i = inicio; i + 3 <= rna.length; i += 3) {
    const c = rna.slice(i, i + 3);
    codons.push(c);
    const aa = CODIGO[c];
    if (aa === 'Pare') return { inicio, codons, aminoacidos, parou: true };
    aminoacidos.push(aa);
  }
  return { inicio, codons, aminoacidos, parou: false };
}

/** Fração de C + G. */
export const conteudoGC = (seq: string) => (seq.length ? [...seq].filter((b) => b === 'C' || b === 'G').length / seq.length : 0);

/** Contagem de cada base nas duas fitas juntas (regra de Chargaff: A = T e C = G). */
export function contagemDupla(seq: string): Record<Base, number> {
  const c: Record<Base, number> = { A: 0, T: 0, C: 0, G: 0 };
  for (const b of seq + complementar(seq)) c[b as Base]++;
  return c;
}

export type EfeitoMutacao = 'silenciosa' | 'troca de aminoácido' | 'sem sentido' | 'fora da proteína';

/** Efeito de trocar a base `i` da fita codificadora por `nova`. */
export function efeitoMutacao(codificadora: string, i: number, nova: Base): EfeitoMutacao {
  const antes = traduzir(transcrever(codificadora));
  const mutada = codificadora.slice(0, i) + nova + codificadora.slice(i + 1);
  const depois = traduzir(transcrever(mutada));
  if (antes.inicio < 0 || i < antes.inicio || i >= antes.inicio + antes.codons.length * 3) return 'fora da proteína';
  if (depois.inicio !== antes.inicio) return 'troca de aminoácido';
  if (depois.aminoacidos.join() === antes.aminoacidos.join() && depois.parou === antes.parou) return 'silenciosa';
  if (depois.aminoacidos.length < antes.aminoacidos.length && depois.parou) return 'sem sentido';
  return 'troca de aminoácido';
}

// Geometria da forma B.
export const PARES_POR_VOLTA = 10.5;
export const SUBIDA_NM = 0.34;
export const RAIO_NM = 1;
/** Ângulo entre as duas fitas visto de cima: o lado menor é o sulco menor. */
export const ABERTURA_SULCO = (150 * Math.PI) / 180;

/** Posição das duas fitas (esqueleto açúcar-fosfato) no par `i`, em nm. */
export function posicaoPar(i: number): { fita1: [number, number, number]; fita2: [number, number, number]; y: number } {
  const ang = (2 * Math.PI * i) / PARES_POR_VOLTA;
  const y = i * SUBIDA_NM;
  return {
    y,
    fita1: [RAIO_NM * Math.cos(ang), y, RAIO_NM * Math.sin(ang)],
    fita2: [RAIO_NM * Math.cos(ang + ABERTURA_SULCO), y, RAIO_NM * Math.sin(ang + ABERTURA_SULCO)],
  };
}
