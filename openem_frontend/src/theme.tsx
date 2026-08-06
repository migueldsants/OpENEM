import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Theme =
  | 'light'
  | 'dark'
  | 'sepia'
  | 'oled-black'
  | 'ocean'
  | 'enem'
  | 'indigo'
  | 'high-contrast'
  | 'custom'; // tema personalizado via ThemeCustomizer (CSS vars inline)

// eslint-disable-next-line react-refresh/only-export-components
export const THEMES: { key: Theme; label: string; swatch: string[] }[] = [
  { key: 'light', label: 'Claro', swatch: ['#f5f1f6', '#e0234e'] },
  { key: 'dark', label: 'Escuro', swatch: ['#15111c', '#fb5277'] },
  { key: 'sepia', label: 'Sépia', swatch: ['#f4ecd8', '#b45309'] },
  { key: 'oled-black', label: 'OLED', swatch: ['#000000', '#00e5a0'] },
  { key: 'ocean', label: 'Ocean', swatch: ['#0c1c2b', '#38bdf8'] },
  { key: 'enem', label: 'ENEM', swatch: ['#fffbeb', '#f59e0b'] },
  { key: 'indigo', label: 'Roxo', swatch: ['#13131f', '#8b5cf6'] },
  { key: 'high-contrast', label: 'Contraste', swatch: ['#000000', '#ffcc00'] },
];

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const STORAGE_KEY = 'openem.theme';

const VALID: Theme[] = [...THEMES.map((t) => t.key), 'custom'];

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && VALID.includes(saved as Theme)) return saved as Theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  // Compat: toggle alterna apenas entre claro/escuro (atalho rápido do header).
  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
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