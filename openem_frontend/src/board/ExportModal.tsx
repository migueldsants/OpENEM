// Modal de exportação do Quadro de Estudos (issue #32).
// Permite configurar fundo (grid/dots/sem fundo) e escala antes de exportar.

import { useRef, useState } from 'react';
import type { ExportOptions } from '../board/export';
import { IconX } from '../components/icons';
import { Portal, useDialog } from '../components/Modal';

export interface ExportSettings extends ExportOptions {
  background: 'grid' | 'dots' | 'blank';
  scale: number;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (kind: 'openem' | 'png' | 'svg' | 'pdf', settings: ExportSettings) => void;
}

const SCALES = [1, 2, 3, 4];

export default function ExportModal({ open, ...props }: ExportModalProps) {
  if (!open) return null;
  return <ExportDialog {...props} />;
}

function ExportDialog({ onClose, onExport }: Omit<ExportModalProps, 'open'>) {
  const [background, setBackground] = useState<ExportSettings['background']>('grid');
  const [scale, setScale] = useState(2);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialog(panelRef, onClose);

  function handleExport(kind: 'openem' | 'png' | 'svg' | 'pdf') {
    onExport(kind, { background, scale });
  }

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
        aria-hidden
      />
      {/* Modal: o clique fora do painel cai nesta camada, que fica por cima do backdrop. */}
      <div
        className="fixed inset-0 z-[80] grid place-items-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)] outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 id="export-modal-title" className="font-display text-base font-bold">
              Exportar quadro
            </h2>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Fechar"
            >
              <IconX width={16} height={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-5 px-5 py-4">
            {/* Fundo */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Fundo
              </legend>
              <div className="seg">
                {([
                  ['grid', 'Grade'],
                  ['dots', 'Pontos'],
                  ['blank', 'Sem fundo'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    data-active={background === val}
                    onClick={() => setBackground(val)}
                    className="px-3 py-1.5 text-xs"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Escala (só para PNG/PDF) */}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Resolução (PNG/PDF)
              </legend>
              <div className="seg">
                {SCALES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-active={scale === s}
                    onClick={() => setScale(s)}
                    className="px-3 py-1.5 text-xs font-data"
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">
                {scale}x gera imagem {scale}× maior que o tamanho original.
              </p>
            </fieldset>
          </div>

          {/* Rodapé: botões de export */}
          <div className="flex flex-col gap-1 border-t border-line px-3 py-3">
            {([
              ['openem', 'Exportar .openem', 'Formato nativo (lossless)'],
              ['png', 'Exportar PNG', `Resolução ${scale}x`],
              ['svg', 'Exportar SVG', 'Vetorial editável'],
              ['pdf', 'Exportar PDF', 'Pronto para imprimir'],
            ] as const).map(([kind, label, desc]) => (
              <button
                key={kind}
                onClick={() => handleExport(kind)}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
