import { useRef, useState } from 'react';
import { api } from '../api';
import { ErrorBanner } from './ErrorBanner';
import { Portal, useDialog } from './Modal';

/** Motivos prontos: um toque preenche o campo, que continua editável. */
const MOTIVOS = [
  'Ofensa ou discurso de ódio',
  'Assédio ou ameaça',
  'Dados pessoais expostos',
  'Spam ou propaganda',
];

/**
 * Denúncia de um tópico (`postId` nulo) ou de uma resposta do fórum. O motivo
 * vai para quem modera a instalação; o autor não é avisado.
 */
export function DenunciarDialog({
  threadId,
  postId,
  onClose,
}: {
  threadId: string;
  postId: string | null;
  onClose: () => void;
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useDialog(painelRef, onClose);
  const valido = motivo.trim().length >= 3;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.reportForum(threadId, postId, motivo.trim());
      setEnviada(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível denunciar.');
    } finally {
      setEnviando(false);
    }
  }

  const titulo = postId ? 'Denunciar resposta' : 'Denunciar tópico';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
        onClick={onClose}
      >
        <div
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          tabIndex={-1}
          className="card card-raised w-full max-w-md p-5 outline-none animate-rise"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-lg font-extrabold tracking-tight">
            {titulo}
          </h2>
          {enviada ? (
            <>
              <p role="status" className="mt-2 text-sm leading-relaxed text-muted">
                Denúncia enviada. Quem cuida da comunidade vai avaliar. Obrigado
                por avisar.
              </p>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={onClose} className="btn btn-primary">
                  Fechar
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={enviar} className="mt-2 space-y-3">
              <p className="text-sm leading-relaxed text-muted">
                Conte o que há de errado. O autor não fica sabendo quem
                denunciou.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-active={motivo === m}
                    onClick={() => setMotivo(m)}
                    className="chip"
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="eyebrow">Motivo</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="input mt-1.5 resize-y"
                />
              </label>
              <ErrorBanner message={erro} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn btn-ghost">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!valido || enviando}
                  className="btn btn-primary"
                >
                  {enviando ? 'Enviando…' : 'Enviar denúncia'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
