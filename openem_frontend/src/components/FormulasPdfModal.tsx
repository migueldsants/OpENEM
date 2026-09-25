import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Formula, type PdfTheme } from '../api';
import { baixarArquivo } from '../lib/download';
import {
  groupBySubject,
  selectedFormulas,
  subjectState,
  toggle,
  toggleSubject,
  topicKey,
} from '../lib/formula-selection';
import { ErrorBanner } from './ErrorBanner';
import { IconCheck, IconChevronDown, IconStar, IconX } from './icons';
import { Portal, useDialog } from './Modal';
import { PdfThemePicker } from './PdfThemePicker';
import { Skeleton } from './Skeleton';

/**
 * Caderno de fórmulas em PDF: o aluno monta a própria "cola".
 *
 * Escolhe por matéria e assunto, pode ficar só com as favoritas e ainda tirar
 * fórmula por fórmula. Depois decide o que aparece (capa, sumário,
 * explicação, legenda, colunas) e a cor. A contagem no rodapé acompanha cada
 * escolha, para o botão nunca gerar um PDF vazio.
 */
export function FormulasPdfModal({
  onClose,
  initialSubjectId,
  initialOnlyFavorites = false,
}: {
  onClose: () => void;
  /** Matéria filtrada na tela: o caderno já abre só com ela. */
  initialSubjectId?: string;
  initialOnlyFavorites?: boolean;
}) {
  const [formulas, setFormulas] = useState<Formula[] | null>(null);
  const [temas, setTemas] = useState<PdfTheme[] | null>(null);
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [onlyFavorites, setOnlyFavorites] = useState(initialOnlyFavorites);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [verLista, setVerLista] = useState(false);

  const [titulo, setTitulo] = useState('Fórmulas do ENEM');
  const [aluno, setAluno] = useState('');
  const [tema, setTema] = useState('default');
  const [corLivre, setCorLivre] = useState('');
  const [cover, setCover] = useState(true);
  const [toc, setToc] = useState(true);
  const [descriptions, setDescriptions] = useState(true);
  const [legend, setLegend] = useState(true);
  const [twoColumns, setTwoColumns] = useState(true);

  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const painelRef = useRef<HTMLDivElement>(null);
  useDialog(painelRef, onClose);

  useEffect(() => {
    // A lista completa: a tela pode estar filtrada, o caderno não.
    void api
      .formulas()
      .then((lista) => {
        setFormulas(lista);
        setTopics(
          new Set(
            lista
              .filter((f) => !initialSubjectId || f.subjectId === initialSubjectId)
              .map(topicKey),
          ),
        );
      })
      .catch((e: unknown) =>
        setErro(
          e instanceof Error ? e.message : 'Não foi possível carregar as fórmulas.',
        ),
      );
    void api
      .pdfThemes()
      .then(setTemas)
      .catch(() => setTemas([]));
  }, [initialSubjectId]);

  const grupos = useMemo(() => groupBySubject(formulas ?? []), [formulas]);
  const escolhidas = useMemo(
    () => selectedFormulas(formulas ?? [], topics, onlyFavorites, excluded),
    [formulas, topics, onlyFavorites, excluded],
  );
  const favoritas = (formulas ?? []).filter((f) => f.favorited).length;
  const materiasEscolhidas = new Set(escolhidas.map((f) => f.subjectId)).size;
  // Fórmulas que a seleção de assuntos/favoritas deixa entrar (a lista fina
  // mostra estas, e o aluno desmarca o que não quer).
  const candidatas = useMemo(
    () => selectedFormulas(formulas ?? [], topics, onlyFavorites, new Set()),
    [formulas, topics, onlyFavorites],
  );

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const { blob, filename } = await api.formulasPdf({
        formulaIds: escolhidas.map((f) => f.id),
        title: titulo.trim() || 'Fórmulas do ENEM',
        ...(aluno.trim() ? { studentName: aluno.trim() } : {}),
        theme: tema,
        ...(corLivre ? { brandColor: corLivre } : {}),
        cover,
        toc,
        descriptions,
        legend,
        twoColumns,
      });
      baixarArquivo(blob, filename);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  }

  const opcoes: [string, boolean, (v: boolean) => void, string][] = [
    ['Capa', cover, setCover, 'Título, matérias do caderno e dicas de uso'],
    ['Sumário', toc, setToc, 'Cada matéria e assunto com a página'],
    ['Explicação', descriptions, setDescriptions, 'Quando usar cada fórmula'],
    ['Legenda dos símbolos', legend, setLegend, 'O que cada letra significa, com a unidade'],
    ['Duas colunas', twoColumns, setTwoColumns, 'Cabe mais em cada folha'],
  ];

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={painelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="formulas-pdf-titulo"
          className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface outline-none sm:rounded-2xl"
        >
          <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <h2 id="formulas-pdf-titulo" className="font-display text-lg font-bold">
                Caderno de fórmulas em PDF
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Escolha o que entra, como aparece e a cor. Pronto para imprimir.
              </p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="btn btn-ghost shrink-0 px-2">
              <IconX width={16} height={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <ErrorBanner message={erro} />

            {/* ------------------------------------------------ o que entra */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">Matérias e assuntos</h3>
                {formulas && (
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="font-medium text-brand hover:underline"
                      onClick={() => setTopics(new Set(formulas.map(topicKey)))}
                    >
                      Marcar tudo
                    </button>
                    <button
                      type="button"
                      className="font-medium text-muted hover:text-fg hover:underline"
                      onClick={() => setTopics(new Set())}
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {!formulas ? (
                <div className="space-y-2" aria-busy>
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {grupos.map((s) => {
                    const estado = subjectState(s, topics);
                    return (
                      <li key={s.id} className="rounded-xl border border-line p-3">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={estado === 'all'}
                            ref={(el) => {
                              if (el) el.indeterminate = estado === 'some';
                            }}
                            onChange={() => setTopics((t) => toggleSubject(s, t))}
                            className="size-4 accent-[var(--color-brand)]"
                          />
                          <span className="flex-1 text-sm font-semibold">{s.name}</span>
                          <span className="text-xs text-muted">
                            {s.total} {s.total === 1 ? 'fórmula' : 'fórmulas'}
                          </span>
                        </label>
                        {estado !== 'none' && s.topics.length > 1 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 pl-6">
                            {s.topics.map((t) => {
                              const on = topics.has(t.key);
                              return (
                                <button
                                  key={t.key}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => setTopics((cur) => toggle(cur, t.key))}
                                  className={`chip text-xs ${on ? 'ring-1 ring-brand' : 'text-muted'}`}
                                >
                                  {on && <IconCheck width={11} height={11} />}
                                  {t.name}
                                  <span className="tabular-nums text-muted">{t.formulas.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={onlyFavorites}
                  onChange={(e) => setOnlyFavorites(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--color-brand)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <IconStar width={14} height={14} filled className="text-warning" />
                    Só as minhas favoritas
                  </span>
                  <span className="block text-xs text-muted">
                    {favoritas === 0
                      ? 'Você ainda não favoritou nenhuma fórmula.'
                      : `${favoritas} ${favoritas === 1 ? 'favorita' : 'favoritas'} no total`}
                  </span>
                </span>
              </label>

              {/* Ajuste fino: tirar fórmula por fórmula. */}
              {formulas && candidatas.length > 0 && (
                <div className="rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => setVerLista((v) => !v)}
                    aria-expanded={verLista}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium"
                  >
                    Escolher fórmula por fórmula
                    <span className="flex items-center gap-2 text-xs font-normal text-muted">
                      {excluded.size > 0 && `${excluded.size} desmarcada${excluded.size === 1 ? '' : 's'}`}
                      <IconChevronDown
                        width={16}
                        height={16}
                        className={`transition-transform ${verLista ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </button>
                  {verLista && (
                    <div className="max-h-72 space-y-3 overflow-y-auto border-t border-line px-3 py-3">
                      {groupBySubject(candidatas).map((s) => (
                        <div key={s.id}>
                          <p className="eyebrow mb-1">{s.name}</p>
                          <ul className="space-y-0.5">
                            {s.topics.flatMap((t) => t.formulas).map((f) => (
                              <li key={f.id}>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-surface-2">
                                  <input
                                    type="checkbox"
                                    checked={!excluded.has(f.id)}
                                    onChange={() => setExcluded((cur) => toggle(cur, f.id))}
                                    className="size-4 accent-[var(--color-brand)]"
                                  />
                                  <span className="min-w-0 flex-1 truncate">{f.title}</span>
                                  {f.topicName && (
                                    <span className="hidden shrink-0 text-xs text-muted sm:inline">
                                      {f.topicName}
                                    </span>
                                  )}
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ------------------------------------------- o que aparece */}
            <section>
              <h3 className="text-sm font-semibold">O que aparece no caderno</h3>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {opcoes.map(([label, valor, set, dica]) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line px-3 py-2 text-sm"
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
            </section>

            {/* ------------------------------------------------ aparência */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Capa e cor</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-muted">
                  Título
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    maxLength={80}
                    className="input mt-1"
                  />
                </label>
                <label className="block text-xs font-medium text-muted">
                  Seu nome (opcional)
                  <input
                    value={aluno}
                    onChange={(e) => setAluno(e.target.value)}
                    maxLength={60}
                    placeholder="Em branco, sai uma linha para escrever"
                    className="input mt-1"
                  />
                </label>
              </div>
              <div>
                <span className="block text-xs font-medium text-muted">Cor</span>
                <PdfThemePicker
                  temas={temas}
                  tema={tema}
                  corLivre={corLivre}
                  onTema={setTema}
                  onCorLivre={setCorLivre}
                />
              </div>
            </section>
          </div>

          {/* Rodapé fixo: a contagem acompanha cada escolha. */}
          <footer className="flex items-center gap-3 border-t border-line bg-surface px-5 py-3.5">
            <p className="min-w-0 flex-1 text-sm" aria-live="polite">
              {formulas ? (
                escolhidas.length === 0 ? (
                  <span className="text-danger">Nenhuma fórmula escolhida</span>
                ) : (
                  <>
                    <span className="font-semibold tabular-nums">{escolhidas.length}</span>{' '}
                    {escolhidas.length === 1 ? 'fórmula' : 'fórmulas'}
                    <span className="text-muted">
                      {' '}
                      · {materiasEscolhidas} {materiasEscolhidas === 1 ? 'matéria' : 'matérias'}
                    </span>
                  </>
                )
              ) : (
                <span className="text-muted">Carregando fórmulas…</span>
              )}
            </p>
            <button onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button
              onClick={() => void gerar()}
              disabled={gerando || escolhidas.length === 0}
              className="btn btn-primary"
            >
              {gerando ? 'Gerando…' : 'Gerar PDF'}
            </button>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
