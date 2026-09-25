// Página do editor (rota /quadro/:id, issue #32). Carrega o board do storage,
// salva com debounce (500ms) e oferece header com título editável + menu de
// export (.openem / PNG / SVG / PDF). O QuadroEditor é carregado via React.lazy
// para manter mathlive+katex num chunk separado.

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { IconChevronLeft } from '../components/icons';
import type { Board } from '../board/types';
import { getBoard, saveBoard } from '../board/storage';
import { toOpenEm } from '../board/serialize';
import {
  downloadDataUrl,
  downloadSvg,
  downloadText,
  printPDF,
  toPNGDataUrl,
  toSVG,
} from '../board/export';
import ExportModal, { type ExportSettings } from '../board/ExportModal';

const QuadroEditor = lazy(() =>
  import('../board/QuadroEditor').then((m) => ({ default: m.QuadroEditor })),
);

export default function QuadroEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega o board (uma vez por id).
  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setNotFound(false);
    getBoard(id)
      .then((b) => {
        if (cancelled) return;
        if (!b) setNotFound(true);
        else {
          setBoard(b);
          setTitle(b.title);
        }
      })
      .catch(() => !cancelled && setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Salva com debounce. Se o título mudou isoladamente, também salva.
  useEffect(() => {
    if (!board) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveBoard(board);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [board]);

  const onChange = useCallback((b: Board) => {
    setBoard((prev) => (prev && prev.id === b.id ? b : prev));
  }, []);

  function commitTitle() {
    if (!board) return;
    const t = title.trim() || 'Quadro sem título';
    setTitle(t);
    setBoard({ ...board, title: t, updatedAt: new Date().toISOString() });
  }

  async function onExport(kind: 'openem' | 'png' | 'svg' | 'pdf', settings: ExportSettings) {
    if (!board) return;
    setExportModalOpen(false);
    const slug = board.title.replace(/[^\w-]+/g, '_') || 'quadro';
    setBusy(true);
    setError(null);
    try {
      if (kind === 'openem') downloadText(toOpenEm(board), `${slug}.openem`);
      else if (kind === 'svg') downloadSvg(await toSVG(board, settings), `${slug}.svg`);
      else if (kind === 'png') downloadDataUrl(await toPNGDataUrl(board, settings), `${slug}.png`);
      else await printPDF(board, settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar.');
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="font-display text-lg font-bold">Quadro não encontrado</p>
        <p className="text-sm text-muted">
          Ele pode ter sido excluído ou está em outro dispositivo.
        </p>
        <button onClick={() => navigate('/quadro')} className="btn btn-primary">
          Voltar à galeria
        </button>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-bg px-3 py-2">
        <button
          onClick={() => navigate('/quadro')}
          aria-label="Voltar à galeria"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-fg"
        >
          <IconChevronLeft width={18} height={18} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-display text-sm font-bold outline-none focus:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand/40"
          placeholder="Quadro sem título"
        />
        <div className="relative">
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={busy || !board}
            className="btn btn-ghost shrink-0"
          >
            {busy ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </header>

      {error && (
        <p className="border-b border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="relative flex-1 overflow-hidden">
        {board ? (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-sm text-muted">
                Carregando editor…
              </div>
            }
          >
            <QuadroEditor board={board} onChange={onChange} />
          </Suspense>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">
            Carregando…
          </div>
        )}
      </div>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={onExport}
      />
    </div>,
    document.body,
  );
}