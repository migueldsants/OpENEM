import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  HttpError,
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
import Reveal from '../components/Reveal';
import {
  areaKey,
  AREA_BORDER,
  AREA_DOT,
  AREA_SOFT,
  AREA_TEXT,
  shortSubject,
} from '../lib/areas';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Faixa aceita pelo backend (UpdateProfileDto: Min(5) / Max(1440)). */
const MIN_MINUTES = 5;
const MAX_MINUTES = 1440;
/** Atalhos de tempo diário — o campo numérico continua livre. */
const MINUTE_PRESETS = [30, 60, 90, 120] as const;

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

/** Índice do dia de hoje dentro do plano (negativo = plano começa no futuro). */
function dayIndexOf(plan: StudyPlan, today = new Date()): number {
  const planStart = startOfDay(new Date(plan.createdAt));
  return Math.round(
    (startOfDay(today).getTime() - planStart.getTime()) / 86_400_000,
  );
}

export default function Cronograma() {
  const { me, refreshMe } = useAuth();
  const { refresh } = useGamification();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  // String para permitir o campo vazio enquanto o usuário digita — com Number()
  // direto, apagar o campo virava 0 e o ajuste era descartado em silêncio.
  const [minutes, setMinutes] = useState(
    String(me?.profile?.minutesPerDay ?? 60),
  );
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);
  const [confirmingRegen, setConfirmingRegen] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await api.studyPlan());
      setLoadFailed(false);
      setError(null);
    } catch (err) {
      setPlan(null);
      // 404 = ainda não há cronograma gerado; o resto é falha de verdade e
      // não pode se disfarçar de "sem cronograma ainda".
      if (err instanceof HttpError && err.status === 404) {
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar o cronograma.',
        );
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (me?.profile?.minutesPerDay) setMinutes(String(me.profile.minutesPerDay));
  }, [me?.profile?.minutesPerDay]);

  const minutesValue = Number(minutes);
  const minutesValid =
    Number.isInteger(minutesValue) &&
    minutesValue >= MIN_MINUTES &&
    minutesValue <= MAX_MINUTES;

  async function generate() {
    if (!minutesValid) {
      setError(
        `Informe um número inteiro de minutos entre ${MIN_MINUTES} e ${MAX_MINUTES}.`,
      );
      return;
    }
    setConfirmingRegen(false);
    setLoading(true);
    setError(null);
    try {
      // O cronograma usa o tempo do perfil — salva o ajuste antes de gerar.
      if (minutesValue !== me?.profile?.minutesPerDay) {
        await api.updateProfile({ minutesPerDay: minutesValue });
        await refreshMe();
      }
      setPlan(await api.generateStudyPlan());
      setLoadFailed(false);
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

  /** Horizonte do plano em dias e se ele já terminou. */
  const { todayIndex, planDays } = useMemo(() => {
    if (!plan) return { todayIndex: -1, planDays: 0 };
    const maxDay = plan.sessions.reduce((m, s) => Math.max(m, s.dayIndex), -1);
    return { todayIndex: dayIndexOf(plan), planDays: maxDay + 1 };
  }, [plan]);
  const expired = plan !== null && planDays > 0 && todayIndex >= planDays;

  /** Sessões de hoje (issue #46): "Hoje: [Matéria]". */
  const todaySessions = useMemo(() => {
    if (!plan || todayIndex < 0) return [];
    return plan.sessions.filter((s) => s.dayIndex === todayIndex);
  }, [plan, todayIndex]);
  const todaySubject = dominantSubject(todaySessions);
  const todayDone = todaySessions.every((s) => s.done) && todaySessions.length > 0;

  const generateLabel = loading
    ? 'Montando…'
    : confirmingRegen
      ? 'Confirmar — apaga o progresso'
      : plan
        ? 'Regenerar plano'
        : 'Gerar cronograma';

  return (
    <div className="space-y-5">
      <header className="space-y-5">
        <div>
          <p className="eyebrow">Plano de estudos</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Cronograma
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted text-pretty">
            Um plano de 7 dias montado sobre os assuntos em que você mais erra.
          </p>
        </div>

        <div className="card card-raised p-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div>
              <span className="eyebrow" id="minutes-label">
                Tempo por dia
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  step={1}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  aria-labelledby="minutes-label"
                  aria-invalid={!minutesValid}
                  aria-describedby={minutesValid ? undefined : 'minutes-hint'}
                  className="input w-20 text-center font-data tabular-nums"
                />
                <span className="text-sm text-muted">min</span>
                {/* Atalhos: quase ninguém quer digitar o número. */}
                <div className="seg ml-1" role="group" aria-label="Tempo sugerido">
                  {MINUTE_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-active={minutesValue === m}
                      aria-pressed={minutesValue === m}
                      onClick={() => setMinutes(String(m))}
                      className="font-data"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {confirmingRegen && (
                <button
                  onClick={() => setConfirmingRegen(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
              )}
              <button
                // Regenerar apaga o plano atual no backend (deleteMany), então
                // um plano existente exige confirmação em dois passos.
                onClick={() =>
                  plan && !confirmingRegen
                    ? setConfirmingRegen(true)
                    : void generate()
                }
                disabled={loading || !minutesValid}
                className={`btn ${confirmingRegen ? 'btn-ghost text-red' : 'btn-primary'}`}
              >
                {generateLabel}
              </button>
            </div>
          </div>
          {!minutesValid && (
            <p id="minutes-hint" className="mt-2 text-xs text-red">
              Entre {MIN_MINUTES} e {MAX_MINUTES} minutos.
            </p>
          )}
        </div>
      </header>

      <ErrorBanner
        message={error}
        onRetry={loadFailed ? () => void load() : undefined}
      />

      {award && (
        <div className="card card-raised p-4">
          <GamificationFeedback g={award} />
        </div>
      )}

      {expired && (
        <div className="card flex flex-wrap items-center gap-3 p-4 ring-1 ring-hum/30">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">
              Este cronograma já terminou
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ele cobria {planDays} {planDays === 1 ? 'dia' : 'dias'} a partir de{' '}
              {fmtDay(new Date(plan.createdAt))}. Gere um novo para continuar.
            </p>
          </div>
          <button
            onClick={() => void generate()}
            disabled={loading || !minutesValid}
            className="btn btn-primary shrink-0"
          >
            Gerar novo
          </button>
        </div>
      )}

      {!plan ? (
        loadFailed ? null : (
          <EmptyState
            icon={IconCalendar}
            title="Sem cronograma ainda"
            description="Gere um plano adaptado ao seu tempo disponível."
            action={{ onClick: () => void generate(), label: 'Gerar cronograma' }}
            tip="Priorizamos os assuntos em que você mais erra"
          />
        )
      ) : (
        <>
          {/* Hoje é o herói da tela: identifica a matéria e já traz as
              sessões do dia, sem obrigar a caçar a célula no calendário. */}
          {todaySubject && (
            <Reveal as="section" className="card card-raised overflow-hidden">
              <div
                className={`flex items-center gap-3.5 p-5 ${
                  AREA_SOFT[areaKey(todaySubject)]
                }`}
              >
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl text-white ${
                    AREA_DOT[areaKey(todaySubject)]
                  }`}
                  aria-hidden
                >
                  <IconCalendar width={22} height={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Hoje</p>
                  <p className="mt-0.5 font-display text-xl font-extrabold tracking-tight">
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
              <ul className="divide-y divide-line border-t border-line">
                {todaySessions.map((s) => (
                  <li key={s.id} className="px-3 py-1">
                    <SessionToggle
                      session={s}
                      onToggle={toggleDone}
                      compact={false}
                    />
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {/* Números do plano em tiles, no lugar de um bloco largo só. */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {done}
                <span className="text-muted">/{total}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">sessões feitas</p>
              <div
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label="Sessões concluídas"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
              >
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="card p-4">
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {plan.minutesPerDay}
              </p>
              <p className="mt-0.5 text-xs text-muted">min por dia</p>
            </div>
            <div className="card p-4">
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {Math.min(todayIndex + 1, planDays)}
                <span className="text-muted">/{planDays}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">dia do plano</p>
            </div>
          </div>

          <PlanDays plan={plan} onToggle={toggleDone} />
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

interface PlanDay {
  date: Date;
  dayIndex: number;
  sessions: StudySession[];
}

/** Botão de uma sessão (marca/desmarca a conclusão). */
function SessionToggle({
  session,
  onToggle,
  compact,
}: {
  session: StudySession;
  onToggle: (s: StudySession) => void;
  compact: boolean;
}) {
  const area = areaKey(session.topic.subject.name);
  return (
    <button
      onClick={() => onToggle(session)}
      aria-pressed={session.done}
      className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-surface-2 ${
        compact ? 'text-[10px]' : 'gap-2 py-1.5 text-sm'
      }`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded border ${
          compact ? 'size-3.5' : 'size-4'
        } ${
          session.done ? 'border-transparent bg-brand text-brand-ink' : 'border-line'
        }`}
        aria-hidden
      >
        {session.done && (
          <IconCheck width={compact ? 9 : 11} height={compact ? 9 : 11} />
        )}
      </span>
      <span className={`size-1.5 shrink-0 rounded-full ${AREA_DOT[area]}`} aria-hidden />
      <span
        className={`truncate ${
          session.done ? 'text-muted line-through' : AREA_TEXT[area]
        }`}
      >
        {session.topic.name}
      </span>
      {!compact && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
          {session.minutes} min
        </span>
      )}
    </button>
  );
}

/**
 * Cronograma por dia. No desktop, um grid Seg–Dom; no mobile, uma lista —
 * sete colunas em 360px deixavam ~42px por célula e o nome do assunto sumia.
 */
function PlanDays({
  plan,
  onToggle,
}: {
  plan: StudyPlan;
  onToggle: (s: StudySession) => void;
}) {
  const { days, rows } = useMemo(() => {
    const planStart = startOfDay(new Date(plan.createdAt));
    const maxDay = plan.sessions.reduce((m, s) => Math.max(m, s.dayIndex), -1);
    const totalDays = maxDay + 1;
    const byDay = new Map<number, StudySession[]>();
    for (const s of plan.sessions) {
      const list = byDay.get(s.dayIndex) ?? [];
      list.push(s);
      byDay.set(s.dayIndex, list);
    }
    const flat: PlanDay[] = Array.from({ length: totalDays }, (_, i) => ({
      date: addDays(planStart, i),
      dayIndex: i,
      sessions: byDay.get(i) ?? [],
    }));

    const startOffset = (planStart.getDay() + 6) % 7; // Seg=0..Dom=6
    const weeks = Math.ceil((startOffset + totalDays) / 7);
    const grid: (PlanDay | null)[][] = [];
    for (let w = 0; w < weeks; w += 1) {
      const row: (PlanDay | null)[] = [];
      for (let c = 0; c < 7; c += 1) {
        const globalIndex = w * 7 + c - startOffset;
        row.push(flat[globalIndex] ?? null);
      }
      grid.push(row);
    }
    return { days: flat, rows: grid };
  }, [plan]);

  const today = startOfDay(new Date());
  // Escala da barra de carga: o dia mais cheio do plano vale 100%.
  const maxDayMinutes = Math.max(
    1,
    ...days.map((d) => d.sessions.reduce((sum, s) => sum + s.minutes, 0)),
  );

  return (
    <>
      {/* Mobile: lista vertical legível. */}
      <div className="space-y-2 md:hidden">
        {days.map((day) => {
          const isToday = sameDay(day.date, today);
          const daySubject = dominantSubject(day.sessions);
          const dayArea = daySubject ? areaKey(daySubject) : null;
          return (
            <section
              key={day.dayIndex}
              className={`card border-l-4 p-3 ${
                dayArea ? AREA_BORDER[dayArea] : 'border-l-line'
              } ${isToday ? 'ring-1 ring-brand' : ''} ${
                day.date < today ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-data text-xs font-semibold tabular-nums text-muted">
                  {WEEKDAYS[(day.date.getDay() + 6) % 7]} {fmtDay(day.date)}
                </span>
                {isToday && (
                  <span className="rounded-full bg-brand/12 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    hoje
                  </span>
                )}
                {daySubject && dayArea && (
                  <span
                    className={`ml-auto truncate text-xs font-bold ${AREA_TEXT[dayArea]}`}
                  >
                    {shortSubject(daySubject)}
                  </span>
                )}
              </div>
              {day.sessions.length === 0 ? (
                <p className="mt-1 text-xs text-muted">Dia livre</p>
              ) : (
                <ul className="mt-1.5 space-y-0.5">
                  {day.sessions.map((s) => (
                    <li key={s.id}>
                      <SessionToggle
                        session={s}
                        onToggle={onToggle}
                        compact={false}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Desktop: calendário Seg–Dom. */}
      <div className="card hidden p-4 md:block">
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
          {rows.map((row, w) => (
            <div key={w} className="grid grid-cols-7 gap-1.5">
              {row.map((cell, c) => {
                // Dias fora do plano: espaço vazio, sem moldura — antes
                // pareciam dias reais sem sessão.
                if (cell === null) return <div key={c} aria-hidden />;
                const isToday = sameDay(cell.date, today);
                const hasSessions = cell.sessions.length > 0;
                const daySubject = dominantSubject(cell.sessions);
                const dayArea = daySubject ? areaKey(daySubject) : null;
                const dayMinutes = cell.sessions.reduce(
                  (sum, x) => sum + x.minutes,
                  0,
                );
                return (
                  <div
                    key={c}
                    className={`flex min-h-[96px] flex-col rounded-lg border p-1.5 transition-opacity ${
                      hasSessions ? 'border-line bg-surface' : 'border-line/50'
                    } ${isToday ? 'ring-1 ring-brand' : ''} ${
                      cell.date < today && !isToday ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-data text-[10px] font-semibold tabular-nums text-muted">
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
                      {cell.sessions.map((s) => (
                        <li key={s.id}>
                          <SessionToggle
                            session={s}
                            onToggle={onToggle}
                            compact
                          />
                        </li>
                      ))}
                    </ul>
                    {/* Carga do dia: dá leitura de volume sem abrir a célula. */}
                    {hasSessions && dayArea && (
                      <div
                        className="mt-auto h-1 overflow-hidden rounded-full bg-surface-2"
                        title={`${dayMinutes} min`}
                      >
                        <div
                          className={`h-full rounded-full ${AREA_DOT[dayArea]} opacity-70`}
                          style={{
                            width: `${(dayMinutes / maxDayMinutes) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
