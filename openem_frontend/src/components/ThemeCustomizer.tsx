import { useEffect, useState } from 'react';
import { useTheme } from '../theme';

/** Tokens customizaveis (nome -> label amigavel). */
const TOKENS: { key: string; label: string }[] = [
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

type ThemeJson = Record<string, string>;

const STORAGE_KEY = 'openem.theme.custom';
const THEME_KEY = 'openem.theme';

function loadCustom(): ThemeJson | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeJson) : null;
  } catch {
    return null;
  }
}

function readCurrentTokens(): ThemeJson {
  const style = getComputedStyle(document.documentElement);
  const out: ThemeJson = {};
  for (const t of TOKENS) {
    const v = style.getPropertyValue(`--${t.key}`).trim();
    if (v) out[t.key] = v;
  }
  return out;
}

function applyCustomTheme(json: ThemeJson) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(json)) {
    root.style.setProperty(`--${k}`, v);
  }
}

function clearCustomTheme() {
  const root = document.documentElement;
  for (const t of TOKENS) {
    root.style.removeProperty(`--${t.key}`);
  }
}

export default function ThemeCustomizer() {
  const { theme, setTheme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ThemeJson>({});
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o tema custom salvo ao montar, se houver.
  useEffect(() => {
    const saved = loadCustom();
    if (saved && localStorage.getItem(THEME_KEY) === 'custom') {
      applyCustomTheme(saved);
      setDraft(saved);
    }
  }, []);

  function startEditing() {
    setDraft(readCurrentTokens());
    setEditing(true);
    setError(null);
  }

  function update(key: string, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    // Preview em tempo real (mutacao intencional do DOM).
    // eslint-disable-next-line react-hooks/immutability
    document.documentElement.dataset.theme = 'custom';
    applyCustomTheme(next);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      localStorage.setItem(THEME_KEY, 'custom');
      setError(null);
      setEditing(false);
    } catch {
      setError('Não foi possível salvar o tema.');
    }
  }

  function cancel() {
    // Restaura o tema anterior (custom salvo ou o tema pronto selecionado).
    clearCustomTheme();
    const saved = loadCustom();
    if (saved && localStorage.getItem(THEME_KEY) === 'custom') {
      applyCustomTheme(saved);
    } else {
      setTheme(theme === 'custom' ? 'default-light' : theme);
    }
    setEditing(false);
    setError(null);
  }

  function reset() {
    clearCustomTheme();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(THEME_KEY, 'default-light');
    setTheme('default-light');
    setDraft({});
    setEditing(false);
    setError(null);
  }

  function exportJson() {
    const json = JSON.stringify(draft, null, 2);
    navigator.clipboard
      ?.writeText(json)
      .catch(() => {
        /* clipboard pode estar indisponivel */
      });
    setImportText(json);
    setShowImport(true);
  }

  function importJson() {
    try {
      const parsed = JSON.parse(importText) as ThemeJson;
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON inválido');
      }
      // Valida chaves conhecidas.
      const valid: ThemeJson = {};
      for (const t of TOKENS) {
        if (typeof parsed[t.key] === 'string') valid[t.key] = parsed[t.key];
      }
      if (Object.keys(valid).length === 0) throw new Error('Nenhum token válido');
      setDraft(valid);
      applyCustomTheme(valid);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido');
    }
  }

  const isCustom = theme === 'custom' || !!loadCustom();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Tema personalizado</p>
          <p className="mt-0.5 text-xs text-muted">
            Ajuste cada cor ou importe um JSON de tema.
          </p>
        </div>
        {!editing ? (
          <button onClick={startEditing} className="btn btn-ghost text-sm">
            Personalizar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={cancel} className="btn btn-ghost text-sm">
              Cancelar
            </button>
            <button onClick={save} className="btn btn-primary text-sm">
              Salvar
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}

      {editing && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TOKENS.map((t) => (
              <label key={t.key} className="block">
                <span className="eyebrow">{t.label}</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeColor(draft[t.key] ?? '')}
                    onChange={(e) => update(t.key, e.target.value)}
                    className="size-9 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                    aria-label={t.label}
                  />
                  <input
                    type="text"
                    value={draft[t.key] ?? ''}
                    onChange={(e) => update(t.key, e.target.value)}
                    className="input w-full font-data text-xs"
                    placeholder="#000000"
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button onClick={exportJson} className="btn btn-ghost text-sm">
              Exportar JSON
            </button>
            <button
              onClick={() => setShowImport((s) => !s)}
              className="btn btn-ghost text-sm"
            >
              {showImport ? 'Ocultar importar' : 'Importar JSON'}
            </button>
            {isCustom && (
              <button
                onClick={reset}
                className="btn btn-ghost text-sm text-red"
              >
                Resetar
              </button>
            )}
          </div>

          {showImport && (
            <div className="space-y-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="input font-data text-xs"
                placeholder='{"brand":"#ff0000","bg":"#ffffff",...}'
              />
              <button onClick={importJson} className="btn btn-primary text-sm">
                Aplicar JSON
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Garante string de cor valida para o input type="color" (que aceita só #rrggbb). */
function normalizeColor(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  // Tenta ler do computed style como fallback.
  return '#000000';
}