import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  applyCustomTheme,
  clearCustomInlineStyles,
  customScheme,
  loadCustom,
  saveCustom,
  STORAGE_KEY as CUSTOM_KEY,
  type CustomTheme,
} from './theme-custom';

/** Família de tema (a "paleta"). Cada família tem versão light e dark. */
export type ThemeFamily =
  | 'default'
  | 'sepia'
  | 'azure'
  | 'indigo'
  | 'forest'
  | 'gold'
  | 'fire'
  | 'cyberpunk'
  | 'synthwave'
  | 'terminal'
  | 'arctic'
  | 'sakura'
  | 'ocean'
  | 'oled'
  | 'eclipse'
  | 'abyss'
  | 'ember'
  | 'contrast'
  | 'custom';

export type ThemeVariant = 'light' | 'dark';

/** Tema completo = família + variante (ex: 'sepia-dark', 'custom-light'). */
export type Theme = `${ThemeFamily}-${ThemeVariant}`;

export type ThemeGroup = 'classicos' | 'criativos' | 'oled' | 'acessibilidade';

// eslint-disable-next-line react-refresh/only-export-components
export const THEME_GROUPS: { key: ThemeGroup; label: string }[] = [
  { key: 'classicos', label: 'Clássicos' },
  { key: 'criativos', label: 'Customizados' },
  { key: 'oled', label: 'OLED' },
  { key: 'acessibilidade', label: 'Acessibilidade' },
];

/**
 * Famílias prontas (o personalizado fica fora: as cores dele moram no
 * localStorage). Os valores estão em src/themes.css; o script de boot
 * (public/theme-boot.js) repete a lista de chaves.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const FAMILIES: { key: Exclude<ThemeFamily, 'custom'>; label: string; group: ThemeGroup }[] =
  [
    { key: 'default', label: 'Padrão', group: 'classicos' },
    { key: 'sepia', label: 'Sépia', group: 'classicos' },
    { key: 'azure', label: 'Azul', group: 'classicos' },
    { key: 'indigo', label: 'Roxo', group: 'classicos' },
    { key: 'forest', label: 'Verde', group: 'classicos' },
    { key: 'gold', label: 'Dourado', group: 'classicos' },
    { key: 'fire', label: 'Fogo', group: 'classicos' },
    { key: 'cyberpunk', label: 'Cyberpunk', group: 'criativos' },
    { key: 'synthwave', label: 'Synthwave', group: 'criativos' },
    { key: 'terminal', label: 'Terminal', group: 'criativos' },
    { key: 'arctic', label: 'Ártico', group: 'criativos' },
    { key: 'sakura', label: 'Sakura', group: 'criativos' },
    { key: 'ocean', label: 'Oceano', group: 'criativos' },
    { key: 'oled', label: 'Black', group: 'oled' },
    { key: 'eclipse', label: 'Eclipse', group: 'oled' },
    { key: 'abyss', label: 'Abissal', group: 'oled' },
    { key: 'ember', label: 'Brasa', group: 'oled' },
    { key: 'contrast', label: 'Contraste', group: 'acessibilidade' },
  ];

interface ThemeState {
  /** Tema completo (ex: 'sepia-dark') — para aplicar no data-theme. */
  theme: Theme;
  /** Família atual (ex: 'sepia'). */
  family: ThemeFamily;
  /** Variante atual (ex: 'dark'). */
  variant: ThemeVariant;
  /** Tema personalizado guardado neste aparelho (null se nunca criado). */
  custom: CustomTheme | null;
  /** Efeitos visuais dos temas criativos (brilho, scanlines). */
  effects: boolean;
  /** Troca a família, mantendo a variante atual. */
  setFamily: (f: ThemeFamily) => void;
  /** Troca a variante (light/dark). */
  setVariant: (v: ThemeVariant) => void;
  /** Alterna entre claro e escuro (atalho do header). */
  toggle: () => void;
  /** Aplica um tema completo (ex: 'azure-light'). */
  setTheme: (t: Theme) => void;
  /** Guarda um tema personalizado e passa a usá-lo (na variante dada ou na atual). */
  applyCustom: (t: CustomTheme, variant?: ThemeVariant) => void;
  /** Liga/desliga os efeitos visuais. */
  setEffects: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const STORAGE_KEY = 'openem.theme';
const FX_KEY = 'openem.theme.fx';

const FAMILY_KEYS: string[] = FAMILIES.map((f) => f.key);

// eslint-disable-next-line react-refresh/only-export-components
export function parseTheme(
  t: string,
  hasCustom: () => boolean = () => loadCustom() !== null,
): { family: ThemeFamily; variant: ThemeVariant } | null {
  const dash = t.lastIndexOf('-');
  if (dash < 0) return null;
  const fam = t.slice(0, dash);
  const varr = t.slice(dash + 1);
  if (varr !== 'light' && varr !== 'dark') return null;
  if (fam === 'custom') {
    return hasCustom() ? { family: 'custom', variant: varr } : null;
  }
  if (!FAMILY_KEYS.includes(fam)) return null;
  return { family: fam as ThemeFamily, variant: varr };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado / armazenamento cheio: o tema vale só nesta sessão */
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function initialTheme(): Theme {
  const saved = safeGet(STORAGE_KEY);
  if (saved === 'custom') {
    // Formato antigo: um lado só. loadCustom() já devolve os dois lados;
    // grava no formato novo e fica no lado que o aluno via.
    const legacy = safeGet(CUSTOM_KEY);
    const custom = loadCustom();
    if (custom && legacy) {
      let side: ThemeVariant = 'light';
      try {
        side = customScheme(JSON.parse(legacy) as Record<string, string>);
      } catch {
        /* JSON quebrado: loadCustom já teria devolvido null */
      }
      saveCustom(custom);
      const t: Theme = `custom-${side}`;
      safeSet(STORAGE_KEY, t);
      return t;
    }
  } else if (saved && parseTheme(saved)) {
    return saved as Theme;
  }
  // Default: família 'default', variante segue prefers-color-scheme.
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'default-light' : 'default-dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [custom, setCustom] = useState<CustomTheme | null>(() => loadCustom());
  const [effects, setEffectsState] = useState(() => safeGet(FX_KEY) !== 'off');
  const parsed = parseTheme(theme, () => custom !== null);
  const family = parsed?.family ?? 'default';
  const variant = parsed?.variant ?? 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // O custom vive em estilos inline: aplicado aqui, e não só na tela de
    // Temas, ele sobrevive ao reload em qualquer página.
    clearCustomInlineStyles();
    if (family === 'custom' && custom) applyCustomTheme(custom[variant]);
    // A barra do navegador/PWA acompanha o fundo do tema escolhido.
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) {
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', bg));
    }
  }, [theme, family, variant, custom]);

  useEffect(() => {
    const root = document.documentElement;
    if (effects) delete root.dataset.fx;
    else root.dataset.fx = 'off';
  }, [effects]);

  const setTheme = useCallback((t: Theme) => {
    safeSet(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const setFamily = useCallback(
    (f: ThemeFamily) => {
      if (f === 'custom' && !custom) return; // nada salvo para aplicar
      setTheme(`${f}-${variant}`);
    },
    [custom, variant, setTheme],
  );

  const setVariant = useCallback(
    (v: ThemeVariant) => setTheme(`${family}-${v}`),
    [family, setTheme],
  );

  // Atalho do header: alterna claro/escuro dentro da família atual (inclusive
  // no personalizado, que agora tem os dois lados).
  const toggle = useCallback(() => {
    setTheme(`${family}-${variant === 'dark' ? 'light' : 'dark'}`);
  }, [family, variant, setTheme]);

  const applyCustom = useCallback(
    (t: CustomTheme, v?: ThemeVariant) => {
      try {
        saveCustom(t);
      } catch {
        /* sem armazenamento: aplica só nesta sessão */
      }
      setCustom(t);
      setTheme(`custom-${v ?? variant}`);
    },
    [variant, setTheme],
  );

  const setEffects = useCallback((on: boolean) => {
    safeSet(FX_KEY, on ? 'on' : 'off');
    setEffectsState(on);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        family,
        variant,
        custom,
        effects,
        setFamily,
        setVariant,
        toggle,
        setTheme,
        applyCustom,
        setEffects,
      }}
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
