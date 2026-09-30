/**
 * Conta de cor usada pelos temas: contraste WCAG e OKLCH.
 *
 * OKLCH separa claridade (L), croma (C) e matiz (H) de um jeito que o olho
 * concorda: mexer só no L clareia ou escurece sem "desbotar" nem trocar de
 * matiz, que é o que a geração de paleta e o ajuste de contraste precisam.
 * Fórmulas de Björn Ottosson (https://bottosson.github.io/posts/oklab/).
 */

export type Rgb = [number, number, number];
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX = /^#([0-9a-f]{6})$/i;

/** Só `#rrggbb`: é o único formato que os temas aceitam. */
export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value.trim());
}

export function parseHex(hex: string): Rgb | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return s * 255;
}

/** Luminância relativa (WCAG 2), de 0 (preto) a 1 (branco). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores, de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function toOklch(hex: string): Oklch {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(A, B);
  // Cinza não tem matiz: fixa 0 para não sair ruído de arredondamento.
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** OKLCH -> RGB linear, sem cortar (pode sair do gamut). */
function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/**
 * OKLCH -> hex. Fora do gamut sRGB, reduz o croma (mantendo L e H) até
 * caber: a cor perde saturação, mas não muda de claridade nem de matiz.
 */
export function fromOklch(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  let c = Math.max(0, color.c);
  let rgb = oklchToLinear({ l, c, h: color.h });
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      c = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ l, c, h: color.h }))) lo = c;
      else hi = c;
    }
    rgb = oklchToLinear({ l, c: lo, h: color.h });
  }
  return toHex(rgb.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb);
}

/**
 * Ajusta a claridade de `fg` até ele ter pelo menos `min` de contraste com
 * todos os `bgs`. Anda para o lado oposto ao fundo (clareia sobre fundo
 * escuro, escurece sobre fundo claro), mantendo matiz e o croma possível.
 * Se não alcançar, devolve o melhor que conseguiu (branco ou preto no limite).
 */
export function ensureContrast(fg: string, bgs: string | string[], min: number): string {
  const list = Array.isArray(bgs) ? bgs : [bgs];
  const worst = (hex: string) => Math.min(...list.map((b) => contrastRatio(hex, b)));
  if (worst(fg) >= min) return fg;
  const avgBg = list.reduce((s, b) => s + luminance(b), 0) / list.length;
  const lighten = avgBg < 0.18;
  const start = toOklch(fg);
  let best = fg;
  for (let step = 1; step <= 100; step++) {
    const l = lighten ? start.l + (1 - start.l) * (step / 100) : start.l * (1 - step / 100);
    const candidate = fromOklch({ l, c: start.c, h: start.h });
    best = candidate;
    if (worst(candidate) >= min) return candidate;
  }
  return best;
}

/**
 * Cor de texto sobre um preenchimento (`brand-ink`): branco ou um quase-preto
 * no matiz do fundo, o que contrastar mais.
 */
export function readableInk(bg: string): string {
  const { h } = toOklch(bg);
  const dark = fromOklch({ l: 0.18, c: 0.03, h });
  return contrastRatio('#ffffff', bg) >= contrastRatio(dark, bg) ? '#ffffff' : dark;
}
