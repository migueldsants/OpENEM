import { useEffect, useState } from 'react';
import { useTheme } from '../theme';
import {
  applyCustomTheme,
  clearCustomInlineStyles,
  clearStoredCustom,
  loadCustom,
  normalizeColor,
  readCurrentTokens,
  saveCustom,
  TOKENS,
  validateCustomJson,
  type ThemeJson,
} from '../theme-custom';

const THEME_KEY = 'openem.theme';

export default function ThemeCustomizer() {
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ThemeJson>({});
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Carrega o tema custom salvo ao montar, se houver.
  useEffect(() => {
    const saved = loadCustom();
    if (saved && localStorage.getItem(THEME_KEY) === 'custom') {
      applyCustomTheme(saved);
      setDraft(saved);
    }
  }, []);

  // Limpa qualquer nota de "salvo" depois de uns segundos.
  useEffect(() => {
    if (!savedNote) return;
    const id = setTimeout(() => setSavedNote(null), 2500);
    return () => clearTimeout(id);
  }, [savedNote]);

  function startEditing() {
    setDraft(readCurrentTokens());
    setEditing(true);
    setError(null);
    setSavedNote(null);
  }

  function update(key: string, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    // Preview em tempo real (mutação intencional do DOM).
    document.documentElement.dataset.theme = 'custom';
    applyCustomTheme(next);
  }

  function save() {
    try {
      saveCustom(draft);
      localStorage.setItem(THEME_KEY, 'custom');
      setError(null);
      setEditing(false);
      setSavedNote('Tema personalizado salvo.');
    } catch {
      setError('Não foi possível salvar o tema.');
    }
  }

  function cancel() {
    // Restaura o tema anterior (custom salvo ou o tema pronto selecionado).
    clearCustomInlineStyles();
    const saved = loadCustom();
    const currentKey = localStorage.getItem(THEME_KEY);
    if (saved && currentKey === 'custom') {
      applyCustomTheme(saved);
      setDraft(saved);
    } else {
      // Volta para o tema pronto previamente selecionado (não 'custom').
      document.documentElement.dataset.theme = (currentKey && currentKey !== 'custom')
        ? currentKey
        : 'default-light';
    }
    setEditing(false);
    setError(null);
  }

  function reset() {
    clearCustomInlineStyles();
    clearStoredCustom();
    localStorage.setItem(THEME_KEY, 'default-light');
    document.documentElement.dataset.theme = 'default-light';
    setDraft({});
    setEditing(false);
    setError(null);
    setSavedNote('Tema resetado para o padrão.');
  }

  function exportJson() {
    const json = JSON.stringify(draft, null, 2);
    navigator.clipboard
      ?.writeText(json)
      .then(() => setSavedNote('JSON copiado para a área de transferência.'))
      .catch(() => {
        /* clipboard pode estar indisponível */
      });
    setImportText(json);
    setShowImport(true);
  }

  function importJson() {
    try {
      const valid = validateCustomJson(importText);
      setDraft(valid);
      document.documentElement.dataset.theme = 'custom';
      applyCustomTheme(valid);
      setError(null);
      setSavedNote('JSON aplicado — lembre-se de salvar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'JSON inválido');
    }
  }

  const isCustomActive = theme === 'custom' || !!loadCustom();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Tema personalizado</p>
          <p className="mt-0.5 text-xs text-muted">
            Ajuste cada cor ou importe um JSON de tema.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEditing}
            className="btn btn-primary text-sm"
          >
            {isCustomActive ? 'Editar' : 'Personalizar'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancel}
              className="btn btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="btn btn-primary text-sm"
            >
              Salvar
            </button>
          </div>
        )}
      </div>

      {savedNote && (
        <p className="mt-3 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          {savedNote}
        </p>
      )}

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
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                    aria-label={t.label}
                  />
                  <input
                    type="text"
                    value={draft[t.key] ?? ''}
                    onChange={(e) => update(t.key, e.target.value)}
                    className="input w-full font-mono text-xs"
                    placeholder="#000000"
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={exportJson}
              className="btn btn-ghost text-sm"
            >
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={() => setShowImport((s) => !s)}
              className="btn btn-ghost text-sm"
            >
              {showImport ? 'Ocultar importar' : 'Importar JSON'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="btn btn-ghost text-sm text-red"
            >
              Resetar
            </button>
          </div>

          {showImport && (
            <div className="space-y-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="input font-mono text-xs"
                placeholder='{"brand":"#ff0000","bg":"#ffffff",...}'
              />
              <button
                type="button"
                onClick={importJson}
                className="btn btn-primary text-sm"
              >
                Aplicar JSON
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}