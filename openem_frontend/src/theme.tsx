import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { clearCustomInlineStyles } from './theme-custom';

/** Família de tema (a "paleta"). Cada família tem versão light e dark. */
export type ThemeFamily =
  | 'default'
  | 'sepia'
  | 'oled'
  | 'azure'
  | 'indigo'
  | 'forest'
  | 'gold'
  | 'fire'
  | 'contrast'
  | 'custom';

export type ThemeVariant = 'light' | 'dark';

/** Tema completo = família + variante (ex: 'sepia-dark'). 'custom' não tem variante. */
export type Theme = `${ThemeFamily}-${ThemeVariant}` | 'custom';

// eslint-disable-next-line react-refresh/only-export-components
export const FAMILIES: {
  key: ThemeFamily;
  label: string;
  swatch: [string, string];
}[] = [
  { key: 'default', label: 'Padrão', swatch: ['#f5f1f6', '#e0234e'] },
  { key: 'sepia', label: 'Sépia', swatch: ['#f4ecd8', '#b45309'] },
  { key: 'oled', label: 'Black', swatch: ['#000000', '#00e5a0'] },
  { key: 'azure', label: 'Azul', swatch: ['#eaf3fb', '#2563eb'] },
  { key: 'indigo', label: 'Roxo', swatch: ['#f3f0fb', '#8b5cf6'] },
  { key: 'forest', label: 'Verde', swatch: ['#eef7ee', '#16a34a'] },
  { key: 'gold', label: 'Dourado', swatch: ['#fbf6e3', '#d4a017'] },
  { key: 'fire', label: 'Fogo', swatch: ['#fff0e8', '#ff6b35'] },
  { key: 'contrast', label: 'Contraste', swatch: ['#ffffff', '#ffcc00'] },
];

interface ThemeState {
  /** Tema completo (ex: 'sepia-dark') — para aplicar no data-theme. */
  theme: Theme;
  /** Família atual (ex: 'sepia'). */
  family: ThemeFamily;
  /** Variante atual (ex: 'dark'). */
  variant: ThemeVariant;
  /** Troca a família, mantendo a variante atual. */
  setFamily: (f: ThemeFamily) => void;
  /** Troca a variante (light/dark). */
  setVariant: (v: ThemeVariant) => void;
  /** Alterna entre claro e escuro (atalho do header). */
  toggle: () => void;
  /** Aplica um tema completo (ex: 'azure-light'). */
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const STORAGE_KEY = 'openem.theme';

const FAMILY_KEYS = FAMILIES.map((f) => f.key);

function parseTheme(t: string): { family: ThemeFamily; variant: ThemeVariant } | null {
  if (t === 'custom') return { family: 'custom', variant: 'dark' };
  const dash = t.lastIndexOf('-');
  if (dash < 0) return null;
  const fam = t.slice(0, dash) as ThemeFamily;
  const varr = t.slice(dash + 1) as ThemeVariant;
  if (!FAMILY_KEYS.includes(fam) || (varr !== 'light' && varr !== 'dark')) {
    return null;
  }
  return { family: fam, variant: varr };
}

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = parseTheme(saved);
    if (parsed) return saved as Theme;
  }
  // Default: família 'default', variante segue prefers-color-scheme.
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'default-light' : 'default-dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const parsed = parseTheme(theme);
  const family = parsed?.family ?? 'default';
  const variant = parsed?.variant ?? 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    // Sair de 'custom' remove os overrides inline para que a paleta
    // escolhida (CSS) realmente apareça — antes ficavam "grudados".
    if (t !== 'custom') clearCustomInlineStyles();
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const setFamily = useCallback(
    (f: ThemeFamily) => {
      if (f === 'custom') {
        setTheme('custom');
        return;
      }
      const v = parsed?.variant ?? 'dark';
      setTheme(`${f}-${v}` as Theme);
    },
    [parsed, setTheme],
  );

  const setVariant = useCallback(
    (v: ThemeVariant) => {
      const f = parsed?.family;
      if (!f || f === 'custom') return; // custom não tem variante
      setTheme(`${f}-${v}` as Theme);
    },
    [parsed, setTheme],
  );

  // Atalho do header: alterna claro/escuro dentro da família atual.
  const toggle = useCallback(() => {
    const currentFamily = parsed?.family ?? 'default';
    const currentVariant = parsed?.variant ?? 'dark';
    if (currentFamily === 'custom') {
      // Custom: sai para o tema padrão oposto.
      setTheme(currentVariant === 'dark' ? 'default-light' : 'default-dark');
      return;
    }
    setTheme(`${currentFamily}-${currentVariant === 'dark' ? 'light' : 'dark'}` as Theme);
  }, [parsed, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, family, variant, setFamily, setVariant, toggle, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  return ctx;
}