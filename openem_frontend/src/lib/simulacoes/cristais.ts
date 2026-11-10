/**
 * Estruturas cristalinas: a célula unitária de cada retículo, repetida em 3D.
 * Átomos por célula, número de coordenação e fator de empacotamento saem da
 * própria geometria (contados, não tabelados); a densidade sai do parâmetro
 * de rede medido por difração de raios X, ρ = Z·M / (N_A·a³).
 */

export const N_A = 6.02214076e23;

export type V3 = [number, number, number];

export interface Especie {
  simbolo: string;
  nome: string;
  /** Massa molar (g/mol). */
  M: number;
  /** Raio usado no desenho e no empacotamento (pm): metálico, covalente ou iônico. */
  raio: number;
  cor: string;
}

export interface Estrutura {
  key: 'ccc' | 'cfc' | 'nacl' | 'diamante';
  nome: string;
  exemplo: string;
  ligacao: 'metálica' | 'iônica' | 'covalente';
  /** Parâmetro de rede (pm). */
  a: number;
  /** Átomos da base, em coordenadas fracionárias da célula, com a espécie. */
  base: { pos: V3; especie: number }[];
  especies: Especie[];
  /** Densidade medida (g/cm³), para comparar. */
  densidadeReal: number;
  nota: string;
}

const CANTOS_CFC: V3[] = [
  [0, 0, 0],
  [0.5, 0.5, 0],
  [0.5, 0, 0.5],
  [0, 0.5, 0.5],
];

export const ESTRUTURAS: Estrutura[] = [
  {
    key: 'ccc',
    nome: 'Cúbica de corpo centrado',
    exemplo: 'Ferro α',
    ligacao: 'metálica',
    a: 286.65,
    base: [
      { pos: [0, 0, 0], especie: 0 },
      { pos: [0.5, 0.5, 0.5], especie: 0 },
    ],
    especies: [{ simbolo: 'Fe', nome: 'ferro', M: 55.845, raio: 124.1, cor: '#9ca3af' }],
    densidadeReal: 7.874,
    nota: 'O ferro à temperatura ambiente, o cromo e o tungstênio. Cada átomo toca os 8 vizinhos da diagonal do cubo.',
  },
  {
    key: 'cfc',
    nome: 'Cúbica de face centrada',
    exemplo: 'Cobre',
    ligacao: 'metálica',
    a: 361.49,
    base: CANTOS_CFC.map((pos) => ({ pos, especie: 0 })),
    especies: [{ simbolo: 'Cu', nome: 'cobre', M: 63.546, raio: 127.8, cor: '#c2703d' }],
    densidadeReal: 8.96,
    nota: 'Cobre, alumínio, ouro e prata: o empacotamento mais compacto possível de esferas iguais (74%), por isso são metais dúcteis.',
  },
  {
    key: 'nacl',
    nome: 'Cloreto de sódio',
    exemplo: 'Sal de cozinha',
    ligacao: 'iônica',
    a: 564.02,
    base: [
      ...CANTOS_CFC.map((pos) => ({ pos, especie: 1 })),
      ...CANTOS_CFC.map((p) => ({ pos: [(p[0] + 0.5) % 1, p[1], p[2]] as V3, especie: 0 })),
    ],
    especies: [
      { simbolo: 'Na⁺', nome: 'sódio', M: 22.99, raio: 102, cor: '#8b5cf6' },
      { simbolo: 'Cl⁻', nome: 'cloro', M: 35.453, raio: 181, cor: '#22c55e' },
    ],
    densidadeReal: 2.165,
    nota: 'Dois retículos de face centrada encaixados, um de Na⁺ e outro de Cl⁻: cada íon fica cercado por 6 de carga oposta. Não existe "molécula" de NaCl, só o retículo.',
  },
  {
    key: 'diamante',
    nome: 'Diamante',
    exemplo: 'Carbono',
    ligacao: 'covalente',
    a: 356.71,
    base: [
      ...CANTOS_CFC.map((pos) => ({ pos, especie: 0 })),
      ...CANTOS_CFC.map((p) => ({ pos: [p[0] + 0.25, p[1] + 0.25, p[2] + 0.25] as V3, especie: 0 })),
    ],
    especies: [{ simbolo: 'C', nome: 'carbono', M: 12.011, raio: 77.2, cor: '#64748b' }],
    densidadeReal: 3.515,
    nota: 'Cada carbono faz 4 ligações covalentes em tetraedro (109,5°): uma rede que se estende pelo cristal inteiro, a mais dura da natureza.',
  },
];

/** Átomos de `n`×`n`×`n` células, incluindo os das faces e cantos da borda. */
export function gerarReticulo(e: Estrutura, n: number): { pos: V3; especie: number }[] {
  const out: { pos: V3; especie: number }[] = [];
  const visto = new Set<string>();
  const eps = 1e-6;
  for (let i = -1; i <= n; i++) {
    for (let j = -1; j <= n; j++) {
      for (let k = -1; k <= n; k++) {
        for (const b of e.base) {
          const p: V3 = [b.pos[0] + i, b.pos[1] + j, b.pos[2] + k];
          if (p.some((c) => c < -eps || c > n + eps)) continue;
          const chave = p.map((c) => c.toFixed(4)).join(',');
          if (visto.has(chave)) continue;
          visto.add(chave);
          out.push({ pos: p, especie: b.especie });
        }
      }
    }
  }
  return out;
}

/**
 * Átomos por célula contados com o peso de cada posição: canto vale 1/8,
 * aresta 1/4, face 1/2 e interior 1 (é a fração dentro da célula).
 */
export function atomosPorCelula(e: Estrutura): number {
  let z = 0;
  for (const { pos } of gerarReticulo(e, 1)) {
    const naBorda = pos.filter((c) => Math.abs(c) < 1e-6 || Math.abs(c - 1) < 1e-6).length;
    z += 1 / 2 ** naBorda;
  }
  return z;
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Vizinhos mais próximos de um átomo no meio de um bloco grande, e a distância até eles (em frações de a). */
export function coordenacao(e: Estrutura): { numero: number; distancia: number } {
  const bloco = gerarReticulo(e, 3);
  const centro = bloco.reduce((m, at) => (dist(at.pos, [1.5, 1.5, 1.5]) < dist(m.pos, [1.5, 1.5, 1.5]) ? at : m));
  const ds = bloco.filter((at) => at !== centro).map((at) => dist(at.pos, centro.pos));
  const min = Math.min(...ds);
  return { numero: ds.filter((d) => d < min + 1e-6).length, distancia: min };
}

/** Fração do volume da célula ocupada pelas esferas dos átomos. */
export function empacotamento(e: Estrutura): number {
  const z = atomosPorCelula(e);
  const porEspecie = e.especies.length;
  const volume = e.especies.reduce((s, esp) => s + (4 / 3) * Math.PI * esp.raio ** 3, 0) / porEspecie;
  return (z * volume) / e.a ** 3;
}

/** Densidade calculada (g/cm³): ρ = Z·M/(N_A·a³), com M a massa média por átomo. */
export function densidade(e: Estrutura): number {
  const z = atomosPorCelula(e);
  const mMedia = e.especies.reduce((s, esp) => s + esp.M, 0) / e.especies.length;
  const aCm = e.a * 1e-10;
  return (z * mMedia) / (N_A * aCm ** 3);
}

/** Pares de vizinhos mais próximos (ligações) dentro do bloco gerado. */
export function ligacoesVizinhas(atomos: { pos: V3 }[], distancia: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < atomos.length; i++) {
    for (let j = i + 1; j < atomos.length; j++) {
      if (Math.abs(dist(atomos[i].pos, atomos[j].pos) - distancia) < 1e-4) out.push([i, j]);
    }
  }
  return out;
}
