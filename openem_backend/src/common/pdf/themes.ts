/**
 * Paletas do PDF — os mesmos temas de cor do app (`openem_frontend/src/theme.tsx`).
 *
 * O aluno escolhe o tema na tela e o caderno sai na mesma cor: é o que faz o
 * PDF parecer do OpENEM e não uma exportação genérica. Aqui as cores são as da
 * variante CLARA de cada família — papel é branco, e imprimir o tema escuro
 * gastaria meio cartucho por página.
 */

export interface PdfTheme {
  key: string;
  label: string;
  /** Cor principal (títulos, número da questão, faixa da capa). */
  brand: string;
  /** Segunda cor da marca, usada no gradiente da capa. */
  brand2: string;
  /** Texto sobre a cor da marca. */
  brandInk: string;
  /** Texto corrido. */
  fg: string;
  /** Texto secundário (legenda, rodapé). */
  muted: string;
  /** Linhas e filetes. */
  line: string;
  /** Fundo de caixas (instruções, gabarito). */
  surface: string;
}

export const PDF_THEMES: PdfTheme[] = [
  {
    key: 'default',
    label: 'Padrão',
    brand: '#e0234e',
    brand2: '#7a1533',
    brandInk: '#ffffff',
    fg: '#1a1420',
    muted: '#6b6475',
    line: '#ddd6e0',
    surface: '#faf7fb',
  },
  {
    key: 'sepia',
    label: 'Sépia',
    brand: '#b45309',
    brand2: '#7c3a06',
    brandInk: '#fffaf0',
    fg: '#3a2e1f',
    muted: '#7a6a52',
    line: '#e0d5bd',
    surface: '#faf4e6',
  },
  {
    key: 'azure',
    label: 'Azul',
    brand: '#2563eb',
    brand2: '#14357f',
    brandInk: '#ffffff',
    fg: '#16203a',
    muted: '#5f6b85',
    line: '#d4deeb',
    surface: '#f4f8fd',
  },
  {
    key: 'indigo',
    label: 'Roxo',
    brand: '#8b5cf6',
    brand2: '#4c2e91',
    brandInk: '#ffffff',
    fg: '#1f1833',
    muted: '#6a6184',
    line: '#ded5f2',
    surface: '#f8f5ff',
  },
  {
    key: 'forest',
    label: 'Verde',
    brand: '#16a34a',
    brand2: '#0a5c29',
    brandInk: '#ffffff',
    fg: '#14271a',
    muted: '#5c7063',
    line: '#cfe5d5',
    surface: '#f3faf5',
  },
  {
    key: 'gold',
    label: 'Dourado',
    brand: '#b8860b',
    brand2: '#7a5805',
    brandInk: '#ffffff',
    fg: '#2e2510',
    muted: '#726545',
    line: '#e6dab4',
    surface: '#fdf9ec',
  },
  {
    key: 'fire',
    label: 'Fogo',
    brand: '#ea580c',
    brand2: '#9a3412',
    brandInk: '#ffffff',
    fg: '#2b1a12',
    muted: '#7a6357',
    line: '#f0d7c6',
    surface: '#fff6f1',
  },
  {
    key: 'ink',
    label: 'Tinta (P&B)',
    // Para quem imprime em laser monocromático: nada de cor chapada.
    brand: '#1f2937',
    brand2: '#000000',
    brandInk: '#ffffff',
    fg: '#111827',
    muted: '#6b7280',
    line: '#d1d5db',
    surface: '#f7f7f8',
  },
];

export const DEFAULT_THEME_KEY = 'default';

/** Tema por chave; cai no padrão quando a chave é desconhecida. */
export function resolveTheme(key?: string | null): PdfTheme {
  return (
    PDF_THEMES.find((t) => t.key === key) ??
    PDF_THEMES.find((t) => t.key === DEFAULT_THEME_KEY)!
  );
}

/** `#rgb`/`#rrggbb` válido? Usado para aceitar cor livre do aluno. */
export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/**
 * Tema com a cor de marca trocada por um hex escolhido pelo aluno (o tema
 * "custom" do app). Hex inválido devolve o tema base sem alteração.
 */
export function themeWithBrand(base: PdfTheme, hex?: string | null): PdfTheme {
  if (!hex || !isHexColor(hex)) return base;
  const brand = normalizeHex(hex);
  return { ...base, brand, brand2: darken(brand, 0.45) };
}

/** `#abc` → `#aabbcc`, minúsculo. */
export function normalizeHex(hex: string): string {
  const v = hex.trim().toLowerCase();
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v;
}

/** Escurece uma cor para o gradiente da capa. `amount` 0..1. */
export function darken(hex: string, amount: number): string {
  const v = normalizeHex(hex);
  const canal = (i: number) => {
    const n = Number.parseInt(v.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.max(0, Math.min(255, Math.round(n * (1 - amount))));
  };
  return `#${[0, 1, 2]
    .map((i) => canal(i).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Preto ou branco sobre a cor dada, pela luminância relativa — um tema amarelo
 * com texto branco fica ilegível no papel.
 */
export function contrastInk(hex: string): string {
  const v = normalizeHex(hex);
  const canal = (i: number) =>
    Number.parseInt(v.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const l =
    0.2126 * lin(canal(0)) + 0.7152 * lin(canal(1)) + 0.0722 * lin(canal(2));
  return l > 0.45 ? '#111827' : '#ffffff';
}
