/**
 * Geometria molecular (VSEPR) com ângulos e comprimentos de ligação medidos
 * (não os ideais): a água tem 104,5°, não 109,5°. As posições saem daqui em
 * picômetros, com o átomo central na origem, e a polaridade vem da soma
 * vetorial dos dipolos (diferença de eletronegatividade) e dos pares isolados.
 */

export type V3 = [number, number, number];

export const ELETRONEGATIVIDADE: Record<string, number> = {
  H: 2.2, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98, P: 2.19, S: 2.58, Cl: 3.16, Br: 2.96, Xe: 2.6,
};

/** Cores CPK usuais nos modelos de bolas e varetas. */
export const COR_ATOMO: Record<string, string> = {
  H: '#f1f5f9', Be: '#4d7c0f', B: '#f4a582', C: '#3f3f46', N: '#3b6fe0', O: '#e5383b', F: '#9ad64b',
  P: '#f08c2e', S: '#f2d22e', Cl: '#2fbf5b', Br: '#9b2c2c', Xe: '#42b4c8',
};

/** Raio de van der Waals reduzido (pm) só para o tamanho das bolas. */
export const RAIO_ATOMO: Record<string, number> = {
  H: 25, Be: 45, B: 42, C: 40, N: 38, O: 37, F: 35, P: 50, S: 50, Cl: 50, Br: 56, Xe: 60,
};

const graus = (r: number) => (r * 180) / Math.PI;
const rad = (g: number) => (g * Math.PI) / 180;
const unit = (v: V3): V3 => {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
};
const esc = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
export const anguloEntre = (a: V3, b: V3) =>
  graus(Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))));

/** Três vetores com o mesmo ângulo α entre si, abrindo para −z (pirâmide). */
function piramide3(alfa: number): V3[] {
  const c2 = (2 * Math.cos(rad(alfa)) + 1) / 3; // cos²β, β medido a partir de −z
  const sb = Math.sqrt(1 - c2);
  const cb = Math.sqrt(c2);
  return [0, 120, 240].map((az) => [sb * Math.cos(rad(az)), sb * Math.sin(rad(az)), -cb]);
}

/** Dois vetores no plano xz, separados por α e simétricos em torno de −z. */
const dobrado = (alfa: number, eixo: V3 = [0, 0, -1]): V3[] => {
  const h = rad(alfa / 2);
  return [
    [Math.sin(h), 0, eixo[2] * Math.cos(h)],
    [-Math.sin(h), 0, eixo[2] * Math.cos(h)],
  ];
};

type Forma =
  | 'AX2' | 'AX3' | 'AX2E' | 'AX4' | 'AX3E' | 'AX2E2' | 'AX5' | 'AX4E' | 'AX3E2' | 'AX2E3' | 'AX6' | 'AX5E' | 'AX4E2';

/**
 * Direções dos ligantes e dos pares isolados. `p` são os ângulos medidos que
 * a forma usa (um ou dois, conforme a forma).
 */
function direcoes(forma: Forma, p: number[]): { lig: V3[]; pares: V3[] } {
  const tetra = piramide3(109.4712);
  switch (forma) {
    case 'AX2':
      return { lig: [[0, 0, 1], [0, 0, -1]], pares: [] };
    case 'AX3': {
      // Sem parâmetro: 120°. Com p[0]: o 1º ligante em +x e os outros dois
      // separados por p[0] (CH₂O: a dupla abre espaço e o H–C–H fecha).
      const ab = p[0] ?? 120;
      const az = 180 - ab / 2;
      return { lig: [[1, 0, 0], [Math.cos(rad(az)), Math.sin(rad(az)), 0], [Math.cos(rad(az)), -Math.sin(rad(az)), 0]], pares: [] };
    }
    case 'AX2E': {
      const [a, b] = dobrado(p[0]);
      return { lig: [a, b], pares: [[0, 0, 1]] };
    }
    case 'AX4':
      // Com p[0], os três últimos ligantes formam esse ângulo entre si (CHCl₃).
      return { lig: [[0, 0, 1], ...(p[0] ? piramide3(p[0]) : tetra)], pares: [] };
    case 'AX3E':
      return { lig: piramide3(p[0]), pares: [[0, 0, 1]] };
    case 'AX2E2': {
      const lig = dobrado(p[0]);
      const pares = dobrado(114).map(([x, , z]) => [0, x, -z] as V3);
      return { lig, pares };
    }
    case 'AX5':
      return { lig: [[0, 0, 1], [0, 0, -1], ...[0, 120, 240].map((a) => [Math.cos(rad(a)), Math.sin(rad(a)), 0] as V3)], pares: [] };
    case 'AX4E': {
      // Axiais levemente dobrados para longe do par (equatorial em +x).
      const ax = rad((180 - p[0]) / 2);
      const eq = rad(p[1] / 2);
      return {
        lig: [[-Math.sin(ax), 0, Math.cos(ax)], [-Math.sin(ax), 0, -Math.cos(ax)], [-Math.cos(eq), Math.sin(eq), 0], [-Math.cos(eq), -Math.sin(eq), 0]],
        pares: [[1, 0, 0]],
      };
    }
    case 'AX3E2': {
      // Forma de T: equatorial em −x, axiais inclinados para ele (ângulo ax–eq = p[0]).
      const t = rad(90 - p[0]);
      return { lig: [[-1, 0, 0], [-Math.sin(t), 0, Math.cos(t)], [-Math.sin(t), 0, -Math.cos(t)]], pares: [[0.5, 0.866, 0], [0.5, -0.866, 0]] };
    }
    case 'AX2E3':
      return { lig: [[0, 0, 1], [0, 0, -1]], pares: [0, 120, 240].map((a) => [Math.cos(rad(a)), Math.sin(rad(a)), 0] as V3) };
    case 'AX6':
      return { lig: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], pares: [] };
    case 'AX5E': {
      // Pirâmide de base quadrada: apical em +z; base a p[0] do apical.
      const b = rad(p[0]);
      const base = [0, 90, 180, 270].map((a) => [Math.sin(b) * Math.cos(rad(a)), Math.sin(b) * Math.sin(rad(a)), Math.cos(b)] as V3);
      return { lig: [[0, 0, 1], ...base], pares: [[0, 0, -1]] };
    }
    case 'AX4E2':
      return { lig: [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]], pares: [[0, 0, 1], [0, 0, -1]] };
  }
}

export interface Molecula {
  key: string;
  formula: string;
  nome: string;
  central: string;
  /** Elemento e comprimento de ligação (pm), na ordem das direções da forma. */
  ligantes: { el: string; pm: number; ordem: 1 | 2 | 3 }[];
  forma: Forma;
  parametros: number[];
  geometria: string;
  arranjo: string;
  /** Ângulos medidos, para a ficha (graus). */
  angulos: { rotulo: string; valor: number; ideal: number }[];
  nota: string;
}

export const MOLECULAS: Molecula[] = [
  { key: 'becl2', formula: 'BeCl₂', nome: 'Cloreto de berílio (gás)', central: 'Be', ligantes: [{ el: 'Cl', pm: 179, ordem: 1 }, { el: 'Cl', pm: 179, ordem: 1 }], forma: 'AX2', parametros: [], geometria: 'Linear', arranjo: '2 nuvens: linear', angulos: [{ rotulo: 'Cl–Be–Cl', valor: 180, ideal: 180 }], nota: 'O berílio fica com só 4 elétrons de valência: exceção ao octeto.' },
  { key: 'co2', formula: 'CO₂', nome: 'Dióxido de carbono', central: 'C', ligantes: [{ el: 'O', pm: 116, ordem: 2 }, { el: 'O', pm: 116, ordem: 2 }], forma: 'AX2', parametros: [], geometria: 'Linear', arranjo: '2 nuvens: linear', angulos: [{ rotulo: 'O=C=O', valor: 180, ideal: 180 }], nota: 'As ligações são polares, mas os dois dipolos se anulam: a molécula é apolar.' },
  { key: 'hcn', formula: 'HCN', nome: 'Ácido cianídrico', central: 'C', ligantes: [{ el: 'H', pm: 106.5, ordem: 1 }, { el: 'N', pm: 115.6, ordem: 3 }], forma: 'AX2', parametros: [], geometria: 'Linear', arranjo: '2 nuvens: linear', angulos: [{ rotulo: 'H–C≡N', valor: 180, ideal: 180 }], nota: 'Linear como o CO₂, mas com ligantes diferentes: os dipolos não se anulam.' },
  { key: 'bf3', formula: 'BF₃', nome: 'Trifluoreto de boro', central: 'B', ligantes: [{ el: 'F', pm: 131, ordem: 1 }, { el: 'F', pm: 131, ordem: 1 }, { el: 'F', pm: 131, ordem: 1 }], forma: 'AX3', parametros: [], geometria: 'Trigonal plana', arranjo: '3 nuvens: trigonal', angulos: [{ rotulo: 'F–B–F', valor: 120, ideal: 120 }], nota: 'O boro fica com 6 elétrons e aceita um par: é ácido de Lewis.' },
  { key: 'ch2o', formula: 'CH₂O', nome: 'Formaldeído (metanal)', central: 'C', ligantes: [{ el: 'O', pm: 120.5, ordem: 2 }, { el: 'H', pm: 111, ordem: 1 }, { el: 'H', pm: 111, ordem: 1 }], forma: 'AX3', parametros: [116.5], geometria: 'Trigonal plana', arranjo: '3 nuvens: trigonal', angulos: [{ rotulo: 'H–C–H', valor: 116.5, ideal: 120 }], nota: 'A dupla ligação C=O ocupa mais espaço que as simples: o H–C–H fecha para 116,5°.' },
  { key: 'so2', formula: 'SO₂', nome: 'Dióxido de enxofre', central: 'S', ligantes: [{ el: 'O', pm: 143, ordem: 2 }, { el: 'O', pm: 143, ordem: 2 }], forma: 'AX2E', parametros: [119], geometria: 'Angular', arranjo: '3 nuvens: trigonal', angulos: [{ rotulo: 'O–S–O', valor: 119, ideal: 120 }], nota: 'Um par isolado no enxofre dobra a molécula. Gás da chuva ácida.' },
  { key: 'ch4', formula: 'CH₄', nome: 'Metano', central: 'C', ligantes: Array.from({ length: 4 }, () => ({ el: 'H', pm: 108.7, ordem: 1 as const })), forma: 'AX4', parametros: [], geometria: 'Tetraédrica', arranjo: '4 nuvens: tetraédrico', angulos: [{ rotulo: 'H–C–H', valor: 109.47, ideal: 109.47 }], nota: 'O ângulo do tetraedro regular, 109,5°, é a base das cadeias carbônicas.' },
  { key: 'chcl3', formula: 'CHCl₃', nome: 'Clorofórmio', central: 'C', ligantes: [{ el: 'H', pm: 107, ordem: 1 }, { el: 'Cl', pm: 176, ordem: 1 }, { el: 'Cl', pm: 176, ordem: 1 }, { el: 'Cl', pm: 176, ordem: 1 }], forma: 'AX4', parametros: [111.3], geometria: 'Tetraédrica', arranjo: '4 nuvens: tetraédrico', angulos: [{ rotulo: 'Cl–C–Cl', valor: 111.3, ideal: 109.47 }], nota: 'Mesma geometria do metano, mas os ligantes diferentes deixam a molécula polar.' },
  { key: 'nh3', formula: 'NH₃', nome: 'Amônia', central: 'N', ligantes: Array.from({ length: 3 }, () => ({ el: 'H', pm: 101.2, ordem: 1 as const })), forma: 'AX3E', parametros: [106.7], geometria: 'Piramidal', arranjo: '4 nuvens: tetraédrico', angulos: [{ rotulo: 'H–N–H', valor: 106.7, ideal: 109.47 }], nota: 'O par isolado empurra as ligações e fecha o ângulo de 109,5° para 106,7°.' },
  { key: 'h2o', formula: 'H₂O', nome: 'Água', central: 'O', ligantes: [{ el: 'H', pm: 95.8, ordem: 1 }, { el: 'H', pm: 95.8, ordem: 1 }], forma: 'AX2E2', parametros: [104.5], geometria: 'Angular', arranjo: '4 nuvens: tetraédrico', angulos: [{ rotulo: 'H–O–H', valor: 104.5, ideal: 109.47 }], nota: 'Dois pares isolados fecham ainda mais o ângulo: 104,5°. A polaridade explica as pontes de hidrogênio.' },
  { key: 'pcl5', formula: 'PCl₅', nome: 'Pentacloreto de fósforo', central: 'P', ligantes: [{ el: 'Cl', pm: 214, ordem: 1 }, { el: 'Cl', pm: 214, ordem: 1 }, { el: 'Cl', pm: 202, ordem: 1 }, { el: 'Cl', pm: 202, ordem: 1 }, { el: 'Cl', pm: 202, ordem: 1 }], forma: 'AX5', parametros: [], geometria: 'Bipirâmide trigonal', arranjo: '5 nuvens: bipirâmide trigonal', angulos: [{ rotulo: 'Cl(eq)–P–Cl(eq)', valor: 120, ideal: 120 }, { rotulo: 'Cl(ax)–P–Cl(eq)', valor: 90, ideal: 90 }], nota: 'Octeto expandido: o fósforo fica com 10 elétrons. As ligações axiais são mais longas.' },
  { key: 'sf4', formula: 'SF₄', nome: 'Tetrafluoreto de enxofre', central: 'S', ligantes: [{ el: 'F', pm: 164.6, ordem: 1 }, { el: 'F', pm: 164.6, ordem: 1 }, { el: 'F', pm: 154.5, ordem: 1 }, { el: 'F', pm: 154.5, ordem: 1 }], forma: 'AX4E', parametros: [173.1, 101.6], geometria: 'Gangorra', arranjo: '5 nuvens: bipirâmide trigonal', angulos: [{ rotulo: 'F(ax)–S–F(ax)', valor: 173.1, ideal: 180 }, { rotulo: 'F(eq)–S–F(eq)', valor: 101.6, ideal: 120 }], nota: 'O par isolado fica numa posição equatorial, onde tem mais espaço.' },
  { key: 'clf3', formula: 'ClF₃', nome: 'Trifluoreto de cloro', central: 'Cl', ligantes: [{ el: 'F', pm: 159.8, ordem: 1 }, { el: 'F', pm: 169.8, ordem: 1 }, { el: 'F', pm: 169.8, ordem: 1 }], forma: 'AX3E2', parametros: [87.5], geometria: 'Forma de T', arranjo: '5 nuvens: bipirâmide trigonal', angulos: [{ rotulo: 'F(ax)–Cl–F(eq)', valor: 87.5, ideal: 90 }], nota: 'Dois pares isolados nas posições equatoriais deixam a molécula em T.' },
  { key: 'xef2', formula: 'XeF₂', nome: 'Difluoreto de xenônio', central: 'Xe', ligantes: [{ el: 'F', pm: 197.7, ordem: 1 }, { el: 'F', pm: 197.7, ordem: 1 }], forma: 'AX2E3', parametros: [], geometria: 'Linear', arranjo: '5 nuvens: bipirâmide trigonal', angulos: [{ rotulo: 'F–Xe–F', valor: 180, ideal: 180 }], nota: 'Um gás nobre que forma ligações. Os três pares isolados ficam no "equador".' },
  { key: 'sf6', formula: 'SF₆', nome: 'Hexafluoreto de enxofre', central: 'S', ligantes: Array.from({ length: 6 }, () => ({ el: 'F', pm: 156.4, ordem: 1 as const })), forma: 'AX6', parametros: [], geometria: 'Octaédrica', arranjo: '6 nuvens: octaédrico', angulos: [{ rotulo: 'F–S–F', valor: 90, ideal: 90 }], nota: 'Muito estável e apolar; usado como isolante em equipamentos elétricos.' },
  { key: 'brf5', formula: 'BrF₅', nome: 'Pentafluoreto de bromo', central: 'Br', ligantes: [{ el: 'F', pm: 168.9, ordem: 1 }, ...Array.from({ length: 4 }, () => ({ el: 'F', pm: 177.4, ordem: 1 as const }))], forma: 'AX5E', parametros: [84.8], geometria: 'Pirâmide de base quadrada', arranjo: '6 nuvens: octaédrico', angulos: [{ rotulo: 'F(apical)–Br–F(base)', valor: 84.8, ideal: 90 }], nota: 'O par isolado embaixo empurra a base para cima: 84,8° em vez de 90°.' },
  { key: 'xef4', formula: 'XeF₄', nome: 'Tetrafluoreto de xenônio', central: 'Xe', ligantes: Array.from({ length: 4 }, () => ({ el: 'F', pm: 195.3, ordem: 1 as const })), forma: 'AX4E2', parametros: [], geometria: 'Quadrado planar', arranjo: '6 nuvens: octaédrico', angulos: [{ rotulo: 'F–Xe–F', valor: 90, ideal: 90 }], nota: 'Os dois pares isolados ficam em lados opostos e se anulam: a molécula é apolar.' },
];

export interface Geometria {
  atomos: { el: string; pos: V3 }[]; // [0] é o central
  pares: V3[]; // direções unitárias dos pares isolados
  ligacoes: { de: number; para: number; ordem: number }[];
}

export function montarMolecula(m: Molecula): Geometria {
  const { lig, pares } = direcoes(m.forma, m.parametros);
  const atomos = [{ el: m.central, pos: [0, 0, 0] as V3 }];
  const ligacoes: Geometria['ligacoes'] = [];
  m.ligantes.forEach((l, i) => {
    atomos.push({ el: l.el, pos: esc(unit(lig[i]), l.pm) });
    ligacoes.push({ de: 0, para: i + 1, ordem: l.ordem });
  });
  return { atomos, pares: pares.map(unit), ligacoes };
}

/** Peso de um par isolado no momento de dipolo (escala de Δχ). */
const PESO_PAR = 1;

/**
 * Momento de dipolo qualitativo: cada ligação aponta para o átomo mais
 * eletronegativo com intensidade Δχ; cada par isolado aponta para fora.
 */
export function momentoDipolo(m: Molecula): V3 {
  const g = montarMolecula(m);
  const chiC = ELETRONEGATIVIDADE[m.central];
  const s: V3 = [0, 0, 0];
  g.atomos.slice(1).forEach((a) => {
    const u = unit(a.pos);
    const d = ELETRONEGATIVIDADE[a.el] - chiC;
    s[0] += d * u[0]; s[1] += d * u[1]; s[2] += d * u[2];
  });
  for (const p of g.pares) {
    s[0] += PESO_PAR * p[0]; s[1] += PESO_PAR * p[1]; s[2] += PESO_PAR * p[2];
  }
  return s;
}

export const ehPolar = (m: Molecula) => Math.hypot(...momentoDipolo(m)) > 0.05;
