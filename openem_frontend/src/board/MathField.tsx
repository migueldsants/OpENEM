// Editor de fórmula WYSIWYG (MathLive, lazy) + paleta de símbolos ENEM.
// MathLive registra o custom element <math-field> ao ser importado.

import { useEffect, useRef, useState } from 'react';
import type { MathFieldElement } from './mathlive';

/** Snippets da paleta ENEM — inseridos no cursor via executeCommand('insert'). */
const ENEM_PALETTE: { label: string; latex: string; title: string }[] = [
  { label: 'Δx', latex: '\\Delta x', title: 'Delta' },
  { label: '∫', latex: '\\int', title: 'Integral' },
  { label: '√', latex: '\\sqrt{}', title: 'Raiz' },
  { label: 'a/b', latex: '\\frac{}{}', title: 'Fração' },
  { label: 'x²', latex: '^{}', title: 'Potência' },
  { label: 'xₙ', latex: '_{}', title: 'Subscrito' },
  { label: 'log', latex: '\\log', title: 'Logaritmo' },
  { label: 'Σ', latex: '\\sum', title: 'Somatório' },
  { label: 'π', latex: '\\pi', title: 'Pi' },
  { label: 'θ', latex: '\\theta', title: 'Teta' },
  { label: 'α', latex: '\\alpha', title: 'Alfa' },
  { label: '°', latex: '^{\\circ}', title: 'Grau' },
  { label: '≠', latex: '\\neq', title: 'Diferente' },
  { label: '≈', latex: '\\approx', title: 'Aproximado' },
  { label: '±', latex: '\\pm', title: 'Mais ou menos' },
  { label: '→', latex: '\\rightarrow', title: 'Seta' },
];

export function MathField({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (latex: string) => void;
  onCommit?: () => void;
}) {
  const ref = useRef<MathFieldElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('mathlive')
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sincroniza valor externo → math-field (só quando difere, p/ não resetar cursor).
  useEffect(() => {
    const mf = ref.current;
    if (mf && typeof mf.setValue === 'function' && mf.value !== value) {
      mf.setValue(value);
    }
  }, [value, ready]);

  const insert = (latex: string) => {
    const mf = ref.current;
    if (mf && typeof mf.executeCommand === 'function') {
      mf.executeCommand('insert', latex);
      mf.focus?.();
      onChange(mf.value ?? '');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {ready ? (
        <math-field
          ref={ref}
          onInput={(e: React.FormEvent<MathFieldElement>) => {
            onChange(e.currentTarget.value ?? '');
          }}
          style={{
            display: 'block',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '6px 8px',
            fontSize: 18,
            background: 'var(--surface)',
            color: 'var(--fg)',
          }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          rows={2}
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 font-mono text-sm"
          placeholder="LaTeX (mathlive indisponível)…"
        />
      )}
      <div className="flex flex-wrap gap-1">
        {ENEM_PALETTE.map((p) => (
          <button
            key={p.label}
            type="button"
            title={p.title}
            onClick={() => insert(p.latex)}
            className="chip font-mono"
          >
            {p.label}
          </button>
        ))}
      </div>
      {ready && (
        <button type="button" onClick={onCommit} className="btn btn-primary self-start">
          Concluir
        </button>
      )}
    </div>
  );
}