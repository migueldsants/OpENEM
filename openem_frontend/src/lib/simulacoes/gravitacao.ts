/**
 * Gravitação: órbitas dos planetas pelos elementos orbitais reais (equação de
 * Kepler) e um corpo lançado em volta do Sol, integrado numericamente
 * (leapfrog). Unidades: UA, ano e massas solares, em que GM☉ = 4π².
 */
import { grausParaRad } from './numerico';

export const GM_SOL = 4 * Math.PI * Math.PI; // UA³/ano²
export const UA_KM = 149_597_870.7;
export const ANO_S = 365.25 * 86400;

export type V3 = [number, number, number];

/** Elementos J2000 (JPL, Standish): a (UA), e, i, Ω, ϖ e L (graus). */
export const PLANETAS = [
  { key: 'mercurio', nome: 'Mercúrio', a: 0.38710, e: 0.20563, i: 7.005, no: 48.331, pi: 77.456, L: 252.251, raio: 2440, cor: '#a8a29e' },
  { key: 'venus', nome: 'Vênus', a: 0.72333, e: 0.00677, i: 3.395, no: 76.68, pi: 131.533, L: 181.98, raio: 6052, cor: '#e7c27d' },
  { key: 'terra', nome: 'Terra', a: 1.00000, e: 0.01671, i: 0.0, no: 0, pi: 102.947, L: 100.464, raio: 6371, cor: '#4f8fe8' },
  { key: 'marte', nome: 'Marte', a: 1.52368, e: 0.0934, i: 1.85, no: 49.558, pi: 336.06, L: 355.453, raio: 3390, cor: '#d2603a' },
  { key: 'jupiter', nome: 'Júpiter', a: 5.2026, e: 0.04849, i: 1.303, no: 100.464, pi: 14.331, L: 34.351, raio: 69911, cor: '#d9b48f' },
  { key: 'saturno', nome: 'Saturno', a: 9.5549, e: 0.05551, i: 2.489, no: 113.666, pi: 93.057, L: 50.077, raio: 58232, cor: '#e3d29a' },
  { key: 'urano', nome: 'Urano', a: 19.2184, e: 0.0463, i: 0.773, no: 74.006, pi: 173.005, L: 314.055, raio: 25362, cor: '#9fd8e0' },
  { key: 'netuno', nome: 'Netuno', a: 30.1104, e: 0.00899, i: 1.77, no: 131.784, pi: 48.124, L: 304.349, raio: 24622, cor: '#5b7fe0' },
] as const;

export type Planeta = (typeof PLANETAS)[number];

/** Resolve M = E − e·sen E por Newton-Raphson. */
export function resolverKepler(M: number, e: number, tol = 1e-13): number {
  const m = ((M % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let i = 0; i < 50; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < tol) break;
  }
  return E;
}

/** Período sideral pela 3ª lei de Kepler: T² = a³ (anos, UA). */
export const periodoKepler = (a: number) => Math.pow(a, 1.5);

/** Posição heliocêntrica eclíptica (UA) do planeta `t` anos depois de J2000. */
export function posicaoPlaneta(p: Pick<Planeta, 'a' | 'e' | 'i' | 'no' | 'pi' | 'L'>, t: number): V3 {
  const n = 360 / periodoKepler(p.a); // graus/ano
  const M = grausParaRad(p.L - p.pi + n * t);
  const E = resolverKepler(M, p.e);
  const xo = p.a * (Math.cos(E) - p.e);
  const yo = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
  const w = grausParaRad(p.pi - p.no);
  const O = grausParaRad(p.no);
  const I = grausParaRad(p.i);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xo + (-sw * cO - cw * sO * cI) * yo,
    (cw * sO + sw * cO * cI) * xo + (-sw * sO + cw * cO * cI) * yo,
    sw * sI * xo + cw * sI * yo,
  ];
}

/** Distância ao Sol (UA) e velocidade orbital (km/s) pela vis-viva. */
export function visViva(r: number, a: number) {
  const v = Math.sqrt(GM_SOL * (2 / r - 1 / a)); // UA/ano
  return (v * UA_KM) / ANO_S;
}

// ---------------------------------------------------------------------------
// Corpo lançado (integração numérica)
// ---------------------------------------------------------------------------

export interface Corpo {
  pos: V3;
  vel: V3;
}

function aceleracao(p: V3, GM: number): V3 {
  const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
  const r3 = r2 * Math.sqrt(r2);
  return [(-GM * p[0]) / r3, (-GM * p[1]) / r3, (-GM * p[2]) / r3];
}

/** Leapfrog (beija-salta-beija): simplético, não deixa a órbita "espiralar". */
export function passoLeapfrog(c: Corpo, dt: number, GM = GM_SOL): Corpo {
  const a0 = aceleracao(c.pos, GM);
  const vm: V3 = [c.vel[0] + (a0[0] * dt) / 2, c.vel[1] + (a0[1] * dt) / 2, c.vel[2] + (a0[2] * dt) / 2];
  const pos: V3 = [c.pos[0] + vm[0] * dt, c.pos[1] + vm[1] * dt, c.pos[2] + vm[2] * dt];
  const a1 = aceleracao(pos, GM);
  return { pos, vel: [vm[0] + (a1[0] * dt) / 2, vm[1] + (a1[1] * dt) / 2, vm[2] + (a1[2] * dt) / 2] };
}

/** Passo adaptado à distância: perto do Sol o corpo é rápido e pede passo curto. */
export function avancarCorpo(c: Corpo, duracao: number, GM = GM_SOL): Corpo {
  let atual = c;
  let restante = duracao;
  while (restante > 1e-12) {
    const r = Math.hypot(...atual.pos);
    const v = Math.hypot(...atual.vel) || 1e-9;
    const dt = Math.min(restante, 0.002 * (r / v), 0.002 * Math.sqrt(r ** 3 / GM));
    atual = passoLeapfrog(atual, dt, GM);
    restante -= dt;
  }
  return atual;
}

export function energiaEspecifica(c: Corpo, GM = GM_SOL) {
  const v2 = c.vel[0] ** 2 + c.vel[1] ** 2 + c.vel[2] ** 2;
  return v2 / 2 - GM / Math.hypot(...c.pos);
}

export function momentoAngular(c: Corpo): V3 {
  const [x, y, z] = c.pos;
  const [vx, vy, vz] = c.vel;
  return [y * vz - z * vy, z * vx - x * vz, x * vy - y * vx];
}

/** Elementos da órbita a partir do estado: semieixo, excentricidade e tipo. */
export function elementosOrbita(c: Corpo, GM = GM_SOL) {
  const eps = energiaEspecifica(c, GM);
  const h = Math.hypot(...momentoAngular(c));
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (GM * GM)));
  const a = eps < 0 ? -GM / (2 * eps) : Infinity;
  const tipo = eps < -1e-9 ? (e < 1e-3 ? 'circular' : 'elíptica') : Math.abs(eps) <= 1e-9 ? 'parabólica' : 'hiperbólica';
  return {
    a,
    e,
    tipo,
    periodo: eps < 0 ? periodoKepler(a) : Infinity,
    perielio: eps < 0 ? a * (1 - e) : (h * h) / GM / (1 + e),
    afelio: eps < 0 ? a * (1 + e) : Infinity,
  };
}

/** Velocidade de órbita circular e de escape a r UA (UA/ano). */
export const vCircular = (r: number, GM = GM_SOL) => Math.sqrt(GM / r);
export const vEscape = (r: number, GM = GM_SOL) => Math.sqrt((2 * GM) / r);
