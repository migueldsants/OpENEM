import {
  contrastRatio,
  ensureContrast,
  fromOklch,
  isHex,
  readableInk,
  toOklch,
} from './color';

/**
 * Geração de paleta para o tema personalizado: a partir de uma cor só, ou o
 * lado escuro a partir do claro (e vice-versa). Tudo em OKLCH: os neutros
 * herdam o matiz da marca com croma baixo, e cada par texto/fundo é
 * empurrado até o contraste mínimo, então o resultado é sempre legível.
 */

export type Variant = 'light' | 'dark';
export type Tokens = Record<string, string>;

export const TOKEN_KEYS = [
  'bg',
  'sidebar',
  'surface',
  'surface-2',
  'fg',
  'muted',
  'line',
  'brand',
  'brand-2',
  'brand-ink',
] as const;

const NEUTRALS = ['bg', 'sidebar', 'surface', 'surface-2', 'line', 'fg', 'muted'] as const;
type Neutral = (typeof NEUTRALS)[number];

/** Claridade (L em OKLCH) de cada neutro em cada lado, tirada dos temas prontos. */
const LIGHTNESS: Record<Variant, Record<Neutral, number>> = {
  light: {
    bg: 0.965,
    sidebar: 0.945,
    surface: 0.997,
    'surface-2': 0.978,
    line: 0.92,
    fg: 0.22,
    muted: 0.5,
  },
  dark: {
    bg: 0.17,
    sidebar: 0.19,
    surface: 0.21,
    'surface-2': 0.255,
    line: 0.31,
    fg: 0.94,
    muted: 0.74,
  },
};

/** Teto de croma dos neutros: fundo saturado cansa e derruba o contraste das áreas. */
const CHROMA_CAP: Record<Neutral, number> = {
  bg: 0.03,
  sidebar: 0.03,
  surface: 0.025,
  'surface-2': 0.035,
  line: 0.04,
  fg: 0.03,
  muted: 0.05,
};

/** Mínimos de contraste (WCAG) que o editor cobra e a geração garante. */
export const MIN = { text: 7, muted: 4.5, ink: 4.5, brand: 3 } as const;

function neutral(key: Neutral, variant: Variant, h: number, c: number): string {
  return fromOklch({ l: LIGHTNESS[variant][key], c: Math.min(c, CHROMA_CAP[key]), h });
}

/** Ajusta marca, marca 2 e texto na marca até passarem nos mínimos. */
function fitBrand(tokens: Tokens, brand: string, brand2: string): Tokens {
  const cards = [tokens.bg, tokens.surface, tokens['surface-2']];
  let b = ensureContrast(brand, cards, MIN.brand);
  let ink = readableInk(b);
  if (contrastRatio(ink, b) < MIN.ink) {
    b = ensureContrast(b, ink, MIN.ink);
    ink = readableInk(b);
  }
  return {
    ...tokens,
    brand: b,
    'brand-2': ensureContrast(brand2, cards, MIN.brand),
    'brand-ink': ink,
  };
}

/** Garante texto e texto suave legíveis sobre todos os fundos. */
function fitText(tokens: Tokens): Tokens {
  const grounds = [tokens.bg, tokens.sidebar, tokens.surface, tokens['surface-2']];
  return {
    ...tokens,
    fg: ensureContrast(tokens.fg, grounds, MIN.text),
    muted: ensureContrast(tokens.muted, grounds, MIN.muted),
  };
}

/** Paleta completa de um lado a partir de uma cor de marca. */
export function paletteFromBrand(brand: string, variant: Variant): Tokens {
  const base = toOklch(isHex(brand) ? brand : '#d91748');
  // Neutros levemente tingidos pela marca: dão identidade sem virar "fundo colorido".
  const tint = Math.min(base.c * 0.15, 0.025);
  const tokens: Tokens = {};
  for (const k of NEUTRALS) {
    const c = k === 'muted' ? tint * 1.6 : k === 'fg' ? tint * 0.8 : tint;
    tokens[k] = neutral(k, variant, base.h, c);
  }
  // Marca 2: matiz vizinho (+28°) e um pouco mais clara, para gradientes.
  const brand2 = fromOklch({
    l: Math.min(0.92, base.l + 0.08),
    c: base.c,
    h: (base.h + 28) % 360,
  });
  const brand1 =
    variant === 'dark' && base.l < 0.62 ? fromOklch({ ...base, l: 0.7 }) : fromOklch(base);
  return fitText(fitBrand(tokens, brand1, brand2));
}

/**
 * Gera o outro lado de um tema já pronto: cada neutro mantém matiz e croma
 * (limitado) e ganha a claridade do lado pedido; a marca mantém o matiz e é
 * reajustada para o novo fundo.
 */
export function deriveVariant(source: Tokens, target: Variant): Tokens {
  const tokens: Tokens = {};
  const fallback = toOklch(isHex(source.brand) ? source.brand : '#d91748');
  for (const k of NEUTRALS) {
    const src = isHex(source[k]) ? toOklch(source[k]) : { l: 0, c: 0, h: fallback.h };
    tokens[k] = neutral(k, target, src.h, src.c);
  }
  const brand = toOklch(isHex(source.brand) ? source.brand : '#d91748');
  const brand2 = toOklch(isHex(source['brand-2']) ? source['brand-2'] : fromOklch(brand));
  // No escuro a marca precisa de claridade para brilhar sobre o fundo; no
  // claro, de sobriedade para não ofuscar o texto.
  const shift = (c: typeof brand) =>
    target === 'dark'
      ? fromOklch({ ...c, l: Math.max(c.l, 0.7) })
      : fromOklch({ ...c, l: Math.min(c.l, 0.58) });
  return fitText(fitBrand(tokens, shift(brand), shift(brand2)));
}

export interface ContrastIssue {
  /** Rótulo legível do par, ex.: "Texto suave sobre Cartões". */
  label: string;
  ratio: number;
  min: number;
}

const LABEL: Record<string, string> = {
  bg: 'Fundo',
  sidebar: 'Sidebar',
  surface: 'Cartões',
  'surface-2': 'Cartões 2',
  fg: 'Texto',
  muted: 'Texto suave',
  brand: 'Marca',
  'brand-ink': 'Texto na marca',
};

/** Pares abaixo do mínimo, para o editor avisar antes de salvar. */
export function contrastIssues(tokens: Tokens): ContrastIssue[] {
  const pairs: [string, string, number][] = [
    ['fg', 'bg', 4.5],
    ['fg', 'surface', 4.5],
    ['fg', 'surface-2', 4.5],
    ['muted', 'bg', MIN.muted],
    ['muted', 'surface', MIN.muted],
    ['brand-ink', 'brand', MIN.ink],
    ['brand', 'surface', MIN.brand],
  ];
  const out: ContrastIssue[] = [];
  for (const [fg, bg, min] of pairs) {
    if (!isHex(tokens[fg]) || !isHex(tokens[bg])) continue;
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    if (ratio < min) {
      out.push({ label: `${LABEL[fg]} sobre ${LABEL[bg]}`, ratio, min });
    }
  }
  return out;
}
