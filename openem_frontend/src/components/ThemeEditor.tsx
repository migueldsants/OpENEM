import { useMemo, useState } from 'react';
import { isHex } from '../lib/color';
import {
  contrastIssues,
  deriveVariant,
  paletteFromBrand,
  type Tokens,
} from '../lib/theme-derive';
import {
  exportCustomJson,
  normalizeColor,
  TOKENS,
  validateCustomJson,
  type CustomTheme,
} from '../theme-custom';
import type { ThemeVariant } from '../theme';
import { ErrorBanner } from './ErrorBanner';
import { IconAlert, IconWand } from './icons';
import { ThemePreview } from './ThemePreview';

const SIDES: { key: ThemeVariant; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
];

/**
 * Editor do tema personalizado: nome, os dois lados (claro e escuro), gerar
 * a partir de uma cor e avisos de contraste. A prévia fica no próprio editor,
 * então nada muda no resto do app até salvar.
 */
export default function ThemeEditor({
  initial,
  saving = false,
  error,
  onSave,
  onCancel,
}: {
  initial: CustomTheme;
  saving?: boolean;
  error?: string | null;
  onSave: (theme: CustomTheme) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [side, setSide] = useState<ThemeVariant>('light');
  const [sides, setSides] = useState<Record<ThemeVariant, Tokens>>({
    light: initial.light,
    dark: initial.dark,
  });
  const [seed, setSeed] = useState(normalizeColor(initial.light.brand ?? '#d91748'));
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const tokens = sides[side];
  const other: ThemeVariant = side === 'light' ? 'dark' : 'light';
  const issues = useMemo(() => contrastIssues(tokens), [tokens]);
  const invalid = TOKENS.filter((t) => !isHex(tokens[t.key] ?? ''));
  const nameOk = name.trim().length >= 2 && name.trim().length <= 40;
  const allHex = SIDES.every((s) => TOKENS.every((t) => isHex(sides[s.key][t.key] ?? '')));

  function update(key: string, value: string) {
    setSides((prev) => ({ ...prev, [side]: { ...prev[side], [key]: value } }));
  }

  function generate() {
    setSides({ light: paletteFromBrand(seed, 'light'), dark: paletteFromBrand(seed, 'dark') });
    setNote('Paleta gerada nos dois lados. Ajuste o que quiser.');
  }

  function rebuildOther() {
    setSides((prev) => ({ ...prev, [other]: deriveVariant(prev[side], other) }));
    setNote(`Lado ${other === 'light' ? 'claro' : 'escuro'} recriado a partir deste.`);
  }

  function current(): CustomTheme {
    return { ...initial, v: 2, name: name.trim(), light: sides.light, dark: sides.dark };
  }

  function openJson() {
    setJsonText(exportCustomJson(current()));
    setShowJson((s) => !s);
    setLocalError(null);
  }

  function importJson() {
    try {
      const t = validateCustomJson(jsonText);
      setSides({ light: t.light, dark: t.dark });
      if (t.name) setName(t.name);
      setLocalError(null);
      setNote('JSON aplicado ao rascunho. Lembre-se de salvar.');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'JSON inválido');
    }
  }

  function copyJson() {
    navigator.clipboard
      ?.writeText(jsonText)
      .then(() => setNote('JSON copiado.'))
      .catch(() => {
        /* área de transferência indisponível: o texto segue no campo */
      });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="theme-name" className="text-sm font-medium">
              Nome do tema
            </label>
            <input
              id="theme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="input mt-1.5"
              placeholder="Ex.: Madrugada de estudo"
              aria-describedby="theme-name-help"
            />
            <span id="theme-name-help" className="mt-1 block text-xs text-muted">
              De 2 a 40 caracteres.
            </span>
          </div>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="text-sm font-medium">Gerar a partir de uma cor</span>
              <input
                type="color"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="mt-1.5 block h-10 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                aria-label="Cor base para gerar o tema"
              />
            </label>
            <button type="button" onClick={generate} className="btn btn-ghost">
              <IconWand width={18} height={18} aria-hidden />
              Gerar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSide(s.key)}
              aria-pressed={side === s.key}
              className={`rounded-2xl border p-2 text-left transition-colors ${
                side === s.key ? 'border-brand ring-1 ring-brand' : 'border-line hover:bg-surface-2'
              }`}
            >
              <ThemePreview tokens={sides[s.key]} variant={s.key} />
              <span className="mt-2 block text-xs font-semibold">
                Lado {s.label.toLowerCase()}
                {side === s.key && <span className="font-normal text-muted"> (editando)</span>}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Cores do lado {side === 'light' ? 'claro' : 'escuro'}
          </p>
          <button type="button" onClick={rebuildOther} className="btn btn-ghost text-sm">
            Recriar lado {other === 'light' ? 'claro' : 'escuro'} a partir deste
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOKENS.map((t) => {
            const value = tokens[t.key] ?? '';
            const bad = !isHex(value);
            return (
              <div key={t.key}>
                <label htmlFor={`tok-${t.key}`} className="text-xs font-semibold text-muted">
                  {t.label}
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeColor(value)}
                    onChange={(e) => update(t.key, e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                    aria-label={`${t.label} (seletor)`}
                  />
                  <input
                    id={`tok-${t.key}`}
                    type="text"
                    value={value}
                    onChange={(e) => update(t.key, e.target.value)}
                    aria-invalid={bad}
                    className={`input font-mono text-xs ${bad ? 'border-danger' : ''}`}
                    placeholder="#000000"
                    spellCheck={false}
                  />
                </div>
                {bad && <p className="mt-1 text-xs text-danger">Use o formato #rrggbb.</p>}
              </div>
            );
          })}
        </div>

        {issues.length > 0 && invalid.length === 0 && (
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning" role="status">
            <p className="flex items-center gap-2 font-semibold">
              <IconAlert width={16} height={16} aria-hidden />
              Contraste baixo neste lado
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {issues.map((i) => (
                <li key={i.label}>
                  {i.label}: {i.ratio.toFixed(1).replace('.', ',')}:1 (mínimo{' '}
                  {String(i.min).replace('.', ',')}:1)
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" onClick={openJson} className="btn btn-ghost text-sm">
            {showJson ? 'Ocultar JSON' : 'Importar/exportar JSON'}
          </button>
        </div>

        {showJson && (
          <div className="space-y-2">
            <label htmlFor="theme-json" className="text-xs font-semibold text-muted">
              JSON do tema (aceita também o formato antigo, de um lado só)
            </label>
            <textarea
              id="theme-json"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={8}
              className="input font-mono text-xs"
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={importJson} className="btn btn-primary text-sm">
                Aplicar JSON
              </button>
              <button type="button" onClick={copyJson} className="btn btn-ghost text-sm">
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      {note && (
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand" role="status">
          {note}
        </p>
      )}
      <ErrorBanner message={localError ?? error} />

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(current())}
          className="btn btn-primary"
          disabled={saving || !nameOk || !allHex}
        >
          {saving ? 'Salvando…' : 'Salvar e usar'}
        </button>
      </div>
    </div>
  );
}
