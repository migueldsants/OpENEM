import { isHex } from './lib/color';
import {
  deriveVariant,
  paletteFromBrand,
  TOKEN_KEYS,
  type Tokens,
  type Variant,
} from './lib/theme-derive';

/** Tokens de cor customizáveis (nome interno -> label amigável). */
export const TOKENS: { key: string; label: string }[] = [
  { key: 'bg', label: 'Fundo' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'surface', label: 'Cartões' },
  { key: 'surface-2', label: 'Cartões 2' },
  { key: 'fg', label: 'Texto' },
  { key: 'muted', label: 'Texto suave' },
  { key: 'line', label: 'Bordas' },
  { key: 'brand', label: 'Marca' },
  { key: 'brand-2', label: 'Marca 2' },
  { key: 'brand-ink', label: 'Texto na marca' },
];

export type ThemeJson = Tokens;

/**
 * Tema personalizado: um nome e os dois lados. `id` é o do servidor quando o
 * tema está salvo em "Meus temas" ou veio da comunidade.
 */
export interface CustomTheme {
  v: 2;
  id?: string;
  name: string;
  light: Tokens;
  dark: Tokens;
}

export const STORAGE_KEY = 'openem.theme.custom';
export const DEFAULT_NAME = 'Meu tema';

/** Garante string de cor válida para o input type="color" (só aceita #rrggbb). */
export function normalizeColor(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return '#000000';
}

/**
 * Só as chaves conhecidas e só `#rrggbb`. As cores vão para
 * `style.setProperty` — e as da comunidade vêm de outros alunos —, então
 * `url(...)`, `var(...)` e afins não podem passar.
 */
export function sanitizeTokens(raw: unknown): Tokens {
  const out: Tokens = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const k of TOKEN_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (isHex(v)) out[k] = v.trim().toLowerCase();
  }
  return out;
}

function isComplete(t: Tokens): boolean {
  return TOKEN_KEYS.every((k) => k in t);
}

/** Completa um lado parcial com a paleta gerada da marca dele. */
function complete(t: Tokens, variant: Variant): Tokens {
  if (isComplete(t)) return t;
  return { ...paletteFromBrand(t.brand ?? '#d91748', variant), ...t };
}

/**
 * Claro ou escuro, pela luminância do fundo. Usado para encaixar o tema
 * antigo (um lado só) no formato novo.
 */
export function customScheme(json: ThemeJson): Variant {
  const m = /^#?([0-9a-f]{6})$/i.exec((json.bg ?? '').trim());
  if (!m) return 'light';
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l =
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255);
  // 0,18 ≈ cinza médio (#767676): o ponto em que texto claro e escuro empatam.
  return l < 0.18 ? 'dark' : 'light';
}

/** Monta os dois lados a partir de um só (o outro é derivado). */
export function fromOneSide(tokens: Tokens, variant: Variant, name = DEFAULT_NAME): CustomTheme {
  const side = complete(tokens, variant);
  const other: Variant = variant === 'light' ? 'dark' : 'light';
  const theme: CustomTheme = { v: 2, name, light: side, dark: side };
  theme[other] = deriveVariant(side, other);
  return theme;
}

/**
 * Lê um tema em qualquer formato conhecido: o v2 ou o antigo (um objeto
 * plano com as cores de um lado só, que vira o lado indicado pelo fundo).
 * Devolve null quando não há nenhuma cor válida.
 */
export function parseCustom(raw: unknown): CustomTheme | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const name =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim().slice(0, 40)
      : DEFAULT_NAME;
  if ('light' in obj || 'dark' in obj) {
    const light = sanitizeTokens(obj.light);
    const dark = sanitizeTokens(obj.dark);
    const hasLight = Object.keys(light).length > 0;
    const hasDark = Object.keys(dark).length > 0;
    if (!hasLight && !hasDark) return null;
    const theme: CustomTheme = {
      v: 2,
      name,
      light: hasLight ? complete(light, 'light') : deriveVariant(complete(dark, 'dark'), 'light'),
      dark: hasDark ? complete(dark, 'dark') : deriveVariant(complete(light, 'light'), 'dark'),
    };
    if (typeof obj.id === 'string' && obj.id) theme.id = obj.id;
    return theme;
  }
  const flat = sanitizeTokens(obj);
  if (Object.keys(flat).length === 0) return null;
  return fromOneSide(flat, customScheme(flat), name);
}

export function loadCustom(): CustomTheme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseCustom(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveCustom(theme: CustomTheme) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function clearStoredCustom() {
  localStorage.removeItem(STORAGE_KEY);
}

export function readCurrentTokens(): ThemeJson {
  const style = getComputedStyle(document.documentElement);
  const out: ThemeJson = {};
  for (const t of TOKENS) {
    const v = style.getPropertyValue(`--${t.key}`).trim();
    if (v) out[t.key] = v;
  }
  return out;
}

/** Aplica um lado do tema como estilos inline no <html>. */
export function applyCustomTheme(tokens: Tokens) {
  const root = document.documentElement;
  const safe = sanitizeTokens(tokens);
  for (const t of TOKENS) {
    if (safe[t.key]) root.style.setProperty(`--${t.key}`, safe[t.key]);
  }
}

/** Remove TODOS os estilos inline de tokens customizados do <html>. */
export function clearCustomInlineStyles() {
  const root = document.documentElement;
  for (const t of TOKENS) {
    root.style.removeProperty(`--${t.key}`);
  }
}

/** Variáveis CSS de um lado, para prévias (`style={tokensStyle(t)}`). */
export function tokensStyle(tokens: Tokens): Record<string, string> {
  const safe = sanitizeTokens(tokens);
  return Object.fromEntries(Object.entries(safe).map(([k, v]) => [`--${k}`, v]));
}

/** Valida um JSON colado pelo aluno (v2 ou antigo). Lança se não tiver cor válida. */
export function validateCustomJson(raw: string): CustomTheme {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON inválido');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON inválido');
  }
  const theme = parseCustom(parsed);
  if (!theme) throw new Error('Nenhum token válido');
  return theme;
}

/** JSON de exportação (sem o id do servidor). */
export function exportCustomJson(theme: CustomTheme): string {
  const { name, light, dark } = theme;
  return JSON.stringify({ v: 2, name, light, dark }, null, 2);
}
