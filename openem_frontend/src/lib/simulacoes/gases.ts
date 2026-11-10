/**
 * Gás em duas dimensões por dinâmica molecular: discos rígidos com colisões
 * elásticas entre si e com as paredes, uma delas um pistão móvel. A pressão
 * não é calculada pela fórmula: é medida pelo impulso que as moléculas dão
 * nas paredes, e a temperatura pela energia cinética média. A equação dos
 * gases (aqui na versão 2D, P·A = N·k·T) aparece sozinha.
 *
 * Unidades internas: nm, ps e nm/ps (1 nm/ps = 1000 m/s).
 */
import { criarRng, normal } from './numerico';

export const K_BOLTZMANN = 1.380649e-23; // J/K
export const MASSA_N2 = 4.6518e-26; // kg
export const RAIO_N2 = 0.18; // nm (diâmetro cinético 0,364 nm)

export interface Gas {
  n: number;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  largura: number; // posição do pistão (nm)
  altura: number; // nm
  raio: number; // nm
  massa: number; // kg
  /** Impulso acumulado nas paredes (kg·nm/ps) e tempo de medição (ps). */
  impulso: number;
  tempoMedido: number;
  rng: () => number;
}

/** Desvio-padrão de cada componente da velocidade (nm/ps) a T kelvin. */
export function sigmaVelocidade(T: number, massa = MASSA_N2) {
  return Math.sqrt((K_BOLTZMANN * T) / massa) / 1000;
}

export function criarGas(n: number, T: number, largura: number, altura: number, semente = 1, raio = RAIO_N2, massa = MASSA_N2): Gas {
  const rng = criarRng(semente);
  const g: Gas = {
    n: 0,
    x: new Float64Array(2000),
    y: new Float64Array(2000),
    vx: new Float64Array(2000),
    vy: new Float64Array(2000),
    largura,
    altura,
    raio,
    massa,
    impulso: 0,
    tempoMedido: 0,
    rng,
  };
  adicionarMoleculas(g, n, T);
  return g;
}

/** Injeta moléculas na temperatura T em pontos livres (como abrir uma válvula). */
export function adicionarMoleculas(g: Gas, quantidade: number, T: number) {
  const s = sigmaVelocidade(T, g.massa);
  const limite = Math.min(g.x.length, g.n + quantidade);
  let tentativas = 0;
  while (g.n < limite && tentativas < 50_000) {
    tentativas++;
    const x = g.raio + g.rng() * (g.largura - 2 * g.raio);
    const y = g.raio + g.rng() * (g.altura - 2 * g.raio);
    let livre = true;
    for (let j = 0; j < g.n && livre; j++) {
      if ((g.x[j] - x) ** 2 + (g.y[j] - y) ** 2 < (2 * g.raio) ** 2) livre = false;
    }
    if (!livre) continue;
    const i = g.n++;
    g.x[i] = x;
    g.y[i] = y;
    g.vx[i] = s * normal(g.rng);
    g.vy[i] = s * normal(g.rng);
  }
}

export function removerMoleculas(g: Gas, quantidade: number) {
  g.n = Math.max(0, g.n - quantidade);
}

/** Energia cinética total (J). */
export function energiaCinetica(g: Gas) {
  let s = 0;
  for (let i = 0; i < g.n; i++) s += g.vx[i] ** 2 + g.vy[i] ** 2;
  return 0.5 * g.massa * s * 1e6;
}

/** Temperatura pela equipartição em 2D: ⟨½mv²⟩ = kT. */
export function temperatura(g: Gas) {
  if (g.n === 0) return 0;
  return energiaCinetica(g) / (g.n * K_BOLTZMANN);
}

/** Área (m²). */
export const area = (g: Gas) => g.largura * g.altura * 1e-18;

/** Pressão ideal 2D (N/m) para comparar com a medida. */
export const pressaoIdeal = (g: Gas, T = temperatura(g)) => (g.n * K_BOLTZMANN * T) / area(g);

/** Pressão medida (N/m): impulso por perímetro por tempo. */
export function pressaoMedida(g: Gas) {
  if (g.tempoMedido <= 0) return 0;
  const perimetro = 2 * (g.largura + g.altura) * 1e-9; // m
  const impulsoSI = g.impulso * 1000; // kg·m/s
  return impulsoSI / (perimetro * g.tempoMedido * 1e-12);
}

export function zerarMedicao(g: Gas) {
  g.impulso = 0;
  g.tempoMedido = 0;
}

/** Reescala as velocidades para a temperatura alvo (termostato de Berendsen). */
export function termostato(g: Gas, Talvo: number, dt: number, tau = 5) {
  const T = temperatura(g);
  if (T <= 0) return;
  const lambda = Math.sqrt(1 + (dt / tau) * (Talvo / T - 1));
  for (let i = 0; i < g.n; i++) {
    g.vx[i] *= lambda;
    g.vy[i] *= lambda;
  }
}

/**
 * Avança dt ps. `velPistao` (nm/ps) move a parede direita: ao empurrar, ela
 * devolve as moléculas mais rápidas (o gás esquenta, compressão adiabática).
 */
export function passoGas(g: Gas, dt: number, velPistao = 0) {
  const { n, x, y, vx, vy, raio, massa } = g;
  g.largura = Math.max(6 * raio, g.largura + velPistao * dt);
  const W = g.largura;
  const H = g.altura;
  for (let i = 0; i < n; i++) {
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;
    if (x[i] < raio) {
      x[i] = 2 * raio - x[i];
      if (vx[i] < 0) { g.impulso += 2 * massa * -vx[i]; vx[i] = -vx[i]; }
    } else if (x[i] > W - raio) {
      x[i] = Math.max(raio, 2 * (W - raio) - x[i]);
      const rel = vx[i] - velPistao;
      if (rel > 0) {
        g.impulso += 2 * massa * rel;
        vx[i] = 2 * velPistao - vx[i];
      }
    }
    if (y[i] < raio) {
      y[i] = 2 * raio - y[i];
      if (vy[i] < 0) { g.impulso += 2 * massa * -vy[i]; vy[i] = -vy[i]; }
    } else if (y[i] > H - raio) {
      y[i] = 2 * (H - raio) - y[i];
      if (vy[i] > 0) { g.impulso += 2 * massa * vy[i]; vy[i] = -vy[i]; }
    }
  }
  colisoes(g);
  g.tempoMedido += dt;
}

/** Colisões elásticas entre discos iguais, com grade espacial (O(n)). */
function colisoes(g: Gas) {
  const { n, x, y, vx, vy, raio } = g;
  const d = 2 * raio;
  const tam = Math.max(d, 1);
  const cols = Math.max(1, Math.ceil(g.largura / tam));
  const lins = Math.max(1, Math.ceil(g.altura / tam));
  const cabeca = new Int32Array(cols * lins).fill(-1);
  const prox = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / tam)));
    const l = Math.min(lins - 1, Math.max(0, Math.floor(y[i] / tam)));
    const k = l * cols + c;
    prox[i] = cabeca[k];
    cabeca[k] = i;
  }
  for (let i = 0; i < n; i++) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / tam)));
    const l = Math.min(lins - 1, Math.max(0, Math.floor(y[i] / tam)));
    for (let dl = -1; dl <= 1; dl++) {
      const ll = l + dl;
      if (ll < 0 || ll >= lins) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc;
        if (cc < 0 || cc >= cols) continue;
        for (let j = cabeca[ll * cols + cc]; j !== -1; j = prox[j]) {
          if (j <= i) continue;
          const dx = x[j] - x[i];
          const dy = y[j] - y[i];
          const dist2 = dx * dx + dy * dy;
          if (dist2 >= d * d || dist2 === 0) continue;
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const vrel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
          if (vrel > 0) {
            // Massas iguais: trocam a componente normal da velocidade.
            vx[i] -= vrel * nx;
            vy[i] -= vrel * ny;
            vx[j] += vrel * nx;
            vy[j] += vrel * ny;
          }
          // Desfaz a sobreposição sem mexer na energia.
          const sep = (d - dist) / 2;
          x[i] -= sep * nx;
          y[i] -= sep * ny;
          x[j] += sep * nx;
          y[j] += sep * ny;
        }
      }
    }
  }
}

/** Distribuição de Maxwell-Boltzmann em 2D: f(v) = (m v / kT) e^(−mv²/2kT), v em m/s. */
export function maxwell2D(v: number, T: number, massa = MASSA_N2) {
  const a = massa / (K_BOLTZMANN * T);
  return a * v * Math.exp((-a * v * v) / 2);
}

/** Histograma das velocidades (m/s) em `faixas` intervalos de 0 a vMax. */
export function histogramaVelocidades(g: Gas, vMax: number, faixas: number) {
  const h = new Array<number>(faixas).fill(0);
  for (let i = 0; i < g.n; i++) {
    const v = Math.hypot(g.vx[i], g.vy[i]) * 1000;
    const k = Math.floor((v / vMax) * faixas);
    if (k < faixas) h[k]++;
  }
  return h;
}
