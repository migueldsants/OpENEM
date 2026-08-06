import { useEffect, useRef, useState } from 'react';
import { FAMILIES, useTheme } from '../theme';
import { IconMoon, IconSun } from './icons';

/** Seletor de tema: escolhe a família (palette) + alterna claro/escuro. */
export default function ThemeToggle() {
  const { family, variant, setFamily, toggle } = useTheme();
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

  const current = FAMILIES.find((f) => f.key === family);

  return (
    <div ref={ref} className="flex items-center gap-1.5">
      {/* Toggle claro/escuro (dentro da família atual). */}
      <button
        onClick={toggle}
        aria-label={
          variant === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'
        }
        title={variant === 'dark' ? 'Tema claro' : 'Tema escuro'}
        className="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        {variant === 'dark' ? (
          <IconSun width={18} height={18} />
        ) : (
          <IconMoon width={18} height={18} />
        )}
      </button>

      {/* Seletor de família (palette). */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Mudar paleta de tema"
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
            {FAMILIES.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFamily(f.key);
                  setOpen(false);
                }}
                role="menuitem"
                className={`flex items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors ${
                  family === f.key
                    ? 'bg-surface-2 text-fg ring-1 ring-brand'
                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`}
              >
                <span
                  className="size-6 shrink-0 rounded-md border border-line"
                  style={{
                    background: `linear-gradient(135deg, ${f.swatch[0]} 50%, ${f.swatch[1]} 50%)`,
                  }}
                />
                <span className="block font-medium">{f.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}