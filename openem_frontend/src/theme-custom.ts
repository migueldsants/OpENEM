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

/** Aplica um tema customizado como estilos inline no <html>. */
export function applyCustomTheme(json: ThemeJson) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(json)) {
    root.style.setProperty(`--${k}`, v);
  }
}

/** Remove TODOS os estilos inline de tokens customizados do <html>. */
export function clearCustomInlineStyles() {
  const root = document.documentElement;
  for (const t of TOKENS) {
    root.style.removeProperty(`--${t.key}`);
  }
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