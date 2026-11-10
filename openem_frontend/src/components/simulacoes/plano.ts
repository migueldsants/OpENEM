/**
 * Plano cartesiano das simulações de Matemática: escala que cabe no palco com
 * unidades iguais nos dois eixos, grade, eixos numerados e a conversão entre
 * pixels e coordenadas (para arrastar pontos).
 */
import { alfa, texto, type Cores } from './canvas';

export interface Plano {
  X: (x: number) => number;
  Y: (y: number) => number;
  /** Pixel → coordenada. */
  x: (px: number) => number;
  y: (py: number) => number;
  esc: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Escala com o mesmo tamanho de unidade nos dois eixos, mostrando ao menos `meia` unidades para cada lado do centro. */
export function plano(w: number, h: number, meia: number, centro: [number, number] = [0, 0]): Plano {
  const esc = Math.min(w, h) / (2 * meia + 1);
  const xMin = centro[0] - w / 2 / esc;
  const yMax = centro[1] + h / 2 / esc;
  return {
    esc,
    xMin,
    xMax: centro[0] + w / 2 / esc,
    yMin: centro[1] - h / 2 / esc,
    yMax,
    X: (x) => (x - xMin) * esc,
    Y: (y) => (yMax - y) * esc,
    x: (px) => px / esc + xMin,
    y: (py) => yMax - py / esc,
  };
}

/** Grade de 1 em 1, eixos e números de 2 em 2 (ou de `passo` em `passo`). */
export function desenharPlano(ctx: CanvasRenderingContext2D, p: Plano, w: number, h: number, c: Cores, passo = 1) {
  ctx.lineWidth = 1;
  for (let x = Math.ceil(p.xMin); x <= p.xMax; x++) {
    ctx.strokeStyle = alfa(c.line, x % 5 === 0 ? 0.9 : 0.5);
    ctx.beginPath(); ctx.moveTo(p.X(x), 0); ctx.lineTo(p.X(x), h); ctx.stroke();
  }
  for (let y = Math.ceil(p.yMin); y <= p.yMax; y++) {
    ctx.strokeStyle = alfa(c.line, y % 5 === 0 ? 0.9 : 0.5);
    ctx.beginPath(); ctx.moveTo(0, p.Y(y)); ctx.lineTo(w, p.Y(y)); ctx.stroke();
  }
  ctx.strokeStyle = c.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, p.Y(0)); ctx.lineTo(w, p.Y(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.X(0), 0); ctx.lineTo(p.X(0), h); ctx.stroke();
  const marca = Math.max(passo, p.esc < 22 ? 2 : 1);
  for (let x = Math.ceil(p.xMin / marca) * marca; x <= p.xMax; x += marca) {
    if (x !== 0) texto(ctx, String(x), p.X(x), p.Y(0) + 13, c.muted, { alinhar: 'center', tamanho: 10, mono: true });
  }
  for (let y = Math.ceil(p.yMin / marca) * marca; y <= p.yMax; y += marca) {
    if (y !== 0) texto(ctx, String(y), p.X(0) - 5, p.Y(y) + 3, c.muted, { alinhar: 'right', tamanho: 10, mono: true });
  }
  texto(ctx, 'x', w - 8, p.Y(0) - 6, c.muted, { alinhar: 'right', tamanho: 11, peso: 700 });
  texto(ctx, 'y', p.X(0) + 6, 12, c.muted, { tamanho: 11, peso: 700 });
}

/** Ponto arrastável: anel na cor dada, maior quando está sendo arrastado. */
export function alca(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, c: Cores, ativo = false) {
  ctx.fillStyle = alfa(cor, ativo ? 0.3 : 0.18);
  ctx.beginPath(); ctx.arc(x, y, ativo ? 15 : 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = c.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Curva y = f(x) no plano, quebrando onde f não existe ou dá salto. */
export function curva(ctx: CanvasRenderingContext2D, p: Plano, w: number, f: (x: number) => number, cor: string, largura = 2.5) {
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let aberto = false;
  let anterior = 0;
  // Altura do palco em pixels: um salto maior que isso entre duas amostras é assíntota (1/x, tg x), não curva.
  const H = (p.yMax - p.yMin) * p.esc;
  for (let px = 0; px <= w; px += 1.5) {
    const y = f(p.x(px));
    const py = p.Y(y);
    if (!Number.isFinite(y) || py < -4 * H || py > 5 * H) {
      aberto = false;
      continue;
    }
    if (aberto && Math.abs(py - anterior) < H) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    aberto = true;
    anterior = py;
  }
  ctx.stroke();
}

/** Número com vírgula, sem casas inúteis. */
export const num = (v: number, casas = 2) => (Math.abs(v) < 1e-9 ? '0' : (+v.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas }));

/** "+ 3" / "− 3" para montar fórmulas. */
export const comSinal = (v: number, casas = 2) => (v < 0 ? `− ${num(-v, casas)}` : `+ ${num(v, casas)}`);
