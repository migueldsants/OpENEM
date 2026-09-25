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

export type ThemeJson = Record<string, string>;

export const STORAGE_KEY = 'openem.theme.custom';

/** Garante string de cor válida para o input type="color" (só aceita #rrggbb). */
export function normalizeColor(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return '#000000';
}

export function loadCustom(): ThemeJson | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeJson) : null;
  } catch {
    return null;
  }
}

export function saveCustom(json: ThemeJson) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
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

/**
 * Claro ou escuro, pela luminância do fundo. O tema personalizado não tem
 * variante própria, mas `color-scheme` (barras de rolagem, controles nativos)
 * e as sombras precisam saber de qual lado ele está.
 */
export function customScheme(json: ThemeJson): 'light' | 'dark' {
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

/** Aplica um tema customizado como estilos inline no <html>. */
export function applyCustomTheme(json: ThemeJson) {
  const root = document.documentElement;
  for (const t of TOKENS) {
    if (json[t.key]) root.style.setProperty(`--${t.key}`, json[t.key]);
  }
  root.dataset.scheme = customScheme(json);
}

/** Remove TODOS os estilos inline de tokens customizados do <html>. */
export function clearCustomInlineStyles() {
  const root = document.documentElement;
  for (const t of TOKENS) {
    root.style.removeProperty(`--${t.key}`);
  }
  delete root.dataset.scheme;
}

/** Valida um JSON bruto, mantendo só chaves conhecidas. Lança se vazio. */
export function validateCustomJson(raw: string): ThemeJson {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON inválido');
  }
  const valid: ThemeJson = {};
  for (const t of TOKENS) {
    if (typeof (parsed as Record<string, unknown>)[t.key] === 'string') {
      valid[t.key] = (parsed as Record<string, string>)[t.key];
    }
  }
  if (Object.keys(valid).length === 0) throw new Error('Nenhum token válido');
  return valid;
}