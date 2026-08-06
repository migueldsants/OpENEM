import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type GamificationDelta,
  type StudyPlan,
  type StudySession,
} from '../api';
import { useAuth } from '../auth';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconCheck } from '../components/icons';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

function groupByDay(sessions: StudySession[]): [number, StudySession[]][] {
  const map = new Map<number, StudySession[]>();
  for (const s of sessions) {
    const list = map.get(s.dayIndex) ?? [];
    list.push(s);
    map.set(s.dayIndex, list);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export default function Cronograma() {
  const { me, refreshMe } = useAuth();
  const { refresh } = useGamification();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [minutes, setMinutes] = useState(me?.profile?.minutesPerDay ?? 60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);

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

  useEffect(() => {
    if (me?.profile?.minutesPerDay) setMinutes(me.profile.minutesPerDay);
  }, [me?.profile?.minutesPerDay]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // O cronograma usa o tempo do perfil — salva o ajuste antes de gerar.
      if (minutes && minutes !== me?.profile?.minutesPerDay) {
        await api.updateProfile({ minutesPerDay: minutes });
        await refreshMe();
      }
      setPlan(await api.generateStudyPlan());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(s: StudySession) {
    setError(null);
    setAward(null);
    try {
      const res = await api.setSessionDone(s.id, !s.done);
      const delta = res.gamification;
      if (delta) {
        setAward(delta);
        void refresh();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    }
  }

  const done = plan?.sessions.filter((s) => s.done).length ?? 0;
  const total = plan?.sessions.length ?? 0;

  return (
    <div className="space-y-5">
      <header className="space-y-4">
        <div>
          <p className="eyebrow">Plano de estudos</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Cronograma
          </h1>
        </div>
        <div className="card flex flex-wrap items-end gap-4 p-4">
          <label className="block">
            <span className="eyebrow">Tempo por dia</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="input w-24"
              />
              <span className="text-sm text-muted">min</span>
            </div>
          </label>
          <button
            onClick={generate}
            disabled={loading}
            className="btn btn-primary ml-auto"
          >
            {loading ? 'Montando…' : plan ? 'Regenerar plano' : 'Gerar cronograma'}
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {award && (
        <div className="card card-raised p-4">
          <GamificationFeedback g={award} />
        </div>
      )}

      {!plan ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">
            Gere um plano adaptado ao seu tempo disponível que prioriza os
            assuntos em que você mais erra.
          </p>
        </div>
      ) : (
        <>
          <div className="card card-raised flex items-center gap-4 p-4">
            <div>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {done}
                <span className="text-muted">/{total}</span>
              </p>
              <p className="text-xs text-muted">sessões concluídas</p>
            </div>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {plan.minutesPerDay} min por dia
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {groupByDay(plan.sessions).map(([day, sessions]) => (
              <div key={day} className="card p-4">
                <h2 className="eyebrow">Dia {day + 1}</h2>
                <ul className="mt-3 space-y-1">
                  {sessions.map((s) => {
                    const area = areaKey(s.topic.subject.name);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggleDone(s)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                        >
                          <span
                            className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                              s.done
                                ? 'border-transparent bg-brand text-brand-ink'
                                : 'border-line'
                            }`}
                          >
                            {s.done && <IconCheck width={14} height={14} />}
                          </span>
                          <span className={`size-2.5 shrink-0 rounded-full ${AREA_DOT[area]}`} />
                          <span className={s.done ? 'text-muted line-through' : ''}>
                            <span className={`font-medium ${s.done ? '' : AREA_TEXT[area]}`}>
                              {s.topic.subject.name}
                            </span>{' '}
                            · {s.topic.name}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
                            {s.minutes} min
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
