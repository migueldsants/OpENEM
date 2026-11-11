/**
 * Miniaturas vivas da lista de simulações: cada experimento aparece rodando
 * antes do clique, desenhado com a mesma física da tela cheia (trajetória
 * integrada, refração de Snell, órbita de Kepler, decaimento exponencial…).
 *
 * Cada miniatura é um retrato reduzido do palco da sua simulação, com as
 * mesmas cores e formas (massa em `brand`, normal em `mat`, atrito em
 * `danger`, lebres em `mat`, linces em `hum`, setores de Kepler em azul e
 * rosa…) e o mesmo fundo do palco: sólido (`surface-2`, pintado pela caixa da
 * prévia), ou o céu estrelado nas cenas de astronomia. Mudou a cor de algo numa simulação de `sims/`? Mude aqui também.
 */
import { simularLancamento } from '../../lib/simulacoes/mecanica';
import { resolverKepler } from '../../lib/simulacoes/gravitacao';
import { COR_ATOMO, MOLECULAS, montarMolecula } from '../../lib/simulacoes/moleculas';
import { criarRng, avancar } from '../../lib/simulacoes/numerico';
import { formarImagem, frentesDeOnda, refratar } from '../../lib/simulacoes/optica-ondas';
import { comprimentoTransicao, corComprimento } from '../../lib/simulacoes/quimica';
import { derivadaPopulacao, LEBRE_LINCE, NEUTRO, proximaGeracao } from '../../lib/simulacoes/vida-terra';
import { ESTRUTURAS, gerarReticulo } from '../../lib/simulacoes/cristais';
import { posicaoPar } from '../../lib/simulacoes/dna';
import { elongacao } from '../../lib/simulacoes/lua';
import { altura, envoltoria } from '../../lib/simulacoes/ondas-superficie';
import { PARES } from '../../lib/simulacoes/isomeria';
import { distribuicaoSoma, triangulo } from '../../lib/simulacoes/matematica';
import { dobrar, solido, type Face } from '../../lib/simulacoes/solidos';
import { nucleo } from '../../lib/simulacoes/atomo';
import { alfa, COR_CEU, seta, texto } from './canvas';

export interface Tinta {
  fg: string;
  muted: string;
  line: string;
  surface: string;
  brand: string;
  mat: string;
  nat: string;
  hum: string;
  lin: string;
  danger: string;
  escuro: boolean;
}

type Desenho = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, k: Tinta) => void;

const TAU = Math.PI * 2;
const fase = (t: number, periodo: number) => (t % periodo) / periodo;

// Cores fixas, as mesmas constantes de `sims/`.
const LASER = '#ff3b3b';
const AGUA = '#3b82f6';
const CORTICA = '#b0855a';
const COBRE = '#c2703d';
const ZINCO = '#a1a1aa';
const CU2 = '#2563eb';
const NO2 = '#b4532a';
const SOL = '#ffd166';
const SOL_HALO = '#ffb703';
const PINK = '#f2587a';
const COR_GEN = { AA: '#3f2d20', Aa: '#9a6b42', aa: '#e3c79b' } as const;

function bola(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string | CanvasGradient) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Massa com reflexo, como a do pêndulo: fg no brilho, a cor na borda. */
function massa(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string, k: Tinta) {
  const g = ctx.createRadialGradient(x - r / 3, y - r / 3, 1, x, y, r);
  g.addColorStop(0, alfa(k.fg, 0.95));
  g.addColorStop(1, cor);
  bola(ctx, x, y, r, g);
}

function brilho(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string, forca = 0.85) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alfa(cor, forca));
  g.addColorStop(1, alfa(cor, 0));
  bola(ctx, x, y, r, g);
}

function linha(ctx: CanvasRenderingContext2D, pts: [number, number][], cor: string, larg = 1.5, tracejado?: number[]) {
  if (pts.length < 2) return;
  ctx.strokeStyle = cor;
  ctx.lineWidth = larg;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(tracejado ?? []);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Ponto de uma poligonal pela distância percorrida desde o começo. */
function aoLongo(pts: [number, number][], d: number): [number, number] | null {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (d <= L) return [x0 + ((x1 - x0) * d) / L, y0 + ((y1 - y0) * d) / L];
    d -= L;
  }
  return null;
}

function comprimento(pts: [number, number][]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

// Dados que valem a pena calcular uma vez só.
let trajeto: ReturnType<typeof simularLancamento> | null = null;
let trajetoVacuo: ReturnType<typeof simularLancamento> | null = null;
let populacoes: [number, number][] | null = null;
let deriva: number[] | null = null;
let nacl: ReturnType<typeof gerarReticulo> | null = null;
let cubo: Face | null = null;
let nucleoMini: ReturnType<typeof nucleo> | null = null;
const agua = montarMolecula(MOLECULAS.find((m) => m.key === 'h2o')!); // a molécula que a simulação abre
const vidaNucleo = (() => {
  const r = criarRng(3);
  return Array.from({ length: 16 * 10 }, () => -Math.log(1 - r()) / Math.LN2); // em meias-vidas
})();
const gas = (() => {
  const r = criarRng(9);
  return Array.from({ length: 48 }, () => ({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5 }));
})();
const bichos = (() => {
  const r = criarRng(21);
  return Array.from({ length: 60 }, () => ({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5 }));
})();

const estrelas = (() => {
  const r = criarRng(17);
  return Array.from({ length: 90 }, () => ({ x: r(), y: r(), tam: 0.5 + r() * r() * 1.6, fase: r() * TAU, quente: r() < 0.2 }));
})();

/**
 * O céu das cenas de astronomia, como no palco 3D (`Palco3D` com `ceu`):
 * fundo de espaço e estrelas que cintilam devagar.
 */
function ceu(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = COR_CEU;
  ctx.fillRect(0, 0, w, h);
  for (const e of estrelas) {
    const a = 0.45 + 0.35 * Math.sin(t * 1.4 + e.fase);
    ctx.fillStyle = e.quente ? `rgba(255, 226, 190, ${a.toFixed(3)})` : `rgba(226, 232, 255, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(e.x * w, e.y * h, e.tam, 0, TAU);
    ctx.fill();
  }
}

/** Grade e eixos do plano cartesiano das miniaturas de Matemática e de vetores. */
function grade(ctx: CanvasRenderingContext2D, w: number, h: number, u: number, ox: number, oy: number, k: Tinta) {
  ctx.strokeStyle = alfa(k.line, 0.6);
  ctx.lineWidth = 1;
  for (let x = ox % u; x < w; x += u) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = oy % u; y < h; y += u) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  linha(ctx, [[0, oy], [w, oy]], k.muted, 1.3);
  linha(ctx, [[ox, 0], [ox, h]], k.muted, 1.3);
}

/** Onda triangular em [0, 1]: posição de quem quica entre duas paredes. */
const quica = (x: number) => {
  const m = ((x % 2) + 2) % 2;
  return m < 1 ? m : 2 - m;
};

const DESENHOS: Record<string, Desenho> = {
  // Lancamento.tsx: grade, chão em nat, trajetória do vácuo tracejada, rastro
  // em brand, bola fg com miolo surface e as setas vx (mat), vy (hum) e v (fg).
  'lancamento-obliquo'(ctx, w, h, t, k) {
    trajeto ??= simularLancamento({ v0: 22, anguloGraus: 42, h0: 0, g: 9.81, k: 0.0135 }, 0.01);
    trajetoVacuo ??= simularLancamento({ v0: 22, anguloGraus: 42, h0: 0, g: 9.81, k: 0 }, 0.01);
    const xMax = trajetoVacuo.alcance * 1.06;
    const esc = Math.min((w - 24) / xMax, (h - 34) / (trajetoVacuo.alturaMax * 1.15));
    const X = (x: number) => 12 + x * esc;
    const Y = (y: number) => h - 16 - y * esc;
    for (let i = 1; i <= 3; i++) {
      const y = Y(0) - (i * (Y(0) - 8)) / 3;
      linha(ctx, [[0, y], [w, y]], alfa(k.line, 0.7), 1);
    }
    ctx.fillStyle = alfa(k.nat, 0.18);
    ctx.fillRect(0, Y(0), w, h - Y(0));
    linha(ctx, [[0, Y(0)], [w, Y(0)]], k.nat, 2);
    linha(ctx, trajetoVacuo.pontos.map((p) => [X(p.x), Y(p.y)]), alfa(k.muted, 0.8), 1.2, [5, 5]);
    const tf = fase(t, trajeto.tempoVoo + 0.8) * (trajeto.tempoVoo + 0.8);
    const feitos = trajeto.pontos.filter((p) => p.t <= tf);
    linha(ctx, feitos.map((p) => [X(p.x), Y(p.y)]), k.brand, 2.2);
    const p = feitos[feitos.length - 1];
    const ev = esc * 0.32;
    const bx = X(p.x);
    const by = Y(p.y);
    seta(ctx, bx, by, bx + p.vx * ev, by, alfa(k.mat, 0.9), 1.8);
    seta(ctx, bx, by, bx, by - p.vy * ev, alfa(k.hum, 0.9), 1.8);
    seta(ctx, bx, by, bx + p.vx * ev, by - p.vy * ev, k.fg, 2);
    bola(ctx, bx, by, 5, k.fg);
    bola(ctx, bx, by, 2.2, k.surface);
  },

  // Pendulo.tsx: suporte muted, vertical tracejada, arco em brand, massa
  // brand com reflexo e as barras de energia Ec (mat), Ep (hum) e Em (nat).
  pendulo(ctx, w, h, t, k) {
    const ox = w * 0.58;
    const oy = h * 0.14;
    const L = h * 0.66;
    const th0 = 0.62;
    const th = th0 * Math.cos((TAU * t) / 2.2);
    ctx.fillStyle = k.muted;
    ctx.fillRect(ox - 30, oy - 4, 60, 4);
    linha(ctx, [[ox, oy], [ox, oy + L + 10]], alfa(k.muted, 0.6), 1, [4, 4]);
    ctx.strokeStyle = alfa(k.brand, 0.25);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ox, oy, L, Math.PI / 2 - th0, Math.PI / 2 + th0);
    ctx.stroke();
    const bx = ox + L * Math.sin(th);
    const by = oy + L * Math.cos(th);
    linha(ctx, [[ox, oy], [bx, by]], k.fg, 1.4);
    massa(ctx, bx, by, 9, k.brand, k);
    // Ep cresce com a altura, Ec é o resto e Em fica constante.
    const ep = (1 - Math.cos(th)) / (1 - Math.cos(th0));
    const barras: [number, string][] = [[1 - ep, k.mat], [ep, k.hum], [1, k.nat]];
    const bh = h * 0.5;
    const base = h - 12;
    barras.forEach(([v, cor], i) => {
      const x = 12 + i * 11;
      ctx.fillStyle = alfa(cor, 0.15);
      ctx.fillRect(x, base - bh, 8, bh);
      ctx.fillStyle = cor;
      ctx.fillRect(x, base - bh * v, 8, bh * v);
    });
  },

  // MassaMola.tsx: trilho muted, parede, mola fg, bloco brand e a força
  // elástica (mat) sobre o bloco.
  'massa-mola'(ctx, w, h, t, k) {
    const tt = fase(t, 7) * 7;
    const x = Math.exp(-0.18 * tt) * Math.cos(TAU * 0.9 * tt);
    const y = h * 0.66;
    const lado = Math.min(36, h * 0.28);
    const eqx = w * 0.56;
    const bx = eqx + x * w * 0.22;
    ctx.fillStyle = alfa(k.muted, 0.35);
    ctx.fillRect(0, y, w, 4);
    ctx.fillStyle = k.muted;
    ctx.fillRect(12, y - lado - 22, 5, lado + 22);
    linha(ctx, [[eqx, y + 8], [eqx, y + 16]], alfa(k.muted, 0.7), 1.5);
    const pts: [number, number][] = [[17, y - lado / 2]];
    const n = 12;
    const fim = bx - lado / 2;
    for (let i = 0; i <= n; i++) pts.push([24 + ((fim - 30) * i) / n, y - lado / 2 + (i === 0 || i === n ? 0 : i % 2 ? -8 : 8)]);
    pts.push([fim, y - lado / 2]);
    linha(ctx, pts, k.fg, 1.5);
    ctx.fillStyle = k.brand;
    ctx.beginPath();
    ctx.roundRect(bx - lado / 2, y - lado, lado, lado, 6);
    ctx.fill();
    seta(ctx, bx, y - lado - 10, bx - x * w * 0.16, y - lado - 10, k.mat, 2);
  },

  // PlanoInclinado.tsx: rampa muted, bloco brand, P (fg), N (mat), atrito
  // (danger) e as componentes Px e Py (hum).
  'plano-inclinado'(ctx, w, h, t, k) {
    const base = w * 0.78;
    const x0 = (w - base) / 2;
    const yc = h * 0.86;
    const alto = Math.min(base * Math.tan(0.5), h * 0.68);
    ctx.fillStyle = alfa(k.muted, 0.22);
    ctx.beginPath(); ctx.moveTo(x0, yc); ctx.lineTo(x0 + base, yc); ctx.lineTo(x0, yc - alto); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = k.muted; ctx.lineWidth = 2; ctx.stroke();
    linha(ctx, [[0, yc], [w, yc]], k.line, 1.5);
    const ang = Math.atan2(alto, base);
    const L = Math.hypot(base, alto);
    const f = Math.min(1, (fase(t, 2.6) * 2.6) ** 2 / 2.2);
    const d = 28 + f * (L - 70);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const nx = uy;
    const ny = -ux;
    const sx = x0 + ux * d;
    const sy = yc - alto + uy * d;
    const cx = sx + nx * 13;
    const cy = sy + ny * 13;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = k.brand;
    ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 4); ctx.fill();
    ctx.restore();
    const e = 30;
    seta(ctx, cx, cy, cx, cy + e, k.fg, 2);
    seta(ctx, cx, cy, cx + ux * e * Math.sin(ang), cy + uy * e * Math.sin(ang), alfa(k.hum, 0.95), 1.6);
    seta(ctx, cx, cy, cx - nx * e * Math.cos(ang), cy - ny * e * Math.cos(ang), alfa(k.hum, 0.95), 1.6);
    seta(ctx, sx, sy, sx + nx * e * Math.cos(ang), sy + ny * e * Math.cos(ang), k.mat, 2);
    seta(ctx, sx - ux * 4, sy - uy * 4, sx - ux * 22, sy - uy * 22, k.danger, 2);
  },

  // Empuxo.tsx: água azul, tanque muted, bloco de cortiça com contorno fg,
  // P (fg) e E (mat).
  empuxo(ctx, w, h, t, k) {
    const sup = h * 0.36;
    const tx = w * 0.18;
    const tw = w * 0.64;
    ctx.fillStyle = alfa(AGUA, k.escuro ? 0.35 : 0.28);
    ctx.fillRect(tx, sup, tw, h - 10 - sup);
    linha(ctx, [[tx, sup], [tx + tw, sup]], alfa(AGUA, 0.9), 2);
    linha(ctx, [[tx, sup - 30], [tx, h - 10], [tx + tw, h - 10], [tx + tw, sup - 30]], k.muted, 2);
    const tt = fase(t, 6) * 6;
    const lado = h * 0.28;
    const eq = 0.45 * lado;
    const base = sup + eq + (-lado * 1.2 - eq) * Math.exp(-0.7 * tt) * Math.cos(3.2 * tt);
    const bx = w / 2 - lado / 2;
    ctx.fillStyle = CORTICA;
    ctx.fillRect(bx, base - lado, lado, lado);
    const sub = Math.max(0, Math.min(lado, base - sup));
    ctx.fillStyle = alfa(AGUA, 0.35);
    ctx.fillRect(bx, base - sub, lado, sub);
    ctx.strokeStyle = k.fg;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(bx, base - lado, lado, lado);
    const yc = base - lado / 2;
    seta(ctx, w / 2 - 6, yc, w / 2 - 6, yc + lado * 0.9, k.fg, 2);
    if (sub > 1) seta(ctx, w / 2 + 6, yc, w / 2 + 6, yc - (sub / eq) * lado * 0.9, k.mat, 2);
  },

  // Circuitos.tsx: três lâmpadas em série no laço, fios muted, pilha sobre
  // surface e as cargas andando em hum.
  circuitos(ctx, w, h, t, k) {
    const x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.16, y1 = h * 0.84;
    const laco: [number, number][] = [[x0, h / 2], [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, h / 2]];
    linha(ctx, laco, k.muted, 2);
    const per = comprimento(laco);
    for (let s = (t * 30) % 22; s < per; s += 22) {
      const p = aoLongo(laco, s);
      if (p) bola(ctx, p[0], p[1], 2, k.hum);
    }
    ctx.fillStyle = k.surface;
    ctx.fillRect(x0 - 12, h / 2 - 9, 24, 18);
    linha(ctx, [[x0 - 11, h / 2 - 4], [x0 + 11, h / 2 - 4]], k.fg, 2);
    linha(ctx, [[x0 - 5, h / 2 + 4], [x0 + 5, h / 2 + 4]], k.fg, 4);
    const lamps: [number, number][] = [[w / 2, y0], [x1, h / 2], [w / 2, y1]];
    lamps.forEach(([x, y]) => {
      brilho(ctx, x, y, 26, '#ffd666', 0.85);
      bola(ctx, x, y, 8, 'rgb(255, 240, 200)');
      ctx.strokeStyle = k.fg; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke();
      linha(ctx, [[x - 4, y + 3], [x - 2, y - 3], [x, y + 1], [x + 2, y - 3], [x + 4, y + 3]], alfa('#7c2d12', 0.9), 1.2);
    });
  },

  // Refracao.tsx: água em cima, ar embaixo, normal tracejada e o laser
  // vermelho, com o brilho de cada raio pela intensidade de Fresnel.
  refracao(ctx, w, h, t, k) {
    const cx = w / 2;
    const cy = h * 0.5;
    ctx.fillStyle = alfa(AGUA, 0.2);
    ctx.fillRect(0, 0, w, cy);
    ctx.fillStyle = alfa('#94a3b8', 0.06);
    ctx.fillRect(0, cy, w, h - cy);
    linha(ctx, [[0, cy], [w, cy]], k.muted, 1.2);
    linha(ctx, [[cx, 4], [cx, h - 4]], alfa(k.fg, 0.5), 1, [4, 4]);
    // Da água para o ar: o ângulo varre e passa do limite (48,6°).
    const ang = 30 + 28 * (0.5 - 0.5 * Math.cos((TAU * t) / 5));
    const r = refratar(1.333, 1.000293, ang);
    const a = (ang * Math.PI) / 180;
    const R = Math.hypot(w, h);
    const raio = (x: number, y: number, op: number) => linha(ctx, [[cx, cy], [x, y]], alfa(LASER, Math.min(1, 0.12 + op)), 2.2);
    const fx = cx - Math.sin(a) * h * 0.42;
    const fy = cy - Math.cos(a) * h * 0.42;
    raio(fx, fy, 1);
    raio(cx + Math.sin(a) * R, cy - Math.cos(a) * R, r.R);
    if (r.refratadoGraus !== null) {
      const b = (r.refratadoGraus * Math.PI) / 180;
      raio(cx + Math.sin(b) * R, cy + Math.cos(b) * R, r.T);
    }
    // A caneta laser.
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.atan2(cy - fy, cx - fx));
    ctx.fillStyle = k.fg;
    ctx.fillRect(-16, -3.5, 16, 7);
    ctx.restore();
  },

  // Lentes.tsx: eixo muted, lente em mat (seta dupla), focos fg, objeto fg,
  // imagem hum e os três raios principais em danger, nat e lin.
  'lentes-espelhos'(ctx, w, h, t, k) {
    const f = 1;
    const p = 1.4 + 1.4 * (0.5 - 0.5 * Math.cos((TAU * t) / 6));
    const im = formarImagem(f, p);
    const cx = w / 2;
    const cy = h * 0.52;
    const sx = w / 7;
    const ho = h * 0.24;
    linha(ctx, [[0, cy], [w, cy]], k.muted, 1);
    seta(ctx, cx, cy, cx, cy - h * 0.44, k.mat, 2);
    seta(ctx, cx, cy, cx, cy + h * 0.44, k.mat, 2);
    for (const s of [-1, 1]) bola(ctx, cx + s * f * sx, cy, 2.5, k.fg);
    const ox = cx - p * sx;
    const ix = cx + im.pLinha * sx;
    const iy = cy - im.aumento * ho;
    const oy = cy - ho;
    const ate = (x0: number, y0: number, x1: number, y1: number): [number, number] => [w, y0 + ((y1 - y0) / (x1 - x0)) * (w - x0)];
    linha(ctx, [[ox, oy], [cx, oy], ate(cx, oy, ix, iy)], k.danger, 1.4);
    linha(ctx, [[ox, oy], ate(ox, oy, cx, cy)], k.nat, 1.4);
    // O raio que passa pelo foco anterior sai paralelo ao eixo.
    const yl = cy + ((oy - cy) * f) / (f - p);
    linha(ctx, [[ox, oy], [cx, yl], [w, yl]], k.lin, 1.4);
    seta(ctx, ox, cy, ox, oy, k.fg, 3);
    seta(ctx, ix, cy, ix, iy, k.hum, 3);
  },

  // Doppler.tsx: pista em muted, frentes de onda em brand, ambulância fg
  // com a sirene alternando danger e mat, e você (nat) na calçada.
  doppler(ctx, w, h, t, k) {
    const vs = 0.45;
    const tt = fase(t, 6) * 6; // a fonte atravessa a janela e some só no fim do ciclo
    const esc = w / 2.6;
    const yp = h * 0.46;
    ctx.fillStyle = alfa(k.muted, 0.15);
    ctx.fillRect(0, yp - 9, w, 18);
    ctx.lineWidth = 1.3;
    for (const fr of frentesDeOnda(2.2, 1, vs, tt, -0.2)) {
      const r = fr.r * esc;
      if (r > w * 1.4) continue;
      ctx.strokeStyle = alfa(k.brand, Math.max(0.12, 0.9 - fr.r * 0.35));
      ctx.beginPath(); ctx.arc(fr.cx * esc, yp, r, 0, TAU); ctx.stroke();
    }
    const xs = (-0.2 + vs * tt) * esc;
    ctx.fillStyle = k.fg;
    ctx.beginPath(); ctx.roundRect(xs - 11, yp - 6, 22, 12, 3); ctx.fill();
    ctx.fillStyle = Math.floor(t / 0.2) % 2 ? k.danger : k.mat;
    ctx.fillRect(xs - 3, yp - 9, 6, 3);
    const ox = w * 0.82;
    const oy = h * 0.78;
    bola(ctx, ox, oy - 7, 3.5, k.nat);
    ctx.fillStyle = k.nat;
    ctx.beginPath(); ctx.roundRect(ox - 3.5, oy - 3, 7, 10, 2); ctx.fill();
  },

  // Orbitas.tsx (3D, plano visto de cima e inclinado): o céu estrelado, Sol amarelo com halo,
  // a órbita da Terra, a trajetória da sonda em rosa e os setores de mesmo
  // tempo em azul e rosa alternados.
  orbitas(ctx, w, h, t) {
    ceu(ctx, w, h, t);
    const e = 0.55;
    const a = Math.min(w * 0.36, h * 0.62);
    const b = a * Math.sqrt(1 - e * e) * 0.72; // a câmera inclinada achata o plano
    const sx = w / 2 + a * e * 0.5;
    const sy = h / 2;
    const cxE = sx - a * e;
    const pos = (M: number): [number, number] => {
      const E = resolverKepler(M, e);
      return [cxE + a * Math.cos(E), sy + b * Math.sin(E)];
    };
    ctx.strokeStyle = alfa('#4f8fe8', 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(sx, sy, a * 0.42, a * 0.42 * 0.72, 0, 0, TAU); ctx.stroke();
    const setores = 8;
    for (let s = 0; s < setores; s++) {
      ctx.fillStyle = s % 2 ? 'rgba(242, 115, 140, 0.28)' : 'rgba(102, 153, 255, 0.28)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let i = 0; i <= 12; i++) ctx.lineTo(...pos((TAU * (s + i / 12)) / setores));
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cxE, sy, a, b, 0, 0, TAU); ctx.stroke();
    bola(ctx, sx, sy, 16, alfa(SOL_HALO, 0.15));
    bola(ctx, sx, sy, 7, SOL);
    const [px, py] = pos((TAU * t) / 4);
    brilho(ctx, px, py, 9, PINK, 0.7);
    bola(ctx, px, py, 3.5, '#f8fafc');
  },

  // CampoMagnetico.tsx (3D): grade no chão, linhas de campo claras com
  // setas, a hélice do próton em rosa, a velocidade (nat) e a força (hum).
  'campo-magnetico'(ctx, w, h, t, k) {
    const chao = h * 0.84;
    ctx.strokeStyle = alfa(k.muted, 0.25);
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.07, chao - 14); ctx.lineTo(w / 2 + i * w * 0.11, chao + 14); ctx.stroke();
    }
    for (let j = 0; j <= 2; j++) {
      const meia = w * (0.28 + j * 0.08);
      ctx.beginPath(); ctx.moveTo(w / 2 - meia, chao - 14 + j * 14); ctx.lineTo(w / 2 + meia, chao - 14 + j * 14); ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const x = w * (0.12 + i * 0.127);
      const topo = x + (x - w / 2) * 0.08;
      linha(ctx, [[x, chao - 10 + (i % 2) * 14], [topo, 12]], alfa(k.fg, 0.4), 1);
      seta(ctx, x + (x - w / 2) * 0.07, 30, topo, 10, alfa(k.fg, 0.55), 1.2);
    }
    const R = Math.min(w * 0.2, h * 0.22);
    const passo = h * 0.13; // 4,2 voltas no ciclo: a hélice cabe na altura
    const tt = fase(t, 6) * 6;
    const pts: { x: number; y: number; z: number; a: number }[] = [];
    for (let s = 0; s <= tt * 60; s++) {
      const ang = (s / 60) * TAU * 0.7;
      pts.push({ x: w / 2 + R * Math.cos(ang), y: chao - 22 - (passo * ang) / TAU - R * 0.3 * Math.sin(ang), z: Math.sin(ang), a: ang });
    }
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = alfa(PINK, 0.45 + 0.55 * (pts[i].z * 0.5 + 0.5));
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    const u = pts[pts.length - 1];
    if (u) {
      // Velocidade tangente ao círculo; a força aponta para o centro.
      seta(ctx, u.x, u.y, u.x - Math.sin(u.a) * 20, u.y - Math.cos(u.a) * 6 - 4, k.nat, 1.8);
      seta(ctx, u.x, u.y, u.x - Math.cos(u.a) * 18, u.y + Math.sin(u.a) * 5, k.hum, 1.8);
      brilho(ctx, u.x, u.y, 10, PINK, 0.6);
      massa(ctx, u.x, u.y, 4.5, PINK, k);
    }
  },

  // Gases.tsx: caixa com contorno fg, êmbolo muted e as moléculas na escala
  // de velocidade (azul lenta, vermelha rápida).
  gases(ctx, w, h, t, k) {
    const px = w * (0.76 + 0.08 * Math.sin((TAU * t) / 6));
    ctx.strokeStyle = k.fg;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, 10, px - 10, h - 20);
    ctx.fillStyle = k.muted;
    ctx.fillRect(px, 6, 6, h - 12);
    linha(ctx, [[px + 6, h / 2], [w, h / 2]], k.muted, 4);
    for (const m of gas) {
      const x = 14 + quica(m.x + m.vx * t * 0.5) * (px - 28);
      const y = 14 + quica(m.y + m.vy * t * 0.5) * (h - 28);
      const v = Math.min(1, Math.hypot(m.vx, m.vy) / 0.55);
      bola(ctx, x, y, 2.4, `hsl(${220 - 220 * v}, 85%, ${k.escuro ? 62 : 48}%)`);
    }
  },

  // Titulacao.tsx: bureta com o titulante (mat), torneira em nat gotejando,
  // erlenmeyer na cor da fenolftaleína e o visor de pH.
  titulacao(ctx, w, h, t, k) {
    const v = fase(t, 6);
    const pH = 2.9 + 1.9 * v + 5.5 / (1 + Math.exp(-(v - 0.5) * 42)) + 1.6 * Math.max(0, v - 0.52);
    const cx = w * 0.38;
    const bTopo = h * 0.06;
    const bAlt = h * 0.4;
    const bLarg = 12;
    ctx.strokeStyle = k.fg;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(cx - bLarg / 2, bTopo, bLarg, bAlt);
    ctx.fillStyle = alfa(k.mat, 0.25);
    const nivel = (1 - v * 0.8) * bAlt;
    ctx.fillRect(cx - bLarg / 2 + 1.5, bTopo + bAlt - nivel, bLarg - 3, nivel);
    for (let i = 1; i < 5; i++) linha(ctx, [[cx + bLarg / 2, bTopo + (i * bAlt) / 5], [cx + bLarg / 2 + 4, bTopo + (i * bAlt) / 5]], k.fg, 1);
    linha(ctx, [[cx - 2, bTopo + bAlt], [cx - 1, bTopo + bAlt + 12], [cx + 1, bTopo + bAlt + 12], [cx + 2, bTopo + bAlt]], k.fg, 1.2);
    ctx.fillStyle = k.nat;
    ctx.fillRect(cx - 8, bTopo + bAlt + 3, 16, 4);
    const eBase = h - 10;
    const eTopo = h * 0.6;
    const eLarg = Math.min(w * 0.36, 90);
    // Líquido até perto da metade do cone, na cor do indicador.
    const nl = eBase - (eBase - eTopo) * 0.42;
    const meia = (eLarg / 2) * ((nl - eTopo - 10) / (eBase - eTopo - 10));
    const rosa = 1 / (1 + 10 ** (9.3 - pH));
    ctx.beginPath(); ctx.moveTo(cx - meia, nl); ctx.lineTo(cx - eLarg / 2, eBase); ctx.lineTo(cx + eLarg / 2, eBase); ctx.lineTo(cx + meia, nl); ctx.closePath();
    ctx.fillStyle = alfa(k.mat, 0.08);
    ctx.fill();
    ctx.fillStyle = `rgba(219, 39, 119, ${(0.85 * rosa).toFixed(3)})`;
    ctx.fill();
    linha(ctx, [[cx - 7, eTopo], [cx - 7, eTopo + 10], [cx - eLarg / 2, eBase], [cx + eLarg / 2, eBase], [cx + 7, eTopo + 10], [cx + 7, eTopo]], k.fg, 1.5);
    const gota = bTopo + bAlt + 14 + ((t * 70) % Math.max(1, eTopo - bTopo - bAlt - 6));
    bola(ctx, cx, gota, 2, alfa(k.mat, 0.7));
    // Visor de pH, como o da simulação.
    const vx = w * 0.62;
    const vy = h * 0.5;
    ctx.fillStyle = k.surface;
    ctx.strokeStyle = k.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(vx, vy - 18, 62, 34, 6); ctx.fill(); ctx.stroke();
    texto(ctx, 'pH', vx + 7, vy - 6, k.muted, { tamanho: 8 });
    texto(ctx, pH.toFixed(2).replace('.', ','), vx + 7, vy + 10, k.fg, { tamanho: 13, peso: 700, mono: true });
  },

  // Equilibrio.tsx: balão castanho pela absorção do NO₂ e o zoom molecular
  // sobre surface, com N₂O₄ em mat e NO₂ castanho.
  'equilibrio-quimico'(ctx, w, h, t, k) {
    const no2 = 0.5 + 0.5 * Math.sin((TAU * t) / 6);
    const cx = w * 0.27;
    const cy = h * 0.6;
    const R = Math.min(w * 0.19, h * 0.3);
    ctx.fillStyle = `rgba(176, 88, 28, ${(0.1 + 0.75 * no2).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = k.fg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2 + 0.3, -Math.PI / 2 - 0.3 + TAU); ctx.stroke();
    ctx.strokeRect(cx - R * 0.22, cy - R * 1.55, R * 0.44, R * 0.6);
    const zx = w * 0.54;
    const zw = w * 0.42;
    ctx.fillStyle = alfa(k.surface, 0.9);
    ctx.strokeStyle = k.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(zx, 8, zw, h - 16, 6); ctx.fill(); ctx.stroke();
    const r = criarRng(5);
    for (let i = 0; i < 24; i++) {
      const x = zx + 10 + quica(r() + (r() - 0.5) * t * 0.3) * (zw - 20);
      const y = 16 + quica(r() + (r() - 0.5) * t * 0.3) * (h - 32);
      if (r() < no2) {
        bola(ctx, x - 6, y, 2.6, NO2);
        bola(ctx, x + 6, y + 3, 2.6, NO2);
      } else {
        bola(ctx, x - 2.4, y, 2.6, k.mat);
        bola(ctx, x + 2.4, y, 2.6, k.mat);
      }
    }
  },

  // GeometriaMolecular.tsx (3D): a água, que é a molécula que abre, com os
  // átomos nas cores CPK, ligações cinza e os pares isolados em lilás.
  'geometria-molecular'(ctx, w, h, t, k) {
    const ang = t * 0.8;
    const c = Math.cos(ang), s = Math.sin(ang);
    const esc = Math.min(w * 0.7, h) / 200;
    const proj = (p: readonly number[]) => {
      const x = p[0] * c + p[1] * s;
      const z = -p[0] * s + p[1] * c;
      const y = p[2] * 0.95 + z * 0.15;
      return { x: w / 2 + x * esc, y: h / 2 + 8 - y * esc, z };
    };
    const centro = proj([0, 0, 0]);
    for (const par of agua.pares) {
      const q = proj(par.map((v) => v * 62));
      const rot = Math.atan2(q.y - centro.y, q.x - centro.x);
      ctx.fillStyle = 'rgba(172, 139, 245, 0.32)';
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 19, 11, rot, 0, TAU); ctx.fill();
      for (const d of [-1, 1]) bola(ctx, q.x - Math.sin(rot) * 3 * d, q.y + Math.cos(rot) * 3 * d, 1.8, '#7651ba');
    }
    const at = agua.atomos.map((a) => ({ el: a.el, ...proj(a.pos) }));
    for (let i = 1; i < at.length; i++) linha(ctx, [[at[0].x, at[0].y], [at[i].x, at[i].y]], '#9aa3b2', 5);
    [...at].sort((a, b) => a.z - b.z).forEach((a) => {
      const r = (a.el === 'H' ? 10 : 15) * (1 + a.z / 900);
      const g = ctx.createRadialGradient(a.x - r / 3, a.y - r / 3, 1, a.x, a.y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, COR_ATOMO[a.el]);
      bola(ctx, a.x, a.y, r, g);
      // Contorno: o hidrogênio é branco e sumiria no fundo claro.
      ctx.strokeStyle = alfa(k.fg, k.escuro ? 0.12 : 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  },

  // Pilha.tsx: béqueres com contorno fg (Zn²⁺ incolor, Cu²⁺ azul), placas de
  // zinco e cobre, ponte salina, voltímetro e os elétrons em hum.
  pilha(ctx, w, h, t, k) {
    const bw = w * 0.3;
    const xs = [w * 0.24, w * 0.76];
    const by = h * 0.48;
    const pTopo = by - 8;
    linha(ctx, [[xs[0] + bw * 0.18, h - 26], [xs[0] + bw * 0.18, pTopo], [xs[1] - bw * 0.18, pTopo], [xs[1] - bw * 0.18, h - 26]], alfa(k.muted, 0.9), 7);
    const placas: number[] = [];
    xs.forEach((x, i) => {
      ctx.fillStyle = i ? alfa(CU2, 0.5) : alfa(k.mat, 0.08);
      ctx.fillRect(x - bw / 2, by + 6, bw, h - by - 16);
      linha(ctx, [[x - bw / 2, by], [x - bw / 2, h - 10], [x + bw / 2, h - 10], [x + bw / 2, by]], k.fg, 1.4);
      const px = x + (i ? 1 : -1) * bw * 0.24;
      placas.push(px);
      ctx.fillStyle = i ? COBRE : ZINCO;
      ctx.fillRect(px - 4, by - 12, 8, h - by - 12);
      ctx.strokeStyle = k.fg; ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, by - 12, 8, h - by - 12);
    });
    const yFio = h * 0.14;
    const fio: [number, number][] = [[placas[0], by - 12], [placas[0], yFio], [placas[1], yFio], [placas[1], by - 12]];
    linha(ctx, fio, k.fg, 1.6);
    const per = comprimento(fio);
    for (let d = (t * 30) % 22; d < per; d += 22) {
      const p = aoLongo(fio, d);
      if (p && !(Math.abs(p[0] - w / 2) < 30 && Math.abs(p[1] - yFio) < 14)) bola(ctx, p[0], p[1], 2.2, k.hum);
    }
    // Ânions da ponte vão para o ânodo, cátions para o cátodo.
    const comp = xs[1] - xs[0] - bw * 0.44;
    for (let j = 0; j < 3; j++) {
      const f = (t * 0.3 + j / 3) % 1;
      bola(ctx, xs[1] - bw * 0.22 - f * comp, pTopo - 2, 1.8, k.mat);
      bola(ctx, xs[0] + bw * 0.22 + f * comp, pTopo + 2, 1.8, k.danger);
    }
    ctx.fillStyle = k.surface;
    ctx.strokeStyle = k.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(w / 2 - 28, yFio - 11, 56, 22, 5); ctx.fill(); ctx.stroke();
    texto(ctx, '1,10 V', w / 2, yFio + 4, k.fg, { alinhar: 'center', peso: 700, mono: true, tamanho: 11 });
  },

  // Decaimento.tsx: núcleos vivos em nat, decaídos em muted e o lampejo do
  // decaimento em hum.
  'decaimento-radioativo'(ctx, w, h, t, k) {
    const tt = fase(t, 7) * 5; // até 5 meias-vidas
    const cols = 16;
    const lins = 10;
    const tam = Math.min((w - 12) / cols, (h - 12) / lins);
    const ox = (w - tam * cols) / 2;
    const oy = (h - tam * lins) / 2;
    vidaNucleo.forEach((vida, i) => {
      const x = ox + (i % cols) * tam + tam / 2;
      const y = oy + Math.floor(i / cols) * tam + tam / 2;
      const idade = tt - vida;
      if (idade > 0 && idade < 0.3) bola(ctx, x, y, tam * (0.4 + idade * 1.2), alfa(k.hum, 0.55 * (1 - idade / 0.3)));
      bola(ctx, x, y, tam * 0.3, idade < 0 ? k.nat : alfa(k.muted, 0.35));
    });
  },

  // Hidrogenio.tsx: órbitas muted (a atual em brand), núcleo danger, elétron
  // mat, o fóton na cor real, o diagrama de níveis e a faixa do espectro.
  'atomo-hidrogenio'(ctx, w, h, t, k) {
    const cx = w * 0.28;
    const cy = h * 0.44;
    const raio = (n: number) => n * Math.min(w * 0.6, h) * 0.085;
    const f = fase(t, 3.2);
    const n = f < 0.45 ? 3 : 2;
    for (let m = 1; m <= 4; m++) {
      ctx.strokeStyle = m === n ? k.brand : alfa(k.muted, 0.5);
      ctx.lineWidth = m === n ? 1.6 : 1;
      ctx.beginPath(); ctx.arc(cx, cy, raio(m), 0, TAU); ctx.stroke();
    }
    bola(ctx, cx, cy, 4, k.danger);
    const a = t * (n === 3 ? 2 : 3.4);
    bola(ctx, cx + raio(n) * Math.cos(a), cy + raio(n) * Math.sin(a), 3.5, k.mat);
    // Níveis de energia (Eₙ ∝ −1/n²) à direita.
    const nx0 = w * 0.64;
    const nx1 = w - 12;
    const top = 12;
    const base = h - 30;
    const Y = (m: number) => top + (base - top) * (1 / (m * m));
    for (let m = 1; m <= 6; m++) linha(ctx, [[nx0, Y(m)], [nx1, Y(m)]], m === n ? k.brand : alfa(k.fg, 0.7), m === n ? 1.8 : 1);
    const [r, g, b] = corComprimento(comprimentoTransicao(3, 2));
    const cor = `rgb(${r}, ${g}, ${b})`;
    if (f >= 0.45) {
      seta(ctx, (nx0 + nx1) / 2, Y(3), (nx0 + nx1) / 2, Y(2), cor, 1.8);
      const d = (f - 0.45) * w * 0.5;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const x = cx + raio(4) + 4 + d + i * 1.5;
        const y = cy + Math.sin(i * 0.8) * 4;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    const sy = h - 18;
    ctx.fillStyle = '#05050a';
    ctx.fillRect(10, sy, w - 20, 10);
    for (const nSup of [3, 4, 5, 6]) {
      const nm = comprimentoTransicao(nSup, 2);
      const [cr, cg, cb] = corComprimento(nm);
      ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
      ctx.fillRect(10 + ((nm - 380) / 370) * (w - 20) - 1, sy, 2.5, 10);
    }
  },

  // PredadorPresa.tsx: o campo (nat 0,1) com lebres em mat e linces em hum,
  // na quantidade que o modelo de Lotka-Volterra dá a cada instante.
  'predador-presa'(ctx, w, h, t, k) {
    if (!populacoes) {
      populacoes = [];
      let s = [30, 4];
      for (let i = 0; i < 400; i++) {
        populacoes.push([s[0], s[1]]);
        s = avancar(derivadaPopulacao(LEBRE_LINCE), 0, s, 0.1, 0.02).y;
      }
    }
    const [lebres, linces] = populacoes[Math.floor((t * 6) % 400)];
    ctx.fillStyle = alfa(k.nat, 0.1);
    ctx.fillRect(0, 0, w, h);
    const pos = (i: number, vel: number) => {
      const b = bichos[i];
      return [8 + quica(b.x + b.vx * t * vel) * (w - 16), 12 + quica(b.y + b.vy * t * vel) * (h - 20)];
    };
    for (let i = 0; i < Math.min(40, Math.round(lebres / 2)); i++) {
      const [x, y] = pos(i, 0.08);
      ctx.fillStyle = k.mat;
      ctx.beginPath(); ctx.ellipse(x, y, 4, 3.2, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 1, y - 5, 1.1, 2.8, 0.2, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < Math.min(20, Math.round(linces / 0.8)); i++) {
      const [x, y] = pos(40 + i, 0.12);
      ctx.fillStyle = k.hum;
      ctx.beginPath(); ctx.ellipse(x, y, 6.5, 4.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x + 5, y - 8); ctx.lineTo(x + 7, y - 3); ctx.fill();
    }
  },

  // Genetica.tsx: a população 1 como besouros, um por indivíduo, nas cores
  // dos genótipos AA, Aa e aa; a cada geração a deriva sorteia de novo.
  'genetica-populacoes'(ctx, w, h, t) {
    if (!deriva) {
      const r = criarRng(42);
      deriva = [0.5];
      for (let g = 0; g < 60; g++) deriva.push(proximaGeracao(deriva[g], 18, NEUTRO, r));
    }
    const g = Math.floor(t * 1.2) % deriva.length;
    const p = deriva[g];
    const r = criarRng(1000 + g);
    const N = 40;
    const cols = 10;
    const lins = N / cols;
    const tam = Math.min((w - 16) / cols, (h - 12) / lins);
    const ox = (w - cols * tam) / 2;
    const oy = (h - lins * tam) / 2;
    for (let i = 0; i < N; i++) {
      const a1 = r() < p;
      const a2 = r() < p;
      const gen = a1 && a2 ? 'AA' : a1 || a2 ? 'Aa' : 'aa';
      const x = ox + (i % cols) * tam + tam / 2;
      const y = oy + Math.floor(i / cols) * tam + tam / 2;
      ctx.fillStyle = COR_GEN[gen];
      ctx.beginPath(); ctx.ellipse(x, y, tam * 0.3, tam * 0.38, 0, 0, TAU); ctx.fill();
      linha(ctx, [[x, y - tam * 0.38], [x, y + tam * 0.38]], 'rgba(0, 0, 0, 0.35)', 1);
    }
  },

  // Estacoes.tsx (3D, quase de cima): o céu estrelado, órbita cinza-azulada, Sol amarelo, a
  // Terra azul com o lado da noite e o eixo inclinado, e a cidade em rosa.
  'estacoes-do-ano'(ctx, w, h, t) {
    ceu(ctx, w, h, t);
    const cx = w / 2;
    const cy = h / 2;
    const ry = h * 0.36;
    const rx = Math.min(w * 0.4, ry / 0.8);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
    bola(ctx, cx, cy, 18, alfa(SOL_HALO, 0.15));
    bola(ctx, cx, cy, 11, SOL);
    const a = (TAU * t) / 8;
    const ex = cx + rx * Math.cos(a);
    const ey = cy + ry * Math.sin(a);
    const R = Math.min(w, h) * 0.075;
    const paraSol = Math.atan2(cy - ey, cx - ex);
    bola(ctx, ex, ey, R, '#2f6fb3');
    ctx.fillStyle = alfa('#000000', 0.45);
    ctx.beginPath(); ctx.arc(ex, ey, R, paraSol + Math.PI / 2, paraSol + (3 * Math.PI) / 2); ctx.fill();
    const inc = (23.44 * Math.PI) / 180;
    linha(ctx, [[ex - Math.sin(inc) * R * 1.6, ey + Math.cos(inc) * R * 1.6], [ex + Math.sin(inc) * R * 1.6, ey - Math.cos(inc) * R * 1.6]], '#e2e8f0', 1.5);
    bola(ctx, ex + Math.cos(paraSol) * R * 0.3, ey + R * 0.35, 2, PINK);
  },
  // LaboratorioCircuitos.tsx: pontos da bancada, fios muted, bateria com os
  // polos em danger e mat, lâmpadas acesas, chave, amperímetro em mat e as
  // cargas andando em hum.
  'laboratorio-circuitos'(ctx, w, h, t, k) {
    const cols = 6;
    const lins = 4;
    const passo = Math.min((w - 28) / (cols - 1), (h - 24) / (lins - 1));
    const ox = (w - passo * (cols - 1)) / 2;
    const oy = (h - passo * (lins - 1)) / 2;
    const P = (i: number, j: number): [number, number] => [ox + i * passo, oy + j * passo];
    for (let i = 0; i < cols; i++) for (let j = 0; j < lins; j++) bola(ctx, ...P(i, j), 1.6, alfa(k.muted, 0.35));
    const laco: [number, number][] = [P(0, 2), P(0, 1), P(0, 0.5), P(1, 0.5), P(2, 0.5), P(3, 0.5), P(4, 0.5), P(5, 0.5), P(5, 2.5), P(4, 2.5), P(3, 2.5), P(2, 2.5), P(1, 2.5), P(0, 2.5), P(0, 2)];
    linha(ctx, laco, k.muted, 2);
    const per = comprimento(laco);
    for (let s = (t * 26) % 16; s < per; s += 16) {
      const p = aoLongo(laco, s);
      if (p) bola(ctx, p[0], p[1], 1.8, k.hum);
    }
    // Bateria no lado esquerdo.
    const [bx, by] = P(0, 1.5);
    ctx.fillStyle = k.surface;
    ctx.fillRect(bx - 10, by - 7, 20, 14);
    linha(ctx, [[bx - 9, by - 3], [bx + 9, by - 3]], k.fg, 2);
    linha(ctx, [[bx - 4, by + 3], [bx + 4, by + 3]], k.fg, 4);
    texto(ctx, '+', bx + 12, by - 1, k.danger, { peso: 800, tamanho: 10 });
    // Duas lâmpadas no alto, a chave à direita e o amperímetro embaixo.
    for (const [x, y] of [P(1.5, 0.5), P(3.5, 0.5)]) {
      brilho(ctx, x, y, 22, '#ffd666', 0.8);
      bola(ctx, x, y, 7, 'rgb(255, 240, 200)');
      ctx.strokeStyle = k.fg; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.stroke();
    }
    const [cx, cy] = P(5, 1.5);
    ctx.fillStyle = k.surface;
    ctx.fillRect(cx - 5, cy - 12, 10, 24);
    bola(ctx, cx, cy - 9, 2.5, k.fg);
    bola(ctx, cx, cy + 9, 2.5, k.fg);
    linha(ctx, [[cx, cy + 9], [cx, cy - 9]], k.fg, 2);
    const [ax, ay] = P(2.5, 2.5);
    bola(ctx, ax, ay, 9, k.surface);
    ctx.strokeStyle = k.mat; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(ax, ay, 9, 0, TAU); ctx.stroke();
    texto(ctx, 'A', ax, ay + 4, k.mat, { alinhar: 'center', peso: 800, tamanho: 11 });
  },

  // Interferencia.tsx (3D, a cuba vista de cima): a água em azul pela altura
  // de cada ponto, as duas fontes em rosa, com a mesma conta da simulação.
  interferencia(ctx, w, h, t) {
    const p = { f: 2, v: 0.22, d: 0.3, fase: 0 };
    const cel = 5;
    const escala = 1 / Math.max(w, h * 1.4);
    const ref = envoltoria(p, 0, 0.35) || 1;
    for (let y = 0; y < h; y += cel) {
      for (let x = 0; x < w; x += cel) {
        const fx = (x + cel / 2 - w / 2) * escala;
        const fy = (h - y - cel / 2) * escala;
        const a = Math.max(0, Math.min(1, 0.5 + (altura(p, fx, fy, t * 0.5) / ref) * 0.55));
        const r = Math.round(30 + (191 - 30) * a);
        const g = Math.round(58 + (219 - 58) * a);
        const b = Math.round(138 + (254 - 138) * a);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, cel + 0.5, cel + 0.5);
      }
    }
    for (const s of [-1, 1]) bola(ctx, w / 2 + (s * p.d) / 2 / escala, h - 3, 4.5, PINK);
  },

  // Cristais.tsx (3D): o cloreto de sódio, que é o cristal que abre, girando,
  // com Na⁺ lilás, Cl⁻ verde e a célula unitária em rosa.
  cristais(ctx, w, h, t) {
    const e = ESTRUTURAS.find((x) => x.key === 'nacl')!;
    nacl ??= gerarReticulo(e, 2);
    const ang = t * 0.5;
    const c = Math.cos(ang), s = Math.sin(ang);
    const esc = Math.min(w, h) * 0.32;
    const proj = (p: readonly number[]) => {
      const x = p[0] - 1, y = p[1] - 1, z = p[2] - 1;
      const xr = x * c + z * s;
      const zr = -x * s + z * c;
      return { x: w / 2 + xr * esc, y: h / 2 - (y * 0.9 + zr * 0.28) * esc, z: zr };
    };
    // Arestas da primeira célula.
    const v = [0, 1];
    for (const a of v) for (const b of v) {
      linha(ctx, [[proj([0, a, b]).x, proj([0, a, b]).y], [proj([1, a, b]).x, proj([1, a, b]).y]], PINK, 1.4);
      linha(ctx, [[proj([a, 0, b]).x, proj([a, 0, b]).y], [proj([a, 1, b]).x, proj([a, 1, b]).y]], PINK, 1.4);
      linha(ctx, [[proj([a, b, 0]).x, proj([a, b, 0]).y], [proj([a, b, 1]).x, proj([a, b, 1]).y]], PINK, 1.4);
    }
    nacl
      .map((at) => ({ ...proj(at.pos), esp: at.especie }))
      .sort((a, b) => a.z - b.z)
      .forEach((a) => {
        const r = (a.esp === 1 ? 5 : 3.4) * (1 + a.z * 0.08);
        const g = ctx.createRadialGradient(a.x - r / 3, a.y - r / 3, 0.5, a.x, a.y, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, e.especies[a.esp].cor);
        bola(ctx, a.x, a.y, r, g);
      });
  },

  // DNA.tsx (3D, deitada): a dupla hélice girando, esqueletos claros e os
  // degraus nas cores das bases (A verde, T vermelho, C azul, G laranja).
  dna(ctx, w, h, t) {
    const seq = 'ATGGCCAAATTTGGCTGGTAG';
    const COR: Record<string, string> = { A: '#22c55e', T: '#ef4444', C: '#3b82f6', G: '#f59e0b' };
    const PAR: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };
    const n = seq.length;
    const passo = (w - 24) / (n - 1);
    const R = Math.min(h * 0.3, 34);
    const giro = t * 0.9;
    const pontos = [...seq].map((b, i) => {
      const p = posicaoPar(i);
      const a1 = Math.atan2(p.fita1[2], p.fita1[0]) + giro;
      const a2 = Math.atan2(p.fita2[2], p.fita2[0]) + giro;
      return { b, x: 12 + i * passo, y1: h / 2 + R * Math.cos(a1), z1: Math.sin(a1), y2: h / 2 + R * Math.cos(a2), z2: Math.sin(a2) };
    });
    // Fita de trás primeiro.
    const fitas: [number, 'y1' | 'y2', 'z1' | 'z2', string][] = [[0, 'y1', 'z1', '#cbd5e1'], [1, 'y2', 'z2', '#94a3b8']];
    for (const p of pontos) {
      const meio = (p.y1 + p.y2) / 2;
      linha(ctx, [[p.x, p.y1], [p.x, meio]], COR[p.b], 3);
      linha(ctx, [[p.x, meio], [p.x, p.y2]], COR[PAR[p.b]], 3);
    }
    for (const [, y, z, cor] of fitas) {
      for (let i = 1; i < pontos.length; i++) {
        const a = pontos[i - 1];
        const b = pontos[i];
        linha(ctx, [[a.x, a[y]], [b.x, b[y]]], alfa(cor, 0.55 + 0.45 * ((a[z] + 1) / 2)), 3.5);
      }
      for (const p of pontos) bola(ctx, p.x, p[y], 2.6, alfa('#e2e8f0', 0.6 + 0.4 * ((p[z] + 1) / 2)));
    }
  },

  // FasesLua.tsx (3D, céu estrelado): a Terra, a órbita da Lua, a sombra da
  // Terra apontando para longe do Sol (à direita) e a Lua dando a volta.
  'fases-da-lua'(ctx, w, h, t) {
    ceu(ctx, w, h, t);
    const cx = w * 0.45;
    const cy = h / 2;
    const rx = Math.min(w * 0.3, h * 0.75);
    const ry = rx * 0.38;
    brilho(ctx, w - 4, cy, 34, SOL_HALO, 0.5);
    bola(ctx, w - 2, cy, 10, SOL);
    // Sombra (umbra) da Terra, do lado oposto ao Sol.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx - rx * 1.5, cy); ctx.lineTo(cx, cy + 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.08, 0, TAU); ctx.stroke();
    const e = elongacao(t * 3);
    const mx = cx + rx * Math.cos(e);
    const my = cy + ry * Math.sin(e);
    const atras = Math.sin(e) < 0;
    const terra = () => {
      bola(ctx, cx, cy, 9, '#2f6fb3');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath(); ctx.arc(cx, cy, 9, Math.PI / 2, (3 * Math.PI) / 2); ctx.fill();
    };
    const lua = () => {
      bola(ctx, mx, my, 4.5, '#d6d3d1');
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath(); ctx.arc(mx, my, 4.5, Math.PI / 2, (3 * Math.PI) / 2); ctx.fill();
    };
    if (atras) { lua(); terra(); } else { terra(); lua(); }
  },
  // Vetores.tsx: grade, a (mat) e b (hum) saindo da origem, o paralelogramo
  // tracejado e a resultante em danger.
  vetores(ctx, w, h, t, k) {
    const ox = w * 0.3;
    const oy = h * 0.75;
    const u = Math.min(w, h) / 7;
    grade(ctx, w, h, u, ox, oy, k);
    const a: [number, number] = [3.2, 0.6 + 0.4 * Math.sin(t * 0.8)];
    const b: [number, number] = [0.8 + 0.6 * Math.cos(t * 0.6), 2.6];
    const P = (v: [number, number]): [number, number] => [ox + v[0] * u, oy - v[1] * u];
    const s: [number, number] = [a[0] + b[0], a[1] + b[1]];
    linha(ctx, [P(a), P(s)], alfa(k.hum, 0.6), 1.2, [4, 4]);
    linha(ctx, [P(b), P(s)], alfa(k.mat, 0.6), 1.2, [4, 4]);
    seta(ctx, ...P([0, 0]), ...P(s), k.danger, 3);
    seta(ctx, ...P([0, 0]), ...P(a), k.mat, 2.5);
    seta(ctx, ...P([0, 0]), ...P(b), k.hum, 2.5);
  },

  // Isomeria.tsx (3D): o cis e o trans-but-2-eno lado a lado, girando, nas cores CPK.
  isomeria(ctx, w, h, t, k) {
    const par = PARES[0];
    const ang = t * 0.6;
    const c = Math.cos(ang), s = Math.sin(ang);
    const esc = Math.min(w / 8.5, h / 4.2);
    [par.a, par.b].forEach((m, idx) => {
      const ox = w * (idx ? 0.73 : 0.27);
      const pr = m.pos.map((p) => ({ x: ox + (p[0] * c + p[2] * s) * esc, y: h / 2 - p[1] * esc, z: -p[0] * s + p[2] * c }));
      for (const l of m.ligacoes) {
        if (l.ordem === 2) {
          linha(ctx, [[pr[l.a].x, pr[l.a].y - 2], [pr[l.b].x, pr[l.b].y - 2]], '#9aa3b2', 2.2);
          linha(ctx, [[pr[l.a].x, pr[l.a].y + 2], [pr[l.b].x, pr[l.b].y + 2]], '#9aa3b2', 2.2);
        } else linha(ctx, [[pr[l.a].x, pr[l.a].y], [pr[l.b].x, pr[l.b].y]], '#9aa3b2', 2.6);
      }
      pr.map((p, i) => ({ ...p, el: m.el[i] }))
        .sort((p, q) => p.z - q.z)
        .forEach((p) => {
          const r = (p.el === 'H' ? 0.24 : 0.36) * esc;
          const g = ctx.createRadialGradient(p.x - r / 3, p.y - r / 3, 0.5, p.x, p.y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, COR_ATOMO[p.el]);
          bola(ctx, p.x, p.y, r, g);
          ctx.strokeStyle = alfa(k.fg, k.escuro ? 0.12 : 0.3);
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      texto(ctx, idx ? 'trans' : 'cis', ox, h - 8, k.muted, { alinhar: 'center', tamanho: 11, peso: 600 });
    });
  },

  // Punnett.tsx: o quadro Aa × Aa com as ervilhas amarelas e verdes.
  punnett(ctx, w, h, t, k) {
    const L = Math.min((w - 40) / 3, (h - 16) / 3);
    const x0 = (w - 3 * L) / 2;
    const y0 = (h - 3 * L) / 2;
    const cab = ['A', 'a'];
    cab.forEach((g, i) => {
      texto(ctx, g, x0 + (i + 1.5) * L, y0 + L * 0.6, k.lin, { alinhar: 'center', tamanho: 14, peso: 800, mono: true });
      texto(ctx, g, x0 + L * 0.5, y0 + (i + 1.6) * L, k.mat, { alinhar: 'center', tamanho: 14, peso: 800, mono: true });
    });
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = x0 + (j + 1) * L;
        const y = y0 + (i + 1) * L;
        ctx.fillStyle = k.surface;
        ctx.strokeStyle = k.line;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x + 3, y + 3, L - 6, L - 6, 6); ctx.fill(); ctx.stroke();
        const verde = i === 1 && j === 1;
        const pulso = verde ? 1 + 0.08 * Math.sin(t * 3) : 1;
        const g = ctx.createRadialGradient(x + L * 0.42, y + L * 0.4, 1, x + L / 2, y + L / 2, L * 0.24 * pulso);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, verde ? '#65a30d' : '#facc15');
        bola(ctx, x + L / 2, y + L / 2, L * 0.24 * pulso, g);
      }
    }
  },

  // Funcoes.tsx: o plano com a parábola em mat, o vértice arrastável em brand e as raízes.
  funcoes(ctx, w, h, t, k) {
    const u = Math.min(w, h) / 9;
    const ox = w / 2;
    const oy = h * 0.62;
    grade(ctx, w, h, u, ox, oy, k);
    const a = 0.45 + 0.35 * Math.sin(t * 0.7);
    const hv = 0.8 * Math.sin(t * 0.45);
    const kv = -2;
    const f = (x: number) => a * (x - hv) ** 2 + kv;
    const pts: [number, number][] = [];
    for (let px = 0; px <= w; px += 3) {
      const x = (px - ox) / u;
      pts.push([px, oy - f(x) * u]);
    }
    linha(ctx, pts, k.mat, 2.6);
    const r = Math.sqrt(-kv / a);
    for (const x of [hv - r, hv + r]) bola(ctx, ox + x * u, oy, 3.5, k.danger);
    bola(ctx, ox + hv * u, oy - kv * u, 9, alfa(k.brand, 0.2));
    bola(ctx, ox + hv * u, oy - kv * u, 5, k.brand);
  },

  // CicloTrigonometrico.tsx: o círculo com o ponto girando, seno (mat) e cosseno (hum), e o gráfico do seno.
  'ciclo-trigonometrico'(ctx, w, h, t, k) {
    const R = Math.min(h * 0.36, w * 0.18);
    const cx = R + 18;
    const cy = h / 2;
    const ang = (t * 0.9) % (Math.PI * 2);
    linha(ctx, [[cx - R - 8, cy], [w - 10, cy]], k.muted, 1);
    linha(ctx, [[cx, cy - R - 8], [cx, cy + R + 8]], k.muted, 1);
    ctx.strokeStyle = alfa(k.fg, 0.7);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    const px = cx + Math.cos(ang) * R;
    const py = cy - Math.sin(ang) * R;
    linha(ctx, [[cx, cy], [px, py]], k.fg, 1.2);
    linha(ctx, [[cx, cy], [px, cy]], k.hum, 3.5);
    linha(ctx, [[cx, cy], [cx, py]], k.mat, 3.5);
    const gx0 = cx + R + 22;
    const gx1 = w - 10;
    const pts: [number, number][] = [];
    for (let a = 0; a <= ang; a += 0.05) pts.push([gx0 + ((gx1 - gx0) * a) / (Math.PI * 2), cy - Math.sin(a) * R]);
    linha(ctx, pts, k.mat, 2.2);
    linha(ctx, [[px, py], [gx0 + ((gx1 - gx0) * ang) / (Math.PI * 2), py]], alfa(k.mat, 0.5), 1, [2, 3]);
    bola(ctx, px, py, 5, k.brand);
  },

  // Triangulos.tsx: o triângulo com os ângulos, a circunferência inscrita (nat) e a circunscrita (hum).
  triangulos(ctx, w, h, t, k) {
    const esc = Math.min(w, h) / 9;
    const A: [number, number] = [-3, -2];
    const B: [number, number] = [3 + 0.6 * Math.sin(t * 0.6), -2];
    const C: [number, number] = [-0.5 + 1.2 * Math.sin(t * 0.4), 2.6];
    const P = (q: readonly [number, number]): [number, number] => [w / 2 + q[0] * esc, h / 2 - q[1] * esc + esc * 0.2];
    const tr = triangulo(A, B, C);
    ctx.fillStyle = alfa(k.brand, 0.1);
    ctx.beginPath(); ctx.moveTo(...P(A)); ctx.lineTo(...P(B)); ctx.lineTo(...P(C)); ctx.closePath(); ctx.fill();
    if (tr.circuncentro) {
      ctx.strokeStyle = alfa(k.hum, 0.75);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(...P(tr.circuncentro), tr.raioCircunscrito * esc, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = alfa(k.nat, 0.85);
    ctx.beginPath(); ctx.arc(...P(tr.incentro), tr.raioInscrito * esc, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = k.fg;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(...P(A)); ctx.lineTo(...P(B)); ctx.lineTo(...P(C)); ctx.closePath(); ctx.stroke();
    bola(ctx, ...P(tr.incentro), 3, k.nat);
    if (tr.circuncentro) bola(ctx, ...P(tr.circuncentro), 3, k.hum);
    for (const v of [A, B, C]) bola(ctx, ...P(v), 4.5, k.brand);
  },

  // Probabilidade.tsx: o histograma da soma de dois dados crescendo, a probabilidade em fg e os dois dados.
  probabilidade(ctx, w, h, t, k) {
    const d = distribuicaoSoma(2);
    const fase2 = Math.min(1, ((t % 8) / 8) * 1.4);
    const base = h - 14;
    const alto = h * 0.62;
    const bw = (w - 24) / 11;
    for (let s = 2; s <= 12; s++) {
      const x = 12 + (s - 2) * bw;
      const ruido = 1 + 0.25 * Math.sin(s * 7.3 + Math.floor(t * 2)) * (1 - fase2);
      const v = (d[s] / d[7]) * alto * fase2 * ruido;
      ctx.fillStyle = s === 7 ? k.brand : alfa(k.mat, 0.7);
      ctx.fillRect(x + bw * 0.12, base - v, bw * 0.76, v);
      linha(ctx, [[x + bw * 0.1, base - (d[s] / d[7]) * alto], [x + bw * 0.9, base - (d[s] / d[7]) * alto]], k.fg, 1.6);
    }
    for (const [i, face] of [[0, 3], [1, 4]] as const) {
      const L = Math.min(h * 0.2, 24);
      const x = w / 2 + (i - 0.5) * L * 1.5;
      ctx.fillStyle = k.surface;
      ctx.strokeStyle = k.fg;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x - L / 2, 6, L, L, 4); ctx.fill(); ctx.stroke();
      const pips = face === 3 ? [[-1, -1], [0, 0], [1, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [px, py] of pips) bola(ctx, x + px * L * 0.25, 6 + L / 2 + py * L * 0.25, L * 0.08, k.fg);
    }
  },

  // Projecoes.tsx (3D): um sólido de cubos azuis em perspectiva isométrica e as três vistas.
  'projecoes-ortograficas'(ctx, w, h, t, k) {
    const alturas = [[0, 1, 0], [2, 2, 1], [1, 0, 0]];
    const L = Math.min(w * 0.09, h * 0.13);
    const ox = w * 0.36;
    const oy = h * 0.62;
    const iso = (x: number, y: number, z: number): [number, number] => [ox + (x - z) * L * 0.87, oy + (x + z) * L * 0.5 - y * L];
    const face = (pts: [number, number][], cor: string) => {
      ctx.fillStyle = cor;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    for (let z = 0; z < 3; z++) {
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < alturas[z][x]; y++) {
          face([iso(x, y + 1, z), iso(x + 1, y + 1, z), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], '#93c5fd');
          face([iso(x, y, z + 1), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x, y + 1, z + 1)], '#669dfb');
          face([iso(x + 1, y, z), iso(x + 1, y, z + 1), iso(x + 1, y + 1, z + 1), iso(x + 1, y + 1, z)], '#3b6fd0');
        }
      }
    }
    // As três vistas em miniatura.
    const c = Math.max(4, Math.min(8, h / 18));
    const frente = [2, 2, 1];
    const lado = [1, 2, 1];
    const vx = w - 3 * c - 10;
    const desenha = (y0: number, cols: number[]) => cols.forEach((alt, i) => { for (let j = 0; j < 3; j++) { ctx.fillStyle = j < alt ? '#93c5fd' : alfa(k.muted, 0.15); ctx.fillRect(vx + i * c, y0 + (2 - j) * c, c - 1, c - 1); } });
    desenha(8, frente);
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) { ctx.fillStyle = alturas[z][x] ? '#93c5fd' : alfa(k.muted, 0.15); ctx.fillRect(vx + x * c, 8 + 3.5 * c + z * c, c - 1, c - 1); }
    desenha(8 + 7 * c, lado);
    void t;
  },

  // Planificacao.tsx (3D): o cubo abrindo e fechando com a dobra do modelo, em perspectiva isométrica.
  planificacao(ctx, w, h, t, k) {
    cubo ??= solido('cubo', { a: 1, b: 1, c: 1 }).rede;
    const aberta = 0.5 - 0.5 * Math.cos(t * 0.8);
    const faces = dobrar(cubo, aberta);
    const L = Math.min(w, h) * 0.2;
    const iso = (p: readonly number[]): [number, number, number] => [w / 2 + (p[0] - 0.5 - (p[2] - 0.5)) * L * 0.87, h * 0.55 + ((p[0] - 0.5) + (p[2] - 0.5)) * L * 0.5 - p[1] * L, p[0] + p[2] + p[1]];
    const cores = ['#669dfb', '#13b981', '#f59e3c', '#ac8bf5', '#f2587a', '#3fa7c4'];
    faces
      .map((f, i) => ({ pts: f.map(iso), i }))
      .sort((a, b) => a.pts.reduce((s, p) => s + p[2], 0) / a.pts.length - b.pts.reduce((s, p) => s + p[2], 0) / b.pts.length)
      .forEach(({ pts, i }) => {
        ctx.fillStyle = alfa(cores[i % 6], 0.88);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    void k;
  },

  // FusosHorarios.tsx (3D, céu estrelado): o globo com as faixas dos fusos girando e o lado da noite.
  'fusos-horarios'(ctx, w, h, t) {
    ceu(ctx, w, h, t);
    const R = Math.min(w, h) * 0.38;
    const cx = w / 2;
    const cy = h / 2;
    bola(ctx, cx, cy, R, '#1e3a8a');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const giro = (t * 12) % 360;
    for (let f = -12; f < 12; f++) {
      const l0 = ((f * 15 - 7.5 + giro + 540) % 360) - 180;
      const l1 = l0 + 15;
      if (l1 < -90 || l0 > 90) continue;
      const x0 = cx + R * Math.sin(Math.max(-90, l0) * (Math.PI / 180));
      const x1 = cx + R * Math.sin(Math.min(90, l1) * (Math.PI / 180));
      ctx.fillStyle = f % 2 === 0 ? 'rgba(147, 197, 253, 0.28)' : 'rgba(30, 64, 175, 0)';
      ctx.fillRect(x0, cy - R, x1 - x0, 2 * R);
      if (f === 0) {
        ctx.fillStyle = '#fcd34d';
        ctx.fillRect(cx + R * Math.sin(((l0 + l1) / 2) * (Math.PI / 180)) - 1, cy - R, 2, 2 * R);
      }
    }
    linha(ctx, [[cx - R, cy], [cx + R, cy]], 'rgba(255, 255, 255, 0.5)', 1);
    // Metade da noite à esquerda.
    const g = ctx.createLinearGradient(cx - R * 0.15, 0, cx + R * 0.15, 0);
    g.addColorStop(0, 'rgba(2, 6, 23, 0.7)');
    g.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - R, cy - R, 1.15 * R, 2 * R);
    ctx.restore();
    brilho(ctx, w - 4, cy, 30, SOL_HALO, 0.45);
    bola(ctx, w - 2, cy, 9, SOL);
  },
  // Atomo.tsx (modelo de Bohr do carbono-12 em 2D): núcleo de prótons e nêutrons e os elétrons nas camadas K e L.
  atomo(ctx, w, h, t, k) {
    const cx = w / 2;
    const cy = h / 2;
    const S = Math.min(w, h) / 2 - 8;
    const raios = [S * 0.45, S * 0.9];
    raios.forEach((r) => {
      ctx.strokeStyle = alfa(k.muted, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    });
    nucleoMini ??= nucleo(6, 6, 1);
    const rn = Math.min(9, S * 0.11) / (1.05 * Math.cbrt(12));
    const g = t * 0.3;
    nucleoMini
      .map((q) => ({ x: q.pos[0] * Math.cos(g) + q.pos[2] * Math.sin(g), y: q.pos[1], d: -q.pos[0] * Math.sin(g) + q.pos[2] * Math.cos(g), p: q.proton }))
      .sort((a, b) => a.d - b.d)
      .forEach((q) => {
        const gr = ctx.createRadialGradient(cx + q.x * rn - 1, cy - q.y * rn - 1, 0.3, cx + q.x * rn, cy - q.y * rn, rn);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, q.p ? '#ef4444' : '#9ca3af');
        bola(ctx, cx + q.x * rn, cy - q.y * rn, rn, gr);
      });
    [2, 4].forEach((n, i) => {
      for (let j = 0; j < n; j++) {
        const a = (TAU * j) / n + t * (1.4 / (i + 1));
        bola(ctx, cx + Math.cos(a) * raios[i], cy + Math.sin(a) * raios[i], 4, '#3b82f6');
      }
    });
  },

  // Ligacoes.tsx: o sódio passa um elétron para o cloro e os dois viram íons.
  ligacoes(ctx, w, h, t, k) {
    const f = Math.min(1, ((t % 4) / 4) * 1.6);
    const ida = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const y = h / 2;
    const xNa = w * 0.3;
    const xCl = w * 0.7;
    const at = (x: number, r: number, sim: string, cor: string) => {
      ctx.fillStyle = alfa(cor, 0.16);
      ctx.strokeStyle = alfa(k.fg, 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      texto(ctx, sim, x, y + 5, k.fg, { alinhar: 'center', tamanho: 15, peso: 800 });
    };
    const R = Math.min(26, h * 0.2);
    at(xNa, R * 0.85, ida >= 1 ? 'Na⁺' : 'Na', k.mat);
    at(xCl, R, ida >= 1 ? 'Cl⁻' : 'Cl', k.hum);
    const d = R + 7;
    const slots: [number, number][] = [[0, -d], [d, -4], [0, d], [-d, -4], [-5, -d], [d, 4], [5, d]];
    slots.forEach(([sx, sy]) => bola(ctx, xCl + sx, y + sy, 3, k.hum));
    const de: [number, number] = [xNa + R * 0.85 + 7, y];
    const para: [number, number] = [xCl - d, y + 4];
    bola(ctx, de[0] + (para[0] - de[0]) * ida, de[1] + (para[1] - de[1]) * ida - Math.sin(ida * Math.PI) * 22, 3.4, k.mat);
  },
  // Colisoes.tsx: dois carrinhos (mat e hum) se chocam e voltam, com as setas de velocidade.
  colisoes(ctx, w, h, t, k) {
    const chao = h * 0.68;
    ctx.fillStyle = alfa(k.muted, 0.35);
    ctx.fillRect(8, chao, w - 16, 4);
    const ciclo = (t % 3) / 3;
    const ida = ciclo < 0.5;
    const f = ida ? ciclo * 2 : (1 - ciclo) * 2;
    const L1 = h * 0.3;
    const L2 = h * 0.22;
    const x1 = w * 0.12 + f * (w * 0.5 - L1 / 2 - w * 0.12);
    const x2 = w * 0.9 - f * (w * 0.9 - (w * 0.5 + L2 / 2));
    const carro = (x: number, L: number, cor: string, v: number) => {
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.roundRect(x - L / 2, chao - L - 4, L, L, 5); ctx.fill();
      bola(ctx, x - L * 0.28, chao - 3, 3.5, k.fg);
      bola(ctx, x + L * 0.28, chao - 3, 3.5, k.fg);
      seta(ctx, x, chao - L - 12, x + v, chao - L - 12, k.fg, 2);
    };
    carro(x1, L1, k.mat, ida ? 22 : -10);
    carro(x2, L2, k.hum, ida ? -16 : 26);
  },

  // Estequiometria.tsx: 2 H₂ + O₂ viram 2 H₂O, em bolinhas nas cores dos átomos.
  estequiometria(ctx, w, h, t, k) {
    const p = Math.min(1, ((t % 4) / 4) * 1.5);
    const some = Math.min(1, p / 0.55);
    const surge = Math.max(0, (p - 0.45) / 0.55);
    const r = Math.min(9, h * 0.07);
    const meio = w / 2;
    const at = (x: number, y: number, el: string, raio: number, a: number) => {
      ctx.globalAlpha = a;
      bola(ctx, x, y, raio, COR_ATOMO[el]);
      ctx.strokeStyle = alfa(k.fg, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const ir = (x: number, y: number, f: number): [number, number] => [x + (meio - x) * f * 0.8, y + (h / 2 - y) * f * 0.8];
    for (const y of [h * 0.3, h * 0.7]) {
      const [x, yy] = ir(w * 0.14, y, some);
      at(x - r * 0.6, yy, 'H', r * 0.7, 1 - some);
      at(x + r * 0.6, yy, 'H', r * 0.7, 1 - some);
    }
    const [ox, oy] = ir(w * 0.34, h / 2, some);
    at(ox - r * 0.8, oy, 'O', r, 1 - some);
    at(ox + r * 0.8, oy, 'O', r, 1 - some);
    texto(ctx, '→', meio, h / 2 + 6, p > 0.3 ? k.brand : k.muted, { alinhar: 'center', tamanho: 18, peso: 800 });
    for (const y of [h * 0.3, h * 0.7]) {
      const x = meio + (w * 0.78 - meio) * surge;
      const yy = h / 2 + (y - h / 2) * surge;
      at(x - r * 1.05, yy + r * 0.7, 'H', r * 0.7, surge);
      at(x + r * 1.05, yy + r * 0.7, 'H', r * 0.7, surge);
      at(x, yy, 'O', r, surge);
    }
  },

  // Osmose.tsx: a hemácia incha e murcha conforme a água entra e sai; o soluto fica de fora.
  osmose(ctx, w, h, t, k) {
    ctx.fillStyle = alfa('#3b82f6', 0.1);
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const fase2 = Math.sin(t * 0.9);
    const R = Math.min(w, h) * (0.27 + 0.07 * fase2);
    const r = criarRng(8);
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = r() * h;
      if (Math.hypot(x - cx, y - cy) > R + 10) bola(ctx, x, y, 2.6, '#f59e3c');
    }
    ctx.fillStyle = alfa('#f2587a', 0.28);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 9; i++) bola(ctx, cx + Math.cos(i * 2.4) * R * 0.6 * Math.sqrt((i + 1) / 9), cy + Math.sin(i * 2.4) * R * 0.6 * Math.sqrt((i + 1) / 9), 2.6, '#f59e3c');
    const entra = Math.cos(t * 0.9) > 0;
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6 + 0.5;
      const r0 = R + (entra ? 14 : -10);
      const r1 = R + (entra ? -8 : 16);
      seta(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, '#3b82f6', 1.8);
    }
    void k;
  },

  // Estatistica.tsx: gráfico de pontos com a média (mat, o apoio) e a mediana (hum); um ponto extremo puxa a média.
  estatistica(ctx, w, h, t, k) {
    const eixo = h * 0.7;
    const X = (v: number) => 14 + (v / 20) * (w - 28);
    const extremo = 13 + 5 * (0.5 + 0.5 * Math.sin(t * 0.9));
    const dados = [4, 5, 5, 6, 6, 6, 7, 7, 8, extremo];
    const m = dados.reduce((s, x) => s + x, 0) / dados.length;
    linha(ctx, [[8, eixo], [w - 8, eixo]], k.muted, 1.5);
    for (let v = 0; v <= 20; v += 2) linha(ctx, [[X(v), eixo], [X(v), eixo + 4]], k.muted, 1);
    const r = Math.min(7, h * 0.06);
    const cont = new Map<number, number>();
    dados.forEach((v, i) => {
      const n = cont.get(v) ?? 0;
      cont.set(v, n + 1);
      bola(ctx, X(v), eixo - r - 3 - n * r * 2.2, r, i === dados.length - 1 ? k.brand : k.fg);
    });
    linha(ctx, [[X(m), 10], [X(m), eixo]], k.mat, 2);
    ctx.fillStyle = k.mat;
    ctx.beginPath(); ctx.moveTo(X(m), eixo + 8); ctx.lineTo(X(m) - 7, eixo + 20); ctx.lineTo(X(m) + 7, eixo + 20); ctx.closePath(); ctx.fill();
    linha(ctx, [[X(6), 10], [X(6), eixo]], k.hum, 1.6, [5, 4]);
  },
};

export function desenharMiniatura(slug: string, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, k: Tinta) {
  DESENHOS[slug]?.(ctx, w, h, t, k);
}

export const temMiniatura = (slug: string) => slug in DESENHOS;
