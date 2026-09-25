import { useEffect, useRef, useState } from 'react';
import {
  api,
  type PdfOptions,
  type PdfTheme,
  type SimulationFilters,
} from '../api';
import { ErrorBanner } from './ErrorBanner';
import { IconX } from './icons';
import { Portal, useDialog } from './Modal';
import { baixarArquivo } from '../lib/download';
import { PdfThemePicker } from './PdfThemePicker';

/**
 * Exportação do caderno em PDF.
 *
 * O aluno escolhe a cor e o que entra (capa, cartão-resposta, gabarito,
 * comentários) e o backend devolve o arquivo. A cor sai do mesmo catálogo de
 * temas do app, com uma opção livre em hexadecimal para quem quer a cor da
 * própria escola — é o que faz o caderno parecer dele, e não uma exportação
 * genérica.
 */

export interface PdfTarget {
  /** Recorte do simulado (montador) ou nada, quando é um template. */
  filters?: SimulationFilters;
  templateId?: string;
  /** Simulado já feito: imprime exatamente aquelas questões. */
  simulationId?: string;
  title: string;
}

export function SimuladoPdfModal({
  target,
  onClose,
}: {
  target: PdfTarget;
  onClose: () => void;
}) {
  const [temas, setTemas] = useState<PdfTheme[] | null>(null);
  const [tema, setTema] = useState('default');
  const [corLivre, setCorLivre] = useState('');
  const [titulo, setTitulo] = useState(target.title);
  const [aluno, setAluno] = useState('');
  const [cover, setCover] = useState(true);
  const [answerSheet, setAnswerSheet] = useState(true);
  const [answerKey, setAnswerKey] = useState(true);
  const [explanations, setExplanations] = useState(false);
  const [twoColumns, setTwoColumns] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void api
      .pdfThemes()
      .then(setTemas)
      .catch(() => setTemas([]));
  }, []);

  const painelRef = useRef<HTMLDivElement>(null);
  useDialog(painelRef, onClose);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const options: PdfOptions = {
        ...(target.filters ?? {}),
        ...(target.templateId ? { templateId: target.templateId } : {}),
        title: titulo.trim() || target.title,
        ...(aluno.trim() ? { studentName: aluno.trim() } : {}),
        theme: tema,
        ...(corLivre ? { brandColor: corLivre } : {}),
        cover,
        answerSheet,
        answerKey,
        explanations,
        twoColumns,
      };
      const { blob, filename } = await api.simulationPdf(
        options,
        target.simulationId,
      );
      baixarArquivo(blob, filename);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  }

  const opcoes: [string, boolean, (v: boolean) => void, string][] = [
    ['Capa', cover, setCover, 'Logo, descrição do OpENEM e instruções'],
    [
      'Cartão-resposta',
      answerSheet,
      setAnswerSheet,
      'Folha para marcar à caneta',
    ],
    ['Gabarito', answerKey, setAnswerKey, 'No fim do caderno'],
    [
      'Comentários',
      explanations,
      setExplanations,
      'Resolução das questões que têm comentário',
    ],
    [
      'Duas colunas',
      twoColumns,
      setTwoColumns,
      'Como o caderno oficial do ENEM',
    ],
  ];

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Gerar caderno em PDF"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={painelRef}
          tabIndex={-1}
          className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 outline-none sm:rounded-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold">Caderno em PDF</h2>
              <p className="mt-0.5 text-xs text-muted">
                No padrão do ENEM, com a capa e as cores do OpENEM.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="btn btn-ghost shrink-0 px-2"
            >
              <IconX width={16} height={16} />
            </button>
          </div>

          {erro && (
            <div className="mt-3">
              <ErrorBanner message={erro} />
            </div>
          )}

          <div className="mt-4 space-y-4">
            <label className="block text-xs font-medium text-muted">
              Título na capa
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={90}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>

            <label className="block text-xs font-medium text-muted">
              Nome do aluno (opcional)
              <input
                value={aluno}
                onChange={(e) => setAluno(e.target.value)}
                maxLength={60}
                placeholder="Em branco, imprime a linha para preencher à mão"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>

            <div>
              <span className="block text-xs font-medium text-muted">
                Tema de cor
              </span>
              <PdfThemePicker
                temas={temas}
                tema={tema}
                corLivre={corLivre}
                onTema={setTema}
                onCorLivre={setCorLivre}
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-muted">
                O que entra no caderno
              </span>
              <div className="mt-1.5 space-y-1.5">
                {opcoes.map(([label, valor, set, dica]) => (
                  <label
                    key={label}
                    className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={valor}
                      onChange={(e) => set(e.target.checked)}
                      className="mt-0.5 size-4 accent-[var(--color-brand)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{label}</span>
                      <span className="block text-xs text-muted">{dica}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button
              onClick={() => void gerar()}
              disabled={gerando}
              className="btn btn-primary flex-1"
            >
              {gerando ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
