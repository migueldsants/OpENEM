/**
 * Biologia (dinâmica de populações e genética de populações) e Geografia
 * (estações do ano, duração do dia e insolação).
 */
import { binomial, grausParaRad, radParaGraus, type Estado } from './numerico';

// ---------------------------------------------------------------------------
// Predador e presa (Lotka-Volterra, com capacidade de suporte opcional)
// ---------------------------------------------------------------------------

export interface ParamPopulacao {
  alfa: number; // natalidade da presa (1/ano)
  beta: number; // taxa de predação
  gama: number; // mortalidade do predador (1/ano)
  delta: number; // conversão de presa em filhotes de predador
  /** Capacidade de suporte da presa; Infinity = modelo clássico. */
  K: number;
}

/**
 * Parâmetros ajustados aos registros de peles de lebres e linces da Hudson's
 * Bay Company (milhares de animais, tempo em anos).
 */
export const LEBRE_LINCE: ParamPopulacao = { alfa: 0.55, beta: 0.028, gama: 0.84, delta: 0.026, K: Infinity };

/** Estado [presas, predadores]. */
export function derivadaPopulacao(p: ParamPopulacao) {
  return (_t: number, s: Estado): number[] => {
    const [x, y] = s;
    const logistica = Number.isFinite(p.K) ? 1 - x / p.K : 1;
    return [p.alfa * x * logistica - p.beta * x * y, p.delta * x * y - p.gama * y];
  };
}

/** Ponto de equilíbrio com as duas espécies. */
export function equilibrioPopulacao(p: ParamPopulacao) {
  const x = p.gama / p.delta;
  const logistica = Number.isFinite(p.K) ? 1 - x / p.K : 1;
  return { presas: x, predadores: (p.alfa * logistica) / p.beta };
}

/** Grandeza conservada do modelo clássico (as órbitas são fechadas). */
export function invarianteLV(p: ParamPopulacao, x: number, y: number) {
  return p.delta * x - p.gama * Math.log(x) + p.beta * y - p.alfa * Math.log(y);
}

// ---------------------------------------------------------------------------
// Genética de populações (Hardy-Weinberg e Wright-Fisher)
// ---------------------------------------------------------------------------

export interface Aptidao {
  AA: number;
  Aa: number;
  aa: number;
}

export const NEUTRO: Aptidao = { AA: 1, Aa: 1, aa: 1 };

/** Frequências genotípicas de Hardy-Weinberg: p², 2pq, q². */
export function hardyWeinberg(p: number) {
  const q = 1 - p;
  return { AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** Frequência de A depois da seleção natural (população infinita). */
export function selecao(p: number, w: Aptidao) {
  const q = 1 - p;
  const media = p * p * w.AA + 2 * p * q * w.Aa + q * q * w.aa;
  return (p * p * w.AA + p * q * w.Aa) / media;
}

/**
 * Uma geração de Wright-Fisher: seleção e depois sorteio de 2N alelos (a
 * deriva genética). `N` é o número de indivíduos diploides.
 */
export function proximaGeracao(p: number, N: number, w: Aptidao, rng: () => number) {
  const ps = selecao(p, w);
  return binomial(2 * N, ps, rng) / (2 * N);
}

// ---------------------------------------------------------------------------
// Estações do ano
// ---------------------------------------------------------------------------

export const OBLIQUIDADE = 23.44; // graus
export const CONSTANTE_SOLAR = 1361; // W/m²

/** Dia do ano (1 a 365/366) de uma data. */
export function diaDoAno(d: Date) {
  const inicio = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - inicio) / 86400000) + 1;
}

/** Ângulo do ano (rad) da série de Spencer. */
const gamaAno = (dia: number) => (2 * Math.PI * (dia - 1)) / 365;

/** Declinação do Sol (graus) pela série de Fourier de Spencer (1971), erro < 0,04°. */
export function declinacaoSolar(dia: number) {
  const g = gamaAno(dia);
  return radParaGraus(
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
      0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g),
  );
}

/** (r₀/r)²: fator da distância Terra-Sol (1 em média; ~1,034 em janeiro). */
export function fatorDistancia(dia: number) {
  const g = gamaAno(dia);
  return 1.00011 + 0.034221 * Math.cos(g) + 0.00128 * Math.sin(g) + 0.000719 * Math.cos(2 * g) + 0.000077 * Math.sin(2 * g);
}

/**
 * Ângulo horário do nascer/pôr (graus). `h0` é a altura do centro do Sol no
 * horizonte: −0,833° considera a refração e o raio do disco (padrão dos
 * almanaques); 0 é o horizonte geométrico.
 */
export function anguloHorarioPor(lat: number, dec: number, h0 = -0.833) {
  const f = grausParaRad(lat);
  const d = grausParaRad(dec);
  const c = (Math.sin(grausParaRad(h0)) - Math.sin(f) * Math.sin(d)) / (Math.cos(f) * Math.cos(d));
  if (c <= -1) return 180; // sol da meia-noite
  if (c >= 1) return 0; // noite polar
  return radParaGraus(Math.acos(c));
}

/** Horas de Sol no dia. */
export const duracaoDia = (lat: number, dec: number, h0 = -0.833) => (2 * anguloHorarioPor(lat, dec, h0)) / 15;

/** Altura do Sol ao meio-dia solar (graus): 90° − |φ − δ|. */
export const alturaMeioDia = (lat: number, dec: number) => 90 - Math.abs(lat - dec);

/** Insolação média diária no topo da atmosfera (W/m²). */
export function insolacaoDiaria(lat: number, dia: number) {
  const dec = grausParaRad(declinacaoSolar(dia));
  const f = grausParaRad(lat);
  const H = grausParaRad(anguloHorarioPor(lat, radParaGraus(dec), 0));
  return (CONSTANTE_SOLAR / Math.PI) * fatorDistancia(dia) * (H * Math.sin(f) * Math.sin(dec) + Math.cos(f) * Math.cos(dec) * Math.sin(H));
}

/** Estação astronômica num hemisfério (datas médias de equinócios e solstícios). */
export function estacao(dia: number, hemisferio: 'sul' | 'norte') {
  const sul = dia >= 79 && dia < 172 ? 'outono' : dia >= 172 && dia < 266 ? 'inverno' : dia >= 266 && dia < 355 ? 'primavera' : 'verão';
  if (hemisferio === 'sul') return sul;
  return { outono: 'primavera', inverno: 'verão', primavera: 'outono', 'verão': 'inverno' }[sul]!;
}

/** Eixo da Terra em coordenadas eclípticas (x para o ponto vernal): inclinado para +y. */
export function eixoTerra(): [number, number, number] {
  const e = grausParaRad(OBLIQUIDADE);
  return [0, Math.sin(e), Math.cos(e)];
}

export const CIDADES = [
  { key: 'macapa', nome: 'Macapá (Equador)', lat: 0.03 },
  { key: 'manaus', nome: 'Manaus', lat: -3.12 },
  { key: 'recife', nome: 'Recife', lat: -8.05 },
  { key: 'brasilia', nome: 'Brasília', lat: -15.79 },
  { key: 'saopaulo', nome: 'São Paulo (Trópico de Capricórnio)', lat: -23.55 },
  { key: 'portoalegre', nome: 'Porto Alegre', lat: -30.03 },
  { key: 'ushuaia', nome: 'Ushuaia (Argentina)', lat: -54.8 },
  { key: 'lisboa', nome: 'Lisboa', lat: 38.72 },
  { key: 'oslo', nome: 'Oslo', lat: 59.91 },
  { key: 'tromso', nome: 'Tromsø (Círculo Polar Ártico)', lat: 69.65 },
] as const;
