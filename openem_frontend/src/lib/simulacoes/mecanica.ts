/**
 * Mecânica: lançamento oblíquo (com arrasto do ar), pêndulo simples (sem a
 * aproximação de ângulo pequeno), oscilador massa-mola (amortecido e forçado),
 * plano inclinado com atrito e empuxo (Arquimedes).
 */
import { avancar, elipticaK, grausParaRad, rk4, type Estado } from './numerico';

export const GRAVIDADES = [
  { key: 'terra', nome: 'Terra', g: 9.81 },
  { key: 'lua', nome: 'Lua', g: 1.62 },
  { key: 'marte', nome: 'Marte', g: 3.71 },
  { key: 'jupiter', nome: 'Júpiter', g: 24.79 },
] as const;

// ---------------------------------------------------------------------------
// Lançamento oblíquo
// ---------------------------------------------------------------------------

/** Densidade do ar ao nível do mar a 15 °C (kg/m³). */
export const RHO_AR = 1.225;

/** Projéteis reais: massa (kg), diâmetro (m) e coeficiente de arrasto de esfera. */
export const PROJETEIS = [
  { key: 'futebol', nome: 'Bola de futebol', massa: 0.43, diametro: 0.22, cd: 0.25 },
  { key: 'tenis', nome: 'Bola de tênis', massa: 0.057, diametro: 0.067, cd: 0.55 },
  { key: 'pingue', nome: 'Bola de pingue-pongue', massa: 0.0027, diametro: 0.04, cd: 0.5 },
  { key: 'peso', nome: 'Peso de arremesso (7,26 kg)', massa: 7.26, diametro: 0.12, cd: 0.47 },
] as const;

export interface ParamLancamento {
  v0: number; // m/s
  anguloGraus: number;
  h0: number; // m
  g: number;
  /** k = ½ρ·Cd·A/m (1/m); 0 desliga o arrasto. */
  k: number;
}

export function coeficienteArrasto(p: { massa: number; diametro: number; cd: number }, rho = RHO_AR) {
  const area = Math.PI * (p.diametro / 2) ** 2;
  return (0.5 * rho * p.cd * area) / p.massa;
}

/** Estado [x, y, vx, vy]; arrasto quadrático F = −k·m·|v|·v. */
export function derivadaLancamento(g: number, k: number) {
  return (_t: number, s: Estado): number[] => {
    const [, , vx, vy] = s;
    const v = Math.hypot(vx, vy);
    return [vx, vy, -k * v * vx, -g - k * v * vy];
  };
}

export interface Trajetoria {
  pontos: { t: number; x: number; y: number; vx: number; vy: number }[];
  alcance: number;
  alturaMax: number;
  tempoVoo: number;
  vImpacto: number;
}

export function simularLancamento(p: ParamLancamento, dt = 0.002): Trajetoria {
  const th = grausParaRad(p.anguloGraus);
  let s: number[] = [0, p.h0, p.v0 * Math.cos(th), p.v0 * Math.sin(th)];
  let t = 0;
  const f = derivadaLancamento(p.g, p.k);
  const pontos = [{ t, x: s[0], y: s[1], vx: s[2], vy: s[3] }];
  let alturaMax = p.h0;
  for (let i = 0; i < 2_000_000; i++) {
    const prox = rk4(f, t, s, dt);
    if (prox[1] < 0 && prox[3] < 0) {
      // Interpola o instante exato em que y = 0.
      const fr = s[1] / (s[1] - prox[1]);
      const fim = s.map((v, j) => v + fr * (prox[j] - v));
      t += fr * dt;
      fim[1] = 0;
      pontos.push({ t, x: fim[0], y: 0, vx: fim[2], vy: fim[3] });
      return {
        pontos,
        alcance: fim[0],
        alturaMax,
        tempoVoo: t,
        vImpacto: Math.hypot(fim[2], fim[3]),
      };
    }
    s = prox;
    t += dt;
    alturaMax = Math.max(alturaMax, s[1]);
    pontos.push({ t, x: s[0], y: s[1], vx: s[2], vy: s[3] });
  }
  throw new Error('lançamento não terminou');
}

/** Solução sem arrasto (fórmulas do ensino médio). */
export function lancamentoIdeal(p: Omit<ParamLancamento, 'k'>) {
  const th = grausParaRad(p.anguloGraus);
  const vx = p.v0 * Math.cos(th);
  const vy = p.v0 * Math.sin(th);
  const tempoVoo = (vy + Math.sqrt(vy * vy + 2 * p.g * p.h0)) / p.g;
  return {
    tempoVoo,
    alcance: vx * tempoVoo,
    alturaMax: p.h0 + (vy * vy) / (2 * p.g),
  };
}

// ---------------------------------------------------------------------------
// Pêndulo simples
// ---------------------------------------------------------------------------

/** Estado [θ, ω]; b é o amortecimento (1/s). */
export function derivadaPendulo(g: number, L: number, b: number) {
  return (_t: number, s: Estado): number[] => [s[1], -(g / L) * Math.sin(s[0]) - b * s[1]];
}

export function periodoPequenasOscilacoes(L: number, g: number) {
  return 2 * Math.PI * Math.sqrt(L / g);
}

/** Período exato para amplitude θ0: T = 4·√(L/g)·K(sen(θ0/2)). */
export function periodoExato(L: number, g: number, theta0: number) {
  return 4 * Math.sqrt(L / g) * elipticaK(Math.sin(Math.abs(theta0) / 2));
}

export function energiaPendulo(m: number, g: number, L: number, theta: number, omega: number) {
  const cinetica = 0.5 * m * (L * omega) ** 2;
  const potencial = m * g * L * (1 - Math.cos(theta));
  return { cinetica, potencial, total: cinetica + potencial };
}

/**
 * Mede o período integrando: tempo entre duas passagens de ω de + para −
 * (extremos do mesmo lado), com interpolação linear.
 */
export function medirPeriodo(f: ReturnType<typeof derivadaPendulo>, y0: Estado, dt = 1e-3, tMax = 60) {
  let s = [...y0];
  let t = 0;
  const cruzamentos: number[] = [];
  while (t < tMax && cruzamentos.length < 3) {
    const prox = rk4(f, t, s, dt);
    if (s[1] > 0 && prox[1] <= 0) cruzamentos.push(t + (dt * s[1]) / (s[1] - prox[1]));
    s = prox;
    t += dt;
  }
  if (cruzamentos.length < 3) return NaN;
  return cruzamentos[2] - cruzamentos[1];
}

// ---------------------------------------------------------------------------
// Massa-mola
// ---------------------------------------------------------------------------

export interface ParamMola {
  m: number; // kg
  k: number; // N/m
  c: number; // kg/s (amortecimento viscoso)
  F0: number; // N (amplitude da força externa)
  omegaF: number; // rad/s (frequência da força externa)
}

/** Estado [x, v]. */
export function derivadaMola(p: ParamMola) {
  return (t: number, s: Estado): number[] => [
    s[1],
    (-p.k * s[0] - p.c * s[1] + p.F0 * Math.cos(p.omegaF * t)) / p.m,
  ];
}

export const omegaNatural = (m: number, k: number) => Math.sqrt(k / m);
export const periodoMola = (m: number, k: number) => 2 * Math.PI * Math.sqrt(m / k);

/** Regime do amortecimento pela razão ζ = c / (2√(km)). */
export function regimeAmortecimento(p: Pick<ParamMola, 'm' | 'k' | 'c'>) {
  const zeta = p.c / (2 * Math.sqrt(p.k * p.m));
  if (zeta === 0) return { zeta, nome: 'sem amortecimento' };
  if (zeta < 1 - 1e-9) return { zeta, nome: 'subamortecido' };
  if (zeta <= 1 + 1e-9) return { zeta, nome: 'amortecimento crítico' };
  return { zeta, nome: 'superamortecido' };
}

/** Amplitude do regime permanente sob força F0·cos(ωt). */
export function amplitudeForcada(p: ParamMola) {
  const { m, k, c, F0, omegaF: w } = p;
  return F0 / Math.sqrt((k - m * w * w) ** 2 + (c * w) ** 2);
}

/** Solução livre subamortecida a partir do repouso em x0. */
export function molaLivreAnalitica(p: Pick<ParamMola, 'm' | 'k' | 'c'>, x0: number, t: number) {
  const gamma = p.c / (2 * p.m);
  const w0 = omegaNatural(p.m, p.k);
  const wd = Math.sqrt(w0 * w0 - gamma * gamma);
  return x0 * Math.exp(-gamma * t) * (Math.cos(wd * t) + (gamma / wd) * Math.sin(wd * t));
}

// ---------------------------------------------------------------------------
// Plano inclinado
// ---------------------------------------------------------------------------

export interface ParamPlano {
  anguloGraus: number;
  m: number;
  muE: number; // atrito estático
  muC: number; // atrito cinético (≤ μe)
  g: number;
}

export function forcasPlano(p: ParamPlano) {
  const th = grausParaRad(p.anguloGraus);
  const peso = p.m * p.g;
  const px = peso * Math.sin(th);
  const normal = peso * Math.cos(th);
  const muC = Math.min(p.muC, p.muE);
  const atritoMaxEstatico = p.muE * normal;
  const parado = px <= atritoMaxEstatico + 1e-12;
  const atrito = parado ? px : muC * normal;
  const resultante = px - atrito;
  return {
    peso,
    px,
    py: normal,
    normal,
    atrito,
    atritoMaxEstatico,
    parado,
    resultante,
    aceleracao: resultante / p.m,
    /** Ângulo a partir do qual o bloco escorrega: tg θ = μe. */
    anguloCritico: (Math.atan(p.muE) * 180) / Math.PI,
  };
}

/** Tempo e velocidade ao percorrer `d` metros a partir do repouso. */
export function descidaPlano(p: ParamPlano, d: number) {
  const { aceleracao, parado } = forcasPlano(p);
  if (parado || aceleracao <= 0) return { tempo: Infinity, velocidade: 0 };
  return { tempo: Math.sqrt((2 * d) / aceleracao), velocidade: Math.sqrt(2 * aceleracao * d) };
}

// ---------------------------------------------------------------------------
// Empuxo
// ---------------------------------------------------------------------------

export const FLUIDOS = [
  { key: 'agua', nome: 'Água doce', rho: 997 },
  { key: 'mar', nome: 'Água do mar', rho: 1025 },
  { key: 'oleo', nome: 'Óleo de cozinha', rho: 920 },
  { key: 'alcool', nome: 'Álcool etílico', rho: 789 },
  { key: 'glicerina', nome: 'Glicerina', rho: 1261 },
  { key: 'mercurio', nome: 'Mercúrio', rho: 13534 },
] as const;

export const MATERIAIS = [
  { key: 'isopor', nome: 'Isopor', rho: 30 },
  { key: 'cortica', nome: 'Cortiça', rho: 240 },
  { key: 'pinho', nome: 'Madeira (pinho)', rho: 500 },
  { key: 'gelo', nome: 'Gelo', rho: 917 },
  { key: 'pvc', nome: 'PVC', rho: 1380 },
  { key: 'aluminio', nome: 'Alumínio', rho: 2700 },
  { key: 'ferro', nome: 'Ferro', rho: 7870 },
  { key: 'ouro', nome: 'Ouro', rho: 19300 },
] as const;

export interface ParamEmpuxo {
  aresta: number; // m (cubo)
  rhoCorpo: number;
  rhoFluido: number;
  g: number;
}

/** Volume submerso de um cubo cuja base está na profundidade `prof` (m). */
export function volumeSubmerso(aresta: number, prof: number) {
  const h = Math.min(aresta, Math.max(0, prof));
  return aresta * aresta * h;
}

export function forcasEmpuxo(p: ParamEmpuxo, prof: number) {
  const V = p.aresta ** 3;
  const peso = p.rhoCorpo * V * p.g;
  const empuxo = p.rhoFluido * p.g * volumeSubmerso(p.aresta, prof);
  return { peso, empuxo, pesoAparente: peso - empuxo, volume: V };
}

/** Equilíbrio: fração submersa ρc/ρf se flutua; afunda se ρc > ρf. */
export function equilibrioEmpuxo(p: ParamEmpuxo) {
  const fracao = p.rhoCorpo / p.rhoFluido;
  const flutua = fracao < 1;
  return {
    flutua,
    fracaoSubmersa: flutua ? fracao : 1,
    profundidade: flutua ? fracao * p.aresta : Infinity,
  };
}

/**
 * Dinâmica vertical do cubo: estado [prof, v] (prof = quanto a base está
 * abaixo da superfície, positivo para baixo). Inclui arrasto do fluido
 * (Cd ≈ 1,05 de um cubo) e a perda por ondas na superfície; a massa
 * adicional é desprezada. O fundo do tanque em
 * `fundo` metros segura o corpo.
 */
export function passoEmpuxo(p: ParamEmpuxo, s: Estado, dt: number, fundo: number) {
  const V = p.aresta ** 3;
  const m = p.rhoCorpo * V;
  const A = p.aresta * p.aresta;
  const f = (_t: number, y: Estado): number[] => {
    const [prof, v] = y;
    const sub = volumeSubmerso(p.aresta, prof);
    const rhoMeio = sub > 0 ? p.rhoFluido : 1.2;
    const empuxo = p.rhoFluido * p.g * sub;
    const arrasto = 0.5 * rhoMeio * 1.05 * A * v * Math.abs(v);
    // Boiando, o corpo perde energia gerando ondas na superfície: um
    // amortecimento linear de ~15% do crítico da rigidez hidrostática ρ·g·A.
    const naLinha = prof > 0 && prof < p.aresta;
    const radiacao = naLinha ? 2 * 0.15 * Math.sqrt(p.rhoFluido * p.g * A * m) * v : 0;
    return [v, (m * p.g - empuxo - arrasto - radiacao) / m];
  };
  const r = avancar(f, 0, s, dt, 1 / 2000);
  let [prof, v] = r.y;
  if (prof > fundo) {
    prof = fundo;
    v = Math.min(0, v);
  }
  return [prof, v];
}
