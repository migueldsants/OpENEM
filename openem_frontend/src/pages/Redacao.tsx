import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type EssayPrompt,
  type EssaySubmissionSummary,
} from '../api';

export default function Redacao() {
  const [prompts, setPrompts] = useState<EssayPrompt[]>([]);
  const [submissions, setSubmissions] = useState<EssaySubmissionSummary[]>([]);
  const [promptId, setPromptId] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.essayPrompts(),
        api.essaySubmissions(),
      ]);
      setPrompts(p);
      setSubmissions(s);
      if (p.length && !promptId) setPromptId(p[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [promptId]);

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
      setMessage('Redação enviada! Aguardando correção.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setBusy(false);
    }
  }

  const selected = prompts.find((p) => p.id === promptId);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Redação</h1>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <form
        onSubmit={submit}
        className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4 space-y-3"
      >
        <label className="block">
          <span className="text-xs text-slate-400">Tema</span>
          <select
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-950 ring-1 ring-slate-800 px-3 py-2 text-sm outline-none focus:ring-emerald-500"
          >
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <p className="text-xs text-slate-500">{selected.theme}</p>
        )}
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Escreva sua redação dissertativo-argumentativa…"
          className="w-full rounded-lg bg-slate-950 ring-1 ring-slate-800 px-3 py-2 text-sm outline-none focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={busy || !promptId}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? 'Enviando…' : 'Enviar redação'}
        </button>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Meus envios</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma redação enviada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li
                key={s.id}
                className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4"
              >
                <p className="text-sm font-medium">{s.prompt.title}</p>
                <p className="text-xs text-slate-500">
                  Enviada em {new Date(s.submittedAt).toLocaleDateString('pt-BR')}
                </p>
                {s.evaluation ? (
                  <div className="mt-2">
                    <p className="text-sm">
                      Nota:{' '}
                      <span className="font-bold text-emerald-300">
                        {s.evaluation.total}
                      </span>
                      /1000
                    </p>
                    <p className="text-xs text-slate-400">
                      C1 {s.evaluation.c1} · C2 {s.evaluation.c2} · C3{' '}
                      {s.evaluation.c3} · C4 {s.evaluation.c4} · C5{' '}
                      {s.evaluation.c5}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-300/80">
                    Aguardando correção.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
