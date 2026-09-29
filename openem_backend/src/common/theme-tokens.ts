/**
 * Tokens de cor de um tema do aluno (tela Temas do app).
 *
 * As cores são aplicadas com `style.setProperty` no navegador de quem usa o
 * tema — e um tema publicado roda no navegador de outros alunos. Por isso só
 * `#rrggbb` passa: `url(...)` vazaria o IP de quem abre o tema, e `var()`,
 * `expression()` e afins abririam brecha para injeção de CSS. As chaves
 * espelham `TOKEN_KEYS` do frontend (src/lib/theme-derive.ts).
 */
export const THEME_TOKEN_KEYS = [
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

export type ThemeTokens = Record<(typeof THEME_TOKEN_KEYS)[number], string>;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Exige as 10 chaves, todas `#rrggbb`; normaliza para minúsculas e descarta
 * qualquer chave extra. Devolve null se faltar ou sobrar algo inválido.
 */
export function parseThemeTokens(raw: unknown): ThemeTokens | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const out = {} as ThemeTokens;
  for (const key of THEME_TOKEN_KEYS) {
    const value = obj[key];
    if (typeof value !== 'string' || !HEX.test(value.trim())) return null;
    out[key] = value.trim().toLowerCase();
  }
  return out;
}

/** Lê o JSON gravado no banco; valor corrompido vira null em vez de derrubar a lista. */
export function readStoredTokens(stored: string): ThemeTokens | null {
  try {
    return parseThemeTokens(JSON.parse(stored));
  } catch {
    return null;
  }
}
