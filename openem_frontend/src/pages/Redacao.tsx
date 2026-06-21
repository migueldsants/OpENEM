import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type EssayPrompt,
  type EssaySubmissionSummary,
} from '../api';
import { IconSparkle } from '../components/icons';

const COMPETENCIES = [
  { key: 'c1', label: 'C1 · Norma culta' },
  { key: 'c2', label: 'C2 · Compreensão do tema' },
  { key: 'c3', label: 'C3 · Argumentação' },
  { key: 'c4', label: 'C4 · Coesão' },
  { key: 'c5', label: 'C5 · Proposta de intervenção' },
] as const;

function ScoreCard({
  evaluation,
}: {
  evaluation: NonNullable<EssaySubmissionSummary['evaluation']>;
}) {
  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="font-display text-xl font-extrabold tabular-nums text-nat">
        {evaluation.total}
        <span className="text-sm font-semibold text-muted">/1000</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {COMPETENCIES.map(({ key, label }) => {
          const value = evaluation[key];
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span className="w-44 shrink-0 truncate text-muted">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-nat"
                  style={{ width: `${(value / 200) * 100}%` }}
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

export default function Redacao() {
  const [prompts, setPrompts] = useState<EssayPrompt[]>([]);
  const [submissions, setSubmissions] = useState<EssaySubmissionSummary[]>([]);
  const [promptId, setPromptId] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);

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

  async function correctWithAi(id: string) {
    setGradingId(id);
    setError(null);
    try {
      await api.evaluateEssayWithAi(id);
      await load();
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
      await api.submitEssay(promptId, content);
      setContent('');
      setMessage('Redação enviada! Você verá a nota assim que for corrigida.');
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
      <header>
        <p className="eyebrow">Treino</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Redação
        </h1>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
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
                {p.title}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="rounded-lg border-l-2 border-red bg-red/5 px-3 py-2 text-xs leading-relaxed text-muted">
            {selected.theme}
          </p>
        )}
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Escreva sua redação dissertativo-argumentativa…"
          className="input resize-y"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !promptId}
            className="btn btn-primary"
          >
            {busy ? 'Enviando…' : 'Enviar redação'}
          </button>
          {message && <p className="text-sm text-nat">{message}</p>}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="eyebrow">Meus envios</h2>
        {submissions.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">
            Você ainda não enviou nenhuma redação.
          </p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((s) => (
              <li key={s.id} className="card card-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-bold">{s.prompt.title}</p>
                    <p className="text-xs text-muted">
                      Enviada em{' '}
                      {new Date(s.submittedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
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
                      <span className="chip text-hum">Aguardando correção</span>
                    ))}
                </div>
                {s.evaluation && <ScoreCard evaluation={s.evaluation} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
