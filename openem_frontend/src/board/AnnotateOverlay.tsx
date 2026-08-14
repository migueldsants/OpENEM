// Overlay "Anotar" no player de Questões (issue #32, AC5). Full-screen que
// carrega/cria um board scratch vinculado ao questionId, reutiliza o
// QuadroEditor em modo folha e salva local. Não toca no estado de resposta.

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '../components/icons';
import type { Board } from './types';
import { createBoard } from './types';
import { cryptoRandomId } from './serialize';
import { getScratchByQuestion, saveBoard } from './storage';

const QuadroEditor = lazy(() =>
  import('./QuadroEditor').then((m) => ({ default: m.QuadroEditor })),
);

export function AnnotateOverlay({
  questionId,
  questionTitle,
  onClose,
}: {
  questionId: string;
  questionTitle: string;
  onClose: () => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScratchByQuestion(questionId).then((b) => {
      if (cancelled) return;
      if (b) setBoard(b);
      else {
        setBoard(
          createBoard({
            id: cryptoRandomId(),
            title: `Anotações — ${questionTitle.slice(0, 60)}`,
            questionId,
          }),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [questionId, questionTitle]);

  const onChange = useCallback((b: Board) => {
    setBoard((prev) => (prev && prev.id === b.id ? b : prev));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveBoard(b), 500);
  }, []);

  // Salva imediato ao fechar.
  const handleClose = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setBoard((cur) => {
      if (cur) void saveBoard(cur);
      return cur;
    });
    onClose();
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur">
        <button
          onClick={handleClose}
          aria-label="Fechar anotações"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-fg"
        >
          <IconX width={18} height={18} />
        </button>
        <p className="min-w-0 flex-1 truncate font-display text-sm font-bold">
          {board?.title ?? 'Anotações'}
        </p>
        <span className="chip">salvo neste dispositivo</span>
      </header>

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
    </div>,
    document.body,
  );
}