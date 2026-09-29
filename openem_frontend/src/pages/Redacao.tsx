import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  api,
  type EssayAnnotation,
  type EssayPrompt,
  type EssaySubmissionDetail,
  type EssaySubmissionSummary,
  type GamificationDelta,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { SkeletonCard, SkeletonText } from '../components/Skeleton';
import { useDialog } from '../components/Modal';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconPen, IconSparkle } from '../components/icons';
import { useGamification } from '../gamification';
import { PageHeader } from '../components/PageHeader';

// Metadados por competência: rótulo + cor do marca-texto (uma por competência).
const COMP_META = [
  { key: 'c1', short: 'C1', label: 'C1 · Norma culta', color: 'var(--hum)' },
  { key: 'c2', short: 'C2', label: 'C2 · Compreensão do tema', color: 'var(--nat)' },
  { key: 'c3', short: 'C3', label: 'C3 · Argumentação', color: 'var(--mat)' },
  { key: 'c4', short: 'C4', label: 'C4 · Coesão', color: 'var(--lin)' },
  {
    key: 'c5',
    short: 'C5',
    label: 'C5 · Proposta de intervenção',
    color: 'var(--red)',
  },
] as const;

type CompKey = (typeof COMP_META)[number]['key'];

function compColor(competency: number): string {
  return COMP_META[competency - 1]?.color ?? 'var(--muted)';
}

function ScoreCard({
  evaluation,
}: {
  evaluation: NonNullable<EssaySubmissionSummary['evaluation']>;
}) {
  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="font-display text-xl font-extrabold tabular-nums text-success">
        {evaluation.total}
        <span className="text-sm font-semibold text-muted">/1000</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {COMP_META.map(({ key, label, color }) => {
          const value = evaluation[key];
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="w-40 shrink-0 truncate text-muted">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(value / 200) * 100}%`, backgroundColor: color }}
                />
              </span>
              <span className="w-7 shrink-0 text-right font-medium tabular-nums">
                {value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Renderiza a redação com os trechos destacados na cor da competência. */
function HighlightedEssay({
  content,
  annotations,
  selected,
  onSelect,
}: {
  content: string;
  annotations: EssayAnnotation[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const located = annotations
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.start != null && a.end != null)
    .sort((x, y) => (x.a.start ?? 0) - (y.a.start ?? 0));

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const { a, i } of located) {
    const start = a.start as number;
    const end = a.end as number;
    if (start > cursor) {
      nodes.push(<span key={`t-${cursor}`}>{content.slice(cursor, start)}</span>);
    }
    const color = compColor(a.competency);
    const isSel = selected === i;
    nodes.push(
      <mark
        key={`m-${i}`}
        id={`mark-${i}`}
        onClick={() => onSelect(i)}
        title={a.comment}
        className="cursor-pointer rounded-lg px-0.5 text-fg transition-shadow"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)`,
          borderBottom: `2px solid ${color}`,
          boxShadow: isSel ? `0 0 0 2px ${color}` : undefined,
        }}
      >
        {content.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < content.length) {
    nodes.push(<span key="t-end">{content.slice(cursor)}</span>);
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{nodes}</p>
  );
}

function DetailModal({
  detail,
  busy,
  aiAvailable,
  grading,
  onCorrect,
  onClose,
}: {
  detail: EssaySubmissionDetail;
  busy: boolean;
  aiAvailable: boolean;
  grading: boolean;
  onCorrect: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  useDialog(painelRef, onClose);
  const evaluation = detail.evaluation;
  const annotations = evaluation?.annotations ?? [];

  function selectFromMark(i: number) {
    setSelected(i);
    document
      .getElementById(`ann-${i}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function selectFromList(i: number) {
    setSelected(i);
    document
      .getElementById(`mark-${i}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={painelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Correção: ${detail.prompt.title}`}
        className="card relative h-fit min-h-full w-full max-w-2xl space-y-4 p-4 outline-none sm:min-h-0 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Correção</p>
            <h2 className="font-display text-lg font-extrabold">
              {detail.prompt.title}
            </h2>
            <p className="text-xs text-muted">{detail.prompt.theme}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost shrink-0">
            Fechar
          </button>
        </header>

        {busy && (
          <div className="space-y-2" aria-busy>
            <SkeletonText width="90%" />
            <SkeletonText width="75%" />
          </div>
        )}

        {!evaluation && (
          <div className="rounded-xl bg-surface-2 p-4 text-center">
            <p className="text-sm text-muted">Esta redação ainda não foi corrigida.</p>
            {aiAvailable && (
              <button
                onClick={onCorrect}
                disabled={grading}
                className="btn btn-primary mt-3 gap-1.5"
              >
                <IconSparkle width={16} height={16} />
                {grading ? 'Corrigindo…' : 'Corrigir com IA'}
              </button>
            )}
          </div>
        )}

        {evaluation && (
          <>
            <ScoreCard evaluation={evaluation} />

            {annotations.some((a) => a.start != null) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {COMP_META.map((c) => (
                  <span key={c.key} className="flex items-center gap-1 text-xs text-muted">
                    <span
                      className="size-2.5 rounded-lg"
                      style={{ backgroundColor: `color-mix(in oklab, ${c.color} 50%, transparent)` }}
                    />
                    {c.short}
                  </span>
                ))}
              </div>
            )}

            <section>
              <h3 className="eyebrow mb-1.5">Sua redação</h3>
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <HighlightedEssay
                  content={detail.content}
                  annotations={annotations}
                  selected={selected}
                  onSelect={selectFromMark}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="eyebrow">Correção por competência</h3>
              {COMP_META.map((c, idx) => {
                const comp = idx + 1;
                const errs = annotations
                  .map((a, i) => ({ a, i }))
                  .filter(({ a }) => a.competency === comp);
                const summary = evaluation.competencyFeedback?.[c.key as CompKey];
                return (
                  <div key={c.key} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-sm font-semibold">{c.label}</span>
                      <span className="ml-auto text-sm font-bold tabular-nums">
                        {evaluation[c.key as CompKey]}
                        <span className="text-xs font-medium text-muted">/200</span>
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        {summary}
                      </p>
                    )}
                    {errs.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {errs.map(({ a, i }) => (
                          <li
                            key={i}
                            id={`ann-${i}`}
                            onClick={() => selectFromList(i)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectFromList(i);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected === i}
                            className="cursor-pointer rounded-lg border-l-2 bg-surface p-2 text-xs"
                            style={{
                              borderColor: c.color,
                              boxShadow:
                                selected === i ? `0 0 0 2px ${c.color}` : undefined,
                            }}
                          >
                            {a.start != null && (
                              <p className="italic text-muted">“{a.excerpt}”</p>
                            )}
                            <p className="mt-0.5 text-fg">{a.comment}</p>
                            {a.suggestion && (
                              <p className="mt-0.5 text-success">→ {a.suggestion}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>

            {evaluation.feedback && (
              <section>
                <h3 className="eyebrow mb-1.5">Comentário geral</h3>
                <p className="rounded-xl border-l-2 border-success bg-success/5 p-3 text-sm leading-relaxed text-fg">
                  {evaluation.feedback}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function Redacao() {
  const { refresh } = useGamification();
  const [prompts, setPrompts] = useState<EssayPrompt[]>([]);
  const [submissions, setSubmissions] = useState<
    EssaySubmissionSummary[] | null
  >(null);
  const [promptId, setPromptId] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EssaySubmissionDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [award, setAward] = useState<GamificationDelta | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, ai] = await Promise.all([
        api.essayPrompts(),
        api.essaySubmissions(),
        api.essayAiAvailable().catch(() => ({ available: false })),
      ]);
      setPrompts(p);
      setSubmissions(s);
      setAiAvailable(ai.available);
      setPromptId((cur) => cur || (p[0]?.id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    }
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setDetailBusy(true);
    setError(null);
    try {
      setDetail(await api.essaySubmission(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir.');
    } finally {
      setDetailBusy(false);
    }
  }, []);

  async function correctWithAi(id: string) {
    setGradingId(id);
    setError(null);
    try {
      const res = await api.evaluateEssayWithAi(id);
      const delta = (res as { gamification?: GamificationDelta }).gamification;
      if (delta) {
        setAward(delta);
        void refresh();
      }
      await load();
      if (detail?.id === id) setDetail(await api.essaySubmission(id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível corrigir por IA.',
      );
    } finally {
      setGradingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.submitEssay(promptId, content);
      setContent('');
      setMessage('Redação enviada! Você verá a nota assim que for corrigida.');
      if (res.gamification) {
        setAward(res.gamification);
        void refresh();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  const selected = prompts.find((p) => p.id === promptId);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Treino" title="Redação" />

      {error && (
        <ErrorBanner message={error} />
      )}

      <form onSubmit={submit} className="card card-raised space-y-3 p-4">
        <label className="block">
          <span className="eyebrow">Tema</span>
          <select
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
            className="input mt-1.5"
          >
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}: {p.theme}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="rounded-lg border-l-2 border-red bg-red/5 px-3 py-2 text-xs leading-relaxed text-muted">
            {selected.theme}
          </p>
        )}
        <label className="block">
          <span className="text-sm font-medium">Seu texto</span>
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            // Mesmo teto da API (ESSAY_MAX_LENGTH): a folha do ENEM tem 30 linhas.
            maxLength={8000}
            rows={8}
            placeholder="Escreva sua redação dissertativo-argumentativa…"
            className="input mt-1.5 resize-y"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !promptId}
            className="btn btn-primary"
          >
            {busy ? 'Enviando…' : 'Enviar redação'}
          </button>
          {message && <p className="text-sm text-success">{message}</p>}
        </div>
        {award && <GamificationFeedback g={award} />}
      </form>

      <section className="space-y-3">
        <h2 className="eyebrow">Meus envios</h2>
        {submissions === null ? (
          // Ainda carregando (ou falhou: o erro aparece no topo). Sem isto o
          // "Nenhuma redação ainda" piscava antes da lista chegar.
          !error && (
            <div className="space-y-3" aria-busy>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </div>
          )
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={IconPen}
            title="Nenhuma redação ainda"
            description="Escreva sua primeira redação para receber feedback."
            tip="Nota por competência, com correção por IA quando disponível"
          />
        ) : (
          <ul className="space-y-3">
            {submissions.map((s) => (
              <li key={s.id} className="card card-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => void openDetail(s.id)}
                    className="text-left"
                  >
                    <p className="font-display font-bold">{s.prompt.title}</p>
                    <p className="text-xs text-muted">
                      Enviada em{' '}
                      {new Date(s.submittedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-success">
                      {s.evaluation ? 'Ver correção →' : 'Ver redação →'}
                    </p>
                  </button>
                  {!s.evaluation &&
                    (aiAvailable ? (
                      <button
                        onClick={() => void correctWithAi(s.id)}
                        disabled={gradingId === s.id}
                        className="btn btn-primary shrink-0 gap-1.5"
                      >
                        <IconSparkle width={16} height={16} />
                        {gradingId === s.id ? 'Corrigindo…' : 'Corrigir com IA'}
                      </button>
                    ) : (
                      <span className="chip text-warning">Aguardando correção</span>
                    ))}
                </div>
                {s.evaluation && <ScoreCard evaluation={s.evaluation} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <DetailModal
          detail={detail}
          busy={detailBusy}
          aiAvailable={aiAvailable}
          grading={gradingId === detail.id}
          onCorrect={() => void correctWithAi(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
