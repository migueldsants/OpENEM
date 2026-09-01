import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type GamificationDelta,
  type StudyPlan,
  type StudySession,
} from '../api';
import { useAuth } from '../auth';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconCalendar, IconCheck } from '../components/icons';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtDay(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1,
  ).padStart(2, '0')}`;
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

  /** Sessões de hoje (issue #46): "Hoje: [Matéria]". */
  const todaySessions = useMemo(() => {
    if (!plan) return [];
    const planStart = startOfDay(new Date(plan.createdAt));
    const today = startOfDay(new Date());
    const dayIndex = Math.round(
      (today.getTime() - planStart.getTime()) / 86_400_000,
    );
    if (dayIndex < 0) return [];
    return plan.sessions.filter((s) => s.dayIndex === dayIndex);
  }, [plan]);
  const todaySubject = dominantSubject(todaySessions);
  const todayDone = todaySessions.every((s) => s.done) && todaySessions.length > 0;

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
        <ErrorBanner message={error} />
      )}

      {award && (
        <div className="card card-raised p-4">
          <GamificationFeedback g={award} />
        </div>
      )}

      {!plan ? (
        <EmptyState
          icon={IconCalendar}
          title="Sem cronograma ainda"
          description="Gere um plano adaptado ao seu tempo disponível."
          action={{ onClick: generate, label: 'Gerar cronograma' }}
          tip="Priorizamos os assuntos em que você mais erra"
        />
      ) : (
        <>
          {/* Matéria de hoje (issue #46) — visão canônica por matéria. */}
          {todaySubject && (
            <div className="card card-raised flex items-center gap-3 p-4 ring-1 ring-brand/30">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                  AREA_DOT[areaKey(todaySubject)]
                } opacity-90`}
                aria-hidden
              >
                <IconCalendar width={20} height={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Hoje</p>
                <p className="mt-0.5 font-display text-lg font-bold">
                  Dia de{' '}
                  <span className={AREA_TEXT[areaKey(todaySubject)]}>
                    {shortSubject(todaySubject)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {todaySessions.length}{' '}
                  {todaySessions.length === 1 ? 'sessão' : 'sessões'} ·{' '}
                  {todaySessions.reduce((sum, s) => sum + s.minutes, 0)} min
                </p>
              </div>
              {todayDone && (
                <span className="chip shrink-0 bg-nat/12 text-nat">
                  <IconCheck width={13} height={13} /> concluído
                </span>
              )}
            </div>
          )}

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

          <WeeklyCalendar plan={plan} onToggle={toggleDone} />
        </>
      )}
    </div>
  );
}

/** Matéria dominante do dia (issue #46): a de maior minutagem no dia. */
function dominantSubject(sessions: StudySession[]): string | null {
  if (sessions.length === 0) return null;
  const bySubject = new Map<string, number>();
  for (const s of sessions) {
    const name = s.topic.subject.name;
    bySubject.set(name, (bySubject.get(name) ?? 0) + s.minutes);
  }
  return [...bySubject.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Rótulo curto da matéria ("Matemática e suas Tecnologias" → "Matemática"). */
function shortSubject(name: string): string {
  return name.replace(' e suas Tecnologias', '');
}

/** Calendário visual semanal do cronograma — cada dia num grid Seg–Dom. */
function WeeklyCalendar({
  plan,
  onToggle,
}: {
  plan: StudyPlan;
  onToggle: (s: StudySession) => void;
}) {
  const { cells } = useMemo(() => {
    const planStart = startOfDay(new Date(plan.createdAt));
    const maxDay = plan.sessions.reduce((m, s) => Math.max(m, s.dayIndex), -1);
    const totalDays = maxDay + 1;
    const startOffset = (planStart.getDay() + 6) % 7; // Seg=0..Dom=6
    const weeks = Math.ceil((startOffset + totalDays) / 7);
    const byDay = new Map<number, StudySession[]>();
    for (const s of plan.sessions) {
      const list = byDay.get(s.dayIndex) ?? [];
      list.push(s);
      byDay.set(s.dayIndex, list);
    }
    const rows: { date: Date | null; dayIndex: number | null; sessions: StudySession[] }[][] = [];
    for (let w = 0; w < weeks; w += 1) {
      const row: { date: Date | null; dayIndex: number | null; sessions: StudySession[] }[] = [];
      for (let c = 0; c < 7; c += 1) {
        const globalIndex = w * 7 + c - startOffset;
        if (globalIndex >= 0 && globalIndex < totalDays) {
          row.push({
            date: addDays(planStart, globalIndex),
            dayIndex: globalIndex,
            sessions: byDay.get(globalIndex) ?? [],
          });
        } else {
          row.push({ date: null, dayIndex: null, sessions: [] });
        }
      }
      rows.push(row);
    }
    return { cells: rows };
  }, [plan]);

  const today = startOfDay(new Date());

  return (
    <div className="card p-4">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1.5 space-y-1.5">
        {cells.map((row, w) => (
          <div key={w} className="grid grid-cols-7 gap-1.5">
            {row.map((cell, c) => {
              if (cell.date === null) {
                return (
                  <div
                    key={c}
                    className="min-h-[88px] rounded-lg border border-line/30 opacity-40"
                  />
                );
              }
              const isToday = sameDay(cell.date, today);
              const hasSessions = cell.sessions.length > 0;
              const daySubject = dominantSubject(cell.sessions);
              const dayArea = daySubject ? areaKey(daySubject) : null;
              return (
                <div
                  key={c}
                  className={`min-h-[88px] rounded-lg border p-1.5 ${
                    hasSessions ? 'border-line bg-surface' : 'border-line/50'
                  } ${isToday ? 'ring-1 ring-brand' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold tabular-nums text-muted">
                      {fmtDay(cell.date)}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-brand/12 px-1.5 py-0.5 text-[9px] font-semibold text-brand">
                        hoje
                      </span>
                    )}
                  </div>
                  {/* Matéria dominante do dia (issue #46). */}
                  {daySubject && dayArea && (
                    <p
                      className={`mt-0.5 truncate text-[10px] font-bold ${AREA_TEXT[dayArea]}`}
                    >
                      {shortSubject(daySubject)}
                    </p>
                  )}
                  <ul className="mt-1 space-y-0.5">
                    {cell.sessions.map((s) => {
                      const area = areaKey(s.topic.subject.name);
                      return (
                        <li key={s.id}>
                          <button
                            onClick={() => onToggle(s)}
                            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-surface-2"
                          >
                            <span
                              className={`grid size-3.5 shrink-0 place-items-center rounded border ${
                                s.done
                                  ? 'border-transparent bg-brand text-brand-ink'
                                  : 'border-line'
                              }`}
                            >
                              {s.done && <IconCheck width={9} height={9} />}
                            </span>
                            <span
                              className={`size-1.5 shrink-0 rounded-full ${AREA_DOT[area]}`}
                            />
                            <span
                              className={`truncate ${
                                s.done
                                  ? 'text-muted line-through'
                                  : AREA_TEXT[area]
                              }`}
                            >
                              {s.topic.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
