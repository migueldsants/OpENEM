/**
 * Química: titulação ácido-base (pH pelo balanço de cargas, sem atalho de
 * Henderson), equilíbrio N₂O₄ ⇌ 2 NO₂ (cinética + van 't Hoff), pilhas
 * (Nernst e descarga), decaimento radioativo e espectro do hidrogênio (Bohr).
 */
import { avancar, bissecao, type Estado } from './numerico';

// ---------------------------------------------------------------------------
// Titulação
// ---------------------------------------------------------------------------

export const KW = 1e-14; // 25 °C

export interface Analito {
  key: string;
  nome: string;
  tipo: 'acido' | 'base';
  /** Ka do ácido (ou do ácido conjugado, para base fraca); forte = 1e10. */
  Ka: number;
}

export const ANALITOS: Analito[] = [
  { key: 'hcl', nome: 'Ácido clorídrico (HCl), forte', tipo: 'acido', Ka: 1e10 },
  { key: 'acetico', nome: 'Ácido acético (vinagre), fraco', tipo: 'acido', Ka: 1.75e-5 },
  { key: 'formico', nome: 'Ácido fórmico, fraco', tipo: 'acido', Ka: 1.77e-4 },
  { key: 'naoh', nome: 'Hidróxido de sódio (NaOH), forte', tipo: 'base', Ka: 1e-30 },
  { key: 'amonia', nome: 'Amônia (NH₃), fraca', tipo: 'base', Ka: 5.6e-10 },
];

export interface Titulacao {
  analito: Analito;
  Ca: number; // mol/L do analito
  Va: number; // mL
  Ct: number; // mol/L do titulante (NaOH para ácido; HCl para base)
}

/**
 * pH depois de adicionar `Vt` mL de titulante. Resolve o balanço de cargas
 * para [H⁺] por bissecção em log, que vale em todo o intervalo (inclusive
 * na equivalência, onde as aproximações escolares falham).
 */
export function pH(t: Titulacao, Vt: number): number {
  const V = t.Va + Vt;
  const C = (t.Ca * t.Va) / V; // analito total diluído
  const Ctit = (t.Ct * Vt) / V; // íon do titulante (Na⁺ ou Cl⁻)
  const { Ka, tipo } = t.analito;
  const balanco = (logH: number) => {
    const h = 10 ** logH;
    const oh = KW / h;
    if (tipo === 'acido') {
      const aMenos = (C * Ka) / (Ka + h);
      return h + Ctit - oh - aMenos;
    }
    const bhMais = (C * h) / (h + Ka);
    return h + bhMais - oh - Ctit;
  };
  return -bissecao(balanco, -15, 1, 1e-12);
}

export const volumeEquivalencia = (t: Titulacao) => (t.Ca * t.Va) / t.Ct;

export function curvaTitulacao(t: Titulacao, vMax: number, passos = 400) {
  const pts: { v: number; pH: number }[] = [];
  for (let i = 0; i <= passos; i++) {
    const v = (vMax * i) / passos;
    pts.push({ v, pH: pH(t, v) });
  }
  return pts;
}

export interface Indicador {
  key: string;
  nome: string;
  pKa: number;
  faixa: [number, number];
  /** Cor da forma ácida e da básica (sRGB); "transparente" tem alfa 0. */
  acida: [number, number, number, number];
  basica: [number, number, number, number];
}

export const INDICADORES: Indicador[] = [
  { key: 'fenolftaleina', nome: 'Fenolftaleína', pKa: 9.3, faixa: [8.2, 10], acida: [255, 255, 255, 0], basica: [219, 39, 119, 0.85] },
  { key: 'bromotimol', nome: 'Azul de bromotimol', pKa: 7.1, faixa: [6, 7.6], acida: [234, 200, 30, 0.75], basica: [37, 99, 235, 0.75] },
  { key: 'metilorange', nome: 'Alaranjado de metila', pKa: 3.47, faixa: [3.1, 4.4], acida: [220, 38, 38, 0.75], basica: [245, 180, 30, 0.75] },
  { key: 'repolho', nome: 'Extrato de repolho roxo', pKa: 7, faixa: [2, 12], acida: [190, 40, 90, 0.7], basica: [40, 150, 90, 0.7] },
];

/** Fração da forma básica do indicador: 1/(1 + 10^(pKa − pH)). */
export const fracaoBasica = (ind: Indicador, ph: number) => 1 / (1 + 10 ** (ind.pKa - ph));

export function corIndicador(ind: Indicador, ph: number) {
  const f = ind.key === 'repolho' ? Math.min(1, Math.max(0, (ph - 2) / 10)) : fracaoBasica(ind, ph);
  const c = ind.acida.map((a, i) => a + (ind.basica[i] - a) * f);
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(3)})`;
}

// ---------------------------------------------------------------------------
// Equilíbrio N₂O₄(g) ⇌ 2 NO₂(g)
// ---------------------------------------------------------------------------

export const R_GAS = 8.314462618; // J/(mol·K)
export const R_LATM = 0.0831446; // L·bar/(mol·K)
/** ΔH° e ΔS° padrão da reação (NIST): endotérmica no sentido direto. */
export const DH_N2O4 = 57.2e3; // J/mol
export const DS_N2O4 = 175.8; // J/(mol·K)

/** Kp (bar) por ΔG° = ΔH° − TΔS° = −RT ln K. */
export const KpN2O4 = (T: number) => Math.exp(-(DH_N2O4 - T * DS_N2O4) / (R_GAS * T));
/** Kc (mol/L) = Kp/(RT)^Δn, Δn = 1. */
export const KcN2O4 = (T: number) => KpN2O4(T) / (R_LATM * T);

/**
 * Constantes de velocidade (1/s e L/(mol·s)) pela lei de Arrhenius. Na vida
 * real a reação leva microssegundos; o fator pré-exponencial foi escolhido
 * para o equilíbrio se formar em segundos, na tela. O que importa (e é
 * físico) é a razão k1/k2 = Kc e o efeito da temperatura.
 */
export function constantesVelocidade(T: number) {
  const Ea = 58e3;
  const k1 = 7.4e9 * Math.exp(-Ea / (R_GAS * T));
  return { k1, k2: k1 / KcN2O4(T) };
}

/** Estado [N₂O₄, NO₂] em mol/L. */
export function derivadaN2O4(T: number) {
  const { k1, k2 } = constantesVelocidade(T);
  return (_t: number, s: Estado): number[] => {
    const v = k1 * s[0] - k2 * s[1] * s[1];
    return [-v, 2 * v];
  };
}

export const quocienteN2O4 = (s: Estado) => (s[0] > 0 ? (s[1] * s[1]) / s[0] : Infinity);

/** Concentrações de equilíbrio a partir de quantidades de N totais (mol/L de N₂O₄ equivalentes). */
export function equilibrioN2O4(totalN2O4Equiv: number, T: number) {
  const K = KcN2O4(T);
  // N₂O₄ = C − x/2, NO₂ = x, x²/(C − x/2) = K → x² + (K/2)x − KC = 0
  const x = (-K / 2 + Math.sqrt((K * K) / 4 + 4 * K * totalN2O4Equiv)) / 2;
  return [totalN2O4Equiv - x / 2, x];
}

export function evoluirN2O4(s: Estado, T: number, dt: number) {
  const { k1, k2 } = constantesVelocidade(T);
  // Passo bem abaixo do tempo de relaxação (o sistema é rígido a quente).
  const hMax = 0.1 / (k1 + 4 * k2 * Math.max(s[1], 0.01));
  return avancar(derivadaN2O4(T), 0, s, dt, hMax).y;
}

// ---------------------------------------------------------------------------
// Pilhas
// ---------------------------------------------------------------------------

export const FARADAY = 96485.33212;

/** Potenciais-padrão de redução (V, 25 °C). */
export const ELETRODOS = [
  { key: 'mg', simbolo: 'Mg', ion: 'Mg²⁺', n: 2, E0: -2.372, massaMolar: 24.305, cor: '#cbd5e1' },
  { key: 'al', simbolo: 'Al', ion: 'Al³⁺', n: 3, E0: -1.662, massaMolar: 26.982, cor: '#d4d4d8' },
  { key: 'zn', simbolo: 'Zn', ion: 'Zn²⁺', n: 2, E0: -0.762, massaMolar: 65.38, cor: '#a1a1aa' },
  { key: 'fe', simbolo: 'Fe', ion: 'Fe²⁺', n: 2, E0: -0.447, massaMolar: 55.845, cor: '#78716c' },
  { key: 'ni', simbolo: 'Ni', ion: 'Ni²⁺', n: 2, E0: -0.257, massaMolar: 58.693, cor: '#9ca3af' },
  { key: 'pb', simbolo: 'Pb', ion: 'Pb²⁺', n: 2, E0: -0.126, massaMolar: 207.2, cor: '#6b7280' },
  { key: 'cu', simbolo: 'Cu', ion: 'Cu²⁺', n: 2, E0: 0.342, massaMolar: 63.546, cor: '#c2703d' },
  { key: 'ag', simbolo: 'Ag', ion: 'Ag⁺', n: 1, E0: 0.7996, massaMolar: 107.868, cor: '#e5e7eb' },
] as const;

export type Eletrodo = (typeof ELETRODOS)[number];

/** Potencial de redução de M^n+/M pela equação de Nernst (25 °C ou T). */
export function potencialEletrodo(e: Eletrodo, conc: number, T = 298.15) {
  return e.E0 + ((R_GAS * T) / (e.n * FARADAY)) * Math.log(conc);
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
const mmc = (a: number, b: number) => (a * b) / mdc(a, b);

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const coef = (k: number) => (k === 1 ? '' : String(k));
export const subscrito = (n: number) => String(n).split('').map((d) => SUB[Number(d)]).join('');

export interface Pilha {
  anodo: Eletrodo;
  catodo: Eletrodo;
  /** Concentrações dos íons do ânodo e do cátodo. */
  cAnodo: number;
  cCatodo: number;
  ddp: number;
  ddpPadrao: number;
  eletrons: number;
  equacao: string;
  /** Coeficientes: a·M_anodo + c·N^m+ → a·M^n+ + c·N */
  a: number;
  c: number;
}

/** Monta a pilha: o eletrodo de menor potencial de redução vira o ânodo. */
export function montarPilha(e1: Eletrodo, c1: number, e2: Eletrodo, c2: number, T = 298.15): Pilha {
  const p1 = potencialEletrodo(e1, c1, T);
  const p2 = potencialEletrodo(e2, c2, T);
  const [anodo, cA, catodo, cC] = p1 <= p2 ? [e1, c1, e2, c2] : [e2, c2, e1, c1];
  const el = mmc(anodo.n, catodo.n);
  const a = el / anodo.n;
  const c = el / catodo.n;
  const equacao = `${coef(a)}${anodo.simbolo} + ${coef(c)}${catodo.ion} → ${coef(a)}${anodo.ion} + ${coef(c)}${catodo.simbolo}`;
  return {
    anodo,
    catodo,
    cAnodo: cA,
    cCatodo: cC,
    ddp: potencialEletrodo(catodo, cC, T) - potencialEletrodo(anodo, cA, T),
    ddpPadrao: catodo.E0 - anodo.E0,
    eletrons: el,
    equacao,
    a,
    c,
  };
}

/**
 * Descarrega a pilha por um resistor R durante dt segundos (meias-células de
 * `volume` litros). A corrente I = ε/R tira cátions do cátodo e põe no ânodo
 * (Faraday), até a ddp chegar a zero (equilíbrio).
 */
export function descarregar(p: Pilha, R: number, volume: number, dt: number, rInterna = 2, T = 298.15) {
  let { cAnodo, cCatodo } = p;
  let carga = 0;
  const passos = 50;
  const h = dt / passos;
  for (let i = 0; i < passos; i++) {
    const ddp = potencialEletrodo(p.catodo, cCatodo, T) - potencialEletrodo(p.anodo, cAnodo, T);
    if (ddp <= 0) break;
    const I = ddp / (R + rInterna);
    // Não deixa o cátion do cátodo acabar num passo só.
    const molE = Math.min((I * h) / FARADAY, cCatodo * 0.5 * p.catodo.n * volume);
    cCatodo -= molE / (p.catodo.n * volume);
    cAnodo += molE / (p.anodo.n * volume);
    carga += molE * FARADAY;
  }
  const ddp = potencialEletrodo(p.catodo, cCatodo, T) - potencialEletrodo(p.anodo, cAnodo, T);
  return { pilha: { ...p, cAnodo, cCatodo, ddp }, carga };
}

/** Massa (g) de metal depositada ou corroída por uma carga Q (C): m = Q·M/(n·F). */
export const massaFaraday = (Q: number, e: Eletrodo) => (Q * e.massaMolar) / (e.n * FARADAY);

// ---------------------------------------------------------------------------
// Decaimento radioativo
// ---------------------------------------------------------------------------

const ANO = 365.25 * 86400;
const DIA = 86400;
const HORA = 3600;

export const ISOTOPOS = [
  { key: 'tc99m', nome: 'Tecnécio-99m', uso: 'exames de imagem (cintilografia)', meiaVida: 6.0067 * HORA, decai: 'γ', filho: 'Tc-99' },
  { key: 'rn222', nome: 'Radônio-222', uso: 'gás radioativo natural do solo', meiaVida: 3.8235 * DIA, decai: 'α', filho: 'Po-218' },
  { key: 'i131', nome: 'Iodo-131', uso: 'tratamento da tireoide; vazou em Chernobyl', meiaVida: 8.0252 * DIA, decai: 'β⁻', filho: 'Xe-131' },
  { key: 'po210', nome: 'Polônio-210', uso: 'descoberto por Marie Curie', meiaVida: 138.376 * DIA, decai: 'α', filho: 'Pb-206' },
  { key: 'co60', nome: 'Cobalto-60', uso: 'radioterapia e esterilização', meiaVida: 5.2714 * ANO, decai: 'β⁻', filho: 'Ni-60' },
  { key: 'cs137', nome: 'Césio-137', uso: 'acidente de Goiânia (1987)', meiaVida: 30.08 * ANO, decai: 'β⁻', filho: 'Ba-137m' },
  { key: 'c14', nome: 'Carbono-14', uso: 'datação de fósseis e artefatos', meiaVida: 5730 * ANO, decai: 'β⁻', filho: 'N-14' },
  { key: 'u238', nome: 'Urânio-238', uso: 'datação de rochas; combustível nuclear', meiaVida: 4.468e9 * ANO, decai: 'α', filho: 'Th-234' },
] as const;

export const constanteDecaimento = (meiaVida: number) => Math.LN2 / meiaVida;
export const restantes = (N0: number, t: number, meiaVida: number) => N0 * 2 ** (-t / meiaVida);
/** Idade a partir da fração que sobrou: t = T½·log₂(N0/N). */
export const idadePorFracao = (fracao: number, meiaVida: number) => meiaVida * Math.log2(1 / fracao);

/**
 * Sorteia, núcleo a núcleo, quem decai em dt (probabilidade 1 − e^(−λdt)).
 * `vivos` é alterado no lugar; devolve quantos decaíram.
 */
export function decairAleatorio(vivos: Uint8Array, dt: number, meiaVida: number, rng: () => number) {
  const p = 1 - Math.exp(-constanteDecaimento(meiaVida) * dt);
  let k = 0;
  for (let i = 0; i < vivos.length; i++) {
    if (vivos[i] && rng() < p) {
      vivos[i] = 0;
      k++;
    }
  }
  return k;
}

/** Formata uma duração em segundos na unidade mais natural. */
export function fmtDuracao(s: number): string {
  const f = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: x < 10 ? 2 : x < 1000 ? 1 : 0 });
  if (s >= 1e6 * ANO) return `${f(s / (1e9 * ANO))} bilhões de anos`;
  if (s >= ANO) return `${f(s / ANO)} anos`;
  if (s >= DIA) return `${f(s / DIA)} dias`;
  if (s >= HORA) return `${f(s / HORA)} h`;
  return `${f(s / 60)} min`;
}

// ---------------------------------------------------------------------------
// Átomo de hidrogênio (Bohr)
// ---------------------------------------------------------------------------

export const RYDBERG_H = 1.096775834e7; // 1/m, com a massa reduzida do próton
export const ENERGIA_IONIZACAO_EV = 13.598;
export const RAIO_BOHR_PM = 52.918;

export const energiaNivel = (n: number) => -ENERGIA_IONIZACAO_EV / (n * n);
export const raioNivel = (n: number) => RAIO_BOHR_PM * n * n;

/** Comprimento de onda (nm, no vácuo) da transição entre os níveis. */
export const comprimentoTransicao = (nSup: number, nInf: number) => 1e9 / (RYDBERG_H * (1 / (nInf * nInf) - 1 / (nSup * nSup)));

export function serieEspectral(nInf: number) {
  return (
    { 1: 'Lyman (ultravioleta)', 2: 'Balmer (visível)', 3: 'Paschen (infravermelho)', 4: 'Brackett (infravermelho)', 5: 'Pfund (infravermelho)' }[nInf] ??
    'infravermelho distante'
  );
}

export function faixaEspectro(nm: number) {
  if (nm < 380) return 'ultravioleta';
  if (nm > 750) return 'infravermelho';
  if (nm < 450) return 'violeta';
  if (nm < 495) return 'azul';
  if (nm < 570) return 'verde';
  if (nm < 590) return 'amarelo';
  if (nm < 620) return 'laranja';
  return 'vermelho';
}

/** Cor aproximada de um comprimento de onda visível (algoritmo de Dan Bruton). */
export function corComprimento(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490 && nm >= 440) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510 && nm >= 490) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580 && nm >= 510) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645 && nm >= 580) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750 && nm >= 645) { r = 1; }
  let f = 0;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm >= 420 && nm <= 700) f = 1;
  else if (nm > 700 && nm <= 750) f = 0.3 + (0.7 * (750 - nm)) / 50;
  const c = (x: number) => Math.round(255 * (x * f) ** 0.8);
  return [c(r), c(g), c(b)];
}

export const PLANCK_EV = 4.135667696e-15; // eV·s
export const C_LUZ = 299_792_458;
export const energiaFoton = (nm: number) => (PLANCK_EV * C_LUZ) / (nm * 1e-9);
