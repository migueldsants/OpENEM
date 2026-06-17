import { useCallback, useEffect, useState } from 'react';
import { api, type StudyPlan, type StudySession } from '../api';

function groupByDay(sessions: StudySession[]): Map<number, StudySession[]> {
  const map = new Map<number, StudySession[]>();
  for (const s of sessions) {
    const list = map.get(s.dayIndex) ?? [];
    list.push(s);
    map.set(s.dayIndex, list);
  }
  return map;
}

export default function Cronograma() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await api.studyPlan());
    } catch {
      setPlan(null); // ainda não há cronograma gerado
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setPlan(await api.generateStudyPlan());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar cronograma');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(s: StudySession) {
    try {
      await api.setSessionDone(s.id, !s.done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Cronograma de estudos</h1>
        <button
          onClick={generate}
          disabled={loading}
          className="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? 'Gerando…' : plan ? 'Regenerar' : 'Gerar cronograma'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!plan ? (
        <p className="text-sm text-slate-500">
          Nenhum cronograma ainda. Gere um plano adaptado ao seu tempo
          disponível e aos assuntos em que você mais erra.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {plan.minutesPerDay} min/dia · prioriza seus assuntos mais fracos.
          </p>
          <div className="space-y-3">
            {[...groupByDay(plan.sessions).entries()].map(([day, sessions]) => (
              <div
                key={day}
                className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4"
              >
                <h2 className="text-sm font-semibold text-slate-300">
                  Dia {day + 1}
                </h2>
                <ul className="mt-2 space-y-2">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={s.done}
                        onChange={() => toggleDone(s)}
                        className="size-4 accent-emerald-500"
                      />
                      <span className={s.done ? 'line-through text-slate-500' : ''}>
                        {s.topic.subject.name} · {s.topic.name}
                      </span>
                      <span className="ml-auto text-slate-500">
                        {s.minutes} min
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
