/**
 * Ajudantes de desenho das simulações (fora do ui.tsx para o Fast Refresh):
 * cores do tema para o canvas, setas, texto e as marcas dos eixos.
 */
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Cores do tema
// ---------------------------------------------------------------------------

export interface Cores {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  line: string;
  brand: string;
  mat: string;
  nat: string;
  hum: string;
  lin: string;
  red: string;
  danger: string;
  gold: string;
  plat: string;
  escuro: boolean;
}

const VARS: [keyof Cores, string][] = [
  ['bg', '--bg'], ['surface', '--surface'], ['surface2', '--surface-2'], ['fg', '--fg'],
  ['muted', '--muted'], ['line', '--line'], ['brand', '--brand'], ['mat', '--mat'],
  ['nat', '--nat'], ['hum', '--hum'], ['lin', '--lin'], ['red', '--red'],
  ['danger', '--danger'], ['gold', '--gold'], ['plat', '--plat'],
];

const PADRAO: Cores = {
  bg: '#15111c', surface: '#1d1826', surface2: '#272132', fg: '#f4f1f8', muted: '#a59db3',
  line: '#3a3346', brand: '#f2587a', mat: '#669dfb', nat: '#13b981', hum: '#f59e3c', lin: '#ac8bf5',
  red: '#f7708a', danger: '#f07774', gold: '#e0a83c', plat: '#3fa7c4', escuro: true,
};

function lerCores(): Cores {
  if (typeof document === 'undefined') return PADRAO;
  const css = getComputedStyle(document.documentElement);
  const out = { ...PADRAO };
  for (const [k, v] of VARS) {
    const valor = css.getPropertyValue(v).trim();
    if (valor) (out as Record<string, unknown>)[k] = valor;
  }
  out.escuro = luminancia(out.bg) < 0.4;
  return out;
}

function luminancia(cor: string) {
  const rgb = hexParaRgb(cor);
  if (!rgb) return 0;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

function hexParaRgb(cor: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** A mesma cor com transparência (o canvas não entende color-mix). */
export function alfa(cor: string, a: number) {
  const rgb = hexParaRgb(cor);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : cor;
}

/** Cores do tema atual, relidas quando o aluno troca de tema. */
export function useCores(): Cores {
  const [cores, setCores] = useState(lerCores);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => setCores(lerCores()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => obs.disconnect();
  }, []);
  return cores;
}

/**
 * Céu das cenas de astronomia (Órbitas, Estações), no palco 3D e nas
 * miniaturas: escuro nos dois temas, porque o espaço não muda com o tema.
 */
export const COR_CEU = '#070a18';

export function usaMovimentoReduzido() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Seta com ponta, para vetores de força e velocidade. */
export function seta(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, cor: string, largura = 2.5, rotulo?: string) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) return;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const ponta = Math.min(10, len * 0.45);
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(ang) * ponta * 0.6, y1 - Math.sin(ang) * ponta * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ponta * Math.cos(ang - 0.42), y1 - ponta * Math.sin(ang - 0.42));
  ctx.lineTo(x1 - ponta * Math.cos(ang + 0.42), y1 - ponta * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  if (rotulo) {
    ctx.font = '600 12px Inter Variable, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    ctx.fillText(rotulo, x1 + Math.cos(ang) * 12 + nx * 0, y1 + Math.sin(ang) * 12 + ny * 0);
  }
  ctx.restore();
}

export function texto(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  cor: string,
  opts: { tamanho?: number; peso?: number; alinhar?: CanvasTextAlign; base?: CanvasTextBaseline; mono?: boolean } = {},
) {
  ctx.save();
  ctx.fillStyle = cor;
  ctx.font = `${opts.peso ?? 500} ${opts.tamanho ?? 12}px ${opts.mono ? 'JetBrains Mono Variable, monospace' : 'Inter Variable, Inter, sans-serif'}`;
  ctx.textAlign = opts.alinhar ?? 'left';
  ctx.textBaseline = opts.base ?? 'alphabetic';
  ctx.fillText(s, x, y);
  ctx.restore();
}

/** Marcas "redondas" do eixo (1, 2, 5 × 10ⁿ). */
export function marcasEixo(min: number, max: number, alvo = 5) {
  if (!(max > min)) return [min];
  const bruto = (max - min) / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  const out: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + passo * 1e-9; v += passo) out.push(Number(v.toPrecision(12)));
  return out;
}

