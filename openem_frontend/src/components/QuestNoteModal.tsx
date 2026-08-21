import { useEffect, useRef, useState } from 'react';
import { api, type QuestionNote } from '../api';
import { IconCheck, IconTrash, IconX } from './icons';

interface Props {
  questionId: string;
  questionStatement: string;
  onClose: () => void;
}

/**
 * Overlay para anotar/editar uma nota pessoal de uma questão (Markdown livre).
 * Carrega a nota existente ao abrir; salva via PUT /question-notes.
 */
export function QuestNoteModal({ questionId, questionStatement, onClose }: Props) {
  const [content, setContent] = useState('');
  const [existing, setExisting] = useState<QuestionNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const note = await api.questionNoteFor(questionId);
        setExisting(note ?? null);
        setContent(note?.content ?? '');
      } catch {
        /* sem nota prévia */
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId]);

  useEffect(() => {
    if (!loading) textareaRef.current?.focus();
  }, [loading]);

  async function save() {
    if (!content.trim()) {
      await remove();
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const note = await api.saveQuestionNote(questionId, content.trim());
      setExisting(note);
      setSaved(true);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await api.removeQuestionNote(questionId);
      setExisting(null);
      setContent('');
      setTimeout(() => onClose(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.');
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void save();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Anotação pessoal"
    >
      <div
        className="card card-raised w-full max-w-lg animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Anotação pessoal</p>
            <p className="truncate text-sm text-muted">{questionStatement}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar anotação"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconX width={18} height={18} />
          </button>
        </header>

        <div className="px-5 py-4">
          {loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-surface-2" />
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={onKeyDown}
              rows={6}
              placeholder="Escreva suas observações sobre esta questão (suporta Markdown)…"
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Conteúdo da anotação"
            />
          )}
          <p className="mt-1 text-right text-xs text-muted">
            Ctrl+Enter para salvar
          </p>
          {error && (
            <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
          {existing && (
            <button
              onClick={() => void remove()}
              disabled={saving}
              className="btn btn-ghost text-red"
            >
              <IconTrash width={16} height={16} />
              Excluir
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="btn btn-ghost"
          >
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving || loading}
            className="btn btn-primary"
          >
            {saving ? (
              'Salvando…'
            ) : saved ? (
              <>
                <IconCheck width={16} height={16} /> Salvo!
              </>
            ) : (
              'Salvar nota'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
