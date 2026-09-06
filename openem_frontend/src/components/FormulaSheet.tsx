import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Formula } from '../api';
import { Katex } from '../board/Katex';
import { IconCheck, IconCopy, IconStar, IconX } from './icons';
import { areaKey, AREA_DOT, AREA_TEXT, shortSubject } from '../lib/areas';

/**
 * Detalhe de uma fórmula (issue #38): a expressão em tamanho grande e a
 * legenda do que cada símbolo representa — sem ela a cola só serve para quem
 * já sabe ler a expressão.
 *
 * Bottom-sheet no mobile, diálogo centrado no desktop, seguindo o padrão do
 * MoreSheet (backdrop, Esc, foco no painel). A cor da área entra como ponto e
 * texto no cabeçalho, igual às seções da lista — as superfícies seguem
 * neutras (`surface` / `surface-2`), como no resto do app.
 */
export function FormulaSheet({
  formula,
  copied,
  onCopy,
  onToggleFavorite,
  onClose,
}: {
  formula: Formula;
  copied: boolean;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const area = areaKey(formula.subjectName);

  // Esc fecha; o foco vai para o painel para leitores de tela anunciarem.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Fórmula: ${formula.title}`}
    >
      <div
        className="animate-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="animate-sheet card card-raised relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-b-none outline-none sm:max-w-lg sm:rounded-b-[1.1rem]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5">
              <span
                className={`size-2 shrink-0 rounded-full ${AREA_DOT[area]}`}
                aria-hidden
              />
              <span className={`eyebrow ${AREA_TEXT[area]}`}>
                {shortSubject(formula.subjectName)}
              </span>
              {formula.topicName && (
                <span className="eyebrow truncate">· {formula.topicName}</span>
              )}
            </p>
            <h2 className="mt-1.5 font-display text-xl font-bold leading-snug tracking-tight text-pretty">
              {formula.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconX width={16} height={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {/* A expressão em tamanho de leitura, rolável na horizontal. */}
          <div className="slab overflow-x-auto px-4 py-6 text-center text-2xl">
            <span className="inline-block whitespace-nowrap">
              <Katex latex={formula.latex} />
            </span>
          </div>

          {formula.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted text-pretty">
              {formula.description}
            </p>
          )}

          {/* Legenda: o que cada letra significa. */}
          <section className="mt-6">
            <div className="flex items-center gap-2.5">
              <h3 className="eyebrow">Legenda</h3>
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            {formula.symbols.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Esta fórmula ainda não tem legenda cadastrada.
              </p>
            ) : (
              <dl className="mt-3 space-y-1.5">
                {formula.symbols.map((s) => (
                  <div
                    key={s.symbol}
                    className="flex items-start gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <dt className="slab grid min-w-12 shrink-0 place-items-center px-2 py-1.5 text-base">
                      <Katex latex={s.symbol} />
                    </dt>
                    <dd className="min-w-0 flex-1 self-center text-sm leading-snug text-pretty">
                      {s.meaning}
                      {s.unit && (
                        <span className="ml-1.5 whitespace-nowrap font-data text-xs text-muted">
                          [{s.unit}]
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          <button onClick={onCopy} className="btn btn-ghost">
            {copied ? (
              <IconCheck width={15} height={15} className="text-nat" />
            ) : (
              <IconCopy width={15} height={15} />
            )}
            {copied ? 'Copiado' : 'Copiar LaTeX'}
          </button>
          <button
            onClick={onToggleFavorite}
            aria-pressed={formula.favorited}
            className={`btn btn-ghost ml-auto ${formula.favorited ? 'text-hum' : ''}`}
          >
            <IconStar width={15} height={15} filled={formula.favorited} />
            {formula.favorited ? 'Favoritada' : 'Favoritar'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
