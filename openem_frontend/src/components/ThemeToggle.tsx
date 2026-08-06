import { useEffect, useRef, useState } from 'react';
import { THEMES, useTheme } from '../theme';

/** Seletor de tema em palette (grid) com swatches de cor. */
export default function ThemeToggle() {
  const { theme, setTheme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = THEMES.find((t) => t.key === theme);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Mudar tema"
        title={current?.label ?? 'Tema'}
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        <span
          className="size-4 rounded-full border border-line"
          style={{
            background: `linear-gradient(135deg, ${current?.swatch[0] ?? '#ccc'} 50%, ${current?.swatch[1] ?? '#999'} 50%)`,
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="card card-raised absolute right-0 top-full z-50 mt-2 grid w-64 grid-cols-2 gap-1.5 p-2.5"
        >
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTheme(t.key);
                setOpen(false);
              }}
              role="menuitem"
              className={`flex items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors ${
                theme === t.key
                  ? 'bg-surface-2 text-fg ring-1 ring-brand'
                  : 'text-muted hover:bg-surface-2 hover:text-fg'
              }`}
            >
              <span
                className="size-6 shrink-0 rounded-md border border-line"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                }}
              />
              <span className="min-w-0">
                <span className="block font-medium">{t.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Atalho oculto: duplo-clique no botão alterna claro/escuro rápido. */}
      <button
        onClick={toggle}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
    </div>
  );
}