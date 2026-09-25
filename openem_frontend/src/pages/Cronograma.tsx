import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  HttpError,
  type GamificationDelta,
  type StudyPlan,
  type StudySession,
  type Subject,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { GamificationFeedback } from '../components/GamificationFeedback';
import {
  IconCalendar,
  IconCheck,
  IconPlus,
  IconTrash,
} from '../components/icons';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT, shortSubject } from '../lib/areas';
import { dayIndexOf, startOfDay } from '../lib/plan';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** Faixa aceita pelo backend (UpdateProfileDto: Min(5) / Max(1440)). */
const MIN_MINUTES = 5;
const MAX_MINUTES = 1440;
/** Atalhos de tempo diário — o campo numérico continua livre. */
const MINUTE_PRESETS = [30, 60, 90, 120] as const;
/** Durações oferecidas ao editar um bloco. */
const BLOCK_PRESETS = [15, 30, 45, 60, 90, 120] as const;

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

/**
 * Um bloco no calendário. O nome é editável no lugar (duplo clique ou botão
 * de editar); o checkbox marca a conclusão.
 */
function SessionBlock({
  session,
  onToggle,
  onRename,
  onRetime,
  onRemove,
}: {
  session: StudySession;
  onToggle: (s: StudySession) => void;
  onRename: (s: StudySession, label: string) => void;
  onRetime: (s: StudySession, minutes: number) => void;
  onRemove: (s: StudySession) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const area = areaKey(session.subject?.name ?? session.label);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== session.label) onRename(session, next);
    else setDraft(session.label);
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-brand/40 bg-surface p-1.5">
        <input
          ref={inputRef}
          value={draft}
          list="cronograma-materias"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(session.label);
              setEditing(false);
            }
          }}
          aria-label={`Nome do bloco ${session.label}`}
          className="input w-full px-2 py-1 text-xs"
        />
        <div className="mt-1.5 flex items-center gap-1">
          <select
            value={session.minutes}
            onChange={(e) => onRetime(session, Number(e.target.value))}
            aria-label={`Duração de ${session.label}`}
            className="input min-w-0 flex-1 px-1.5 py-1 text-xs"
          >
            {[...new Set([...BLOCK_PRESETS, session.minutes])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
          </select>
          <button
            onClick={() => onRemove(session)}
            aria-label={`Remover ${session.label}`}
            className="grid size-6 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <IconTrash width={12} height={12} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`group flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2 ${
        session.done ? 'opacity-60' : ''
      }`}
    >
      <button
        onClick={() => onToggle(session)}
        aria-pressed={session.done}
        aria-label={`${session.done ? 'Desmarcar' : 'Concluir'} ${session.label}`}
        className={`grid size-4 shrink-0 place-items-center rounded-lg border transition-colors ${
          session.done
            ? 'border-transparent bg-brand text-brand-ink'
            : 'border-line hover:border-brand'
        }`}
      >
        {session.done && <IconCheck width={10} height={10} />}
      </button>
      <span
        className={`size-1.5 shrink-0 rounded-full ${AREA_DOT[area]}`}
        aria-hidden
      />
      <button
        onClick={() => setEditing(true)}
        aria-label={`Renomear ${session.label}`}
        title={`${session.label} · ${session.minutes} min. Clique para renomear`}
        className={`min-w-0 flex-1 truncate text-left text-xs ${
          session.done ? 'text-muted line-through' : AREA_TEXT[area]
        }`}
      >
        {session.label}
      </button>
      <span className="shrink-0 font-data text-xs tabular-nums text-muted">
        {session.minutes}
      </span>
    </li>
  );
}

/** Célula de um dia: lista de blocos + campo para adicionar. */
function DayCell({
  date,
  dayIndex,
  sessions,
  isToday,
  isPast,
  onAdd,
  onToggle,
  onRename,
  onRetime,
  onRemove,
}: {
  date: Date;
  dayIndex: number;
  sessions: StudySession[];
  isToday: boolean;
  isPast: boolean;
  onAdd: (dayIndex: number, label: string) => void;
  onToggle: (s: StudySession) => void;
  onRename: (s: StudySession, label: string) => void;
  onRetime: (s: StudySession, minutes: number) => void;
  onRemove: (s: StudySession) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function commit() {
    const label = draft.trim();
    if (label) onAdd(dayIndex, label);
    setDraft('');
    setAdding(false);
  }

  const total = sessions.reduce((sum, s) => sum + s.minutes, 0);

  return (
    <section
      className={`flex flex-col rounded-xl border p-2 transition-colors sm:min-h-[190px] ${
        sessions.length > 0 ? 'border-line bg-surface' : 'border-line/50'
      } ${isToday ? 'ring-2 ring-brand' : ''} ${isPast && !isToday ? 'opacity-60' : ''}`}
    >
      <header className="flex items-baseline justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS[(date.getDay() + 6) % 7]}
          </p>
          <p className="font-data text-xs font-bold tabular-nums">
            {fmtDay(date)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {total > 0 && (
            <span className="font-data text-xs tabular-nums text-muted">
              {total}min
            </span>
          )}
          {isToday && (
            <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs font-bold text-brand-ink">
              hoje
            </span>
          )}
        </span>
      </header>

      <ul className="mt-2 space-y-0.5">
        {sessions.map((s) => (
          <SessionBlock
            key={s.id}
            session={s}
            onToggle={onToggle}
            onRename={onRename}
            onRetime={onRetime}
            onRemove={onRemove}
          />
        ))}
      </ul>

      <div className="mt-auto pt-1.5">
        {adding ? (
          <input
            ref={inputRef}
            value={draft}
            list="cronograma-materias"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft('');
                setAdding(false);
              }
            }}
            placeholder="Matéria ou tarefa…"
            aria-label={`Adicionar em ${fmtDay(date)}`}
            className="input w-full px-2 py-1 text-xs"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            aria-label={`Adicionar bloco em ${fmtDay(date)}`}
            className="flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-brand"
          >
            <IconPlus width={11} height={11} />
            adicionar
          </button>
        )}
      </div>
    </section>
  );
}

export default function Cronograma() {
  const { me, refreshMe } = useAuth();
  const { refresh } = useGamification();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  // String para permitir o campo vazio enquanto o usuário digita — com Number()
  // direto, apagar o campo virava 0 e o ajuste era descartado em silêncio.
  const [minutes, setMinutes] = useState(
    String(me?.profile?.minutesPerDay ?? 60),
  );
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // A primeira carga ainda não voltou: sem isto o "Monte sua semana" piscava
  // para quem já tem cronograma.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);
  const [confirming, setConfirming] = useState<'regen' | 'clear' | null>(null);

  const load = useCallback(async () => {
    try {
      setPlan(await api.studyPlan());
      setLoadFailed(false);
      setError(null);
    } catch (err) {
      setPlan(null);
      // 404 = ainda não há cronograma; o resto é falha de verdade e não pode
      // se disfarçar de "sem cronograma ainda".
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
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    if (me?.profile?.minutesPerDay) setMinutes(String(me.profile.minutesPerDay));
  }, [me?.profile?.minutesPerDay]);

  const minutesValue = Number(minutes);
  const minutesValid =
    Number.isInteger(minutesValue) &&
    minutesValue >= MIN_MINUTES &&
    minutesValue <= MAX_MINUTES;

  /** Aplica uma mudança já refletida na tela, revertendo se a API falhar. */
  const optimistic = useCallback(
    async (next: StudySession[], action: () => Promise<unknown>) => {
      const previous = plan;
      if (plan) setPlan({ ...plan, sessions: next });
      setError(null);
      try {
        await action();
        await load();
      } catch (err) {
        setPlan(previous);
        setError(
          err instanceof Error ? err.message : 'Não foi possível salvar.',
        );
      }
    },
    [plan, load],
  );

  async function generate() {
    if (!minutesValid) {
      setError(
        `Informe um número inteiro de minutos entre ${MIN_MINUTES} e ${MAX_MINUTES}.`,
      );
      return;
    }
    setConfirming(null);
    setLoading(true);
    setError(null);
    try {
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

  async function clearAll() {
    setConfirming(null);
    setLoading(true);
    try {
      setPlan(await api.clearStudyPlan());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível limpar.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDone(s: StudySession) {
    setAward(null);
    const next =
      plan?.sessions.map((x) =>
        x.id === s.id ? { ...x, done: !s.done } : x,
      ) ?? [];
    await optimistic(next, async () => {
      const res = await api.updateSession(s.id, { done: !s.done });
      if (res.gamification) {
        setAward(res.gamification);
        void refresh();
      }
    });
  }

  async function addBlock(dayIndex: number, label: string) {
    setError(null);
    try {
      await api.addSession(label, dayIndex);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível adicionar.',
      );
    }
  }

  async function rename(s: StudySession, label: string) {
    const next =
      plan?.sessions.map((x) => (x.id === s.id ? { ...x, label } : x)) ?? [];
    await optimistic(next, () => api.updateSession(s.id, { label }));
  }

  async function retime(s: StudySession, minutesValue: number) {
    const next =
      plan?.sessions.map((x) =>
        x.id === s.id ? { ...x, minutes: minutesValue } : x,
      ) ?? [];
    await optimistic(next, () =>
      api.updateSession(s.id, { minutes: minutesValue }),
    );
  }

  async function removeBlock(s: StudySession) {
    const next = plan?.sessions.filter((x) => x.id !== s.id) ?? [];
    await optimistic(next, () => api.removeSession(s.id));
  }

  const done = plan?.sessions.filter((s) => s.done).length ?? 0;
  const total = plan?.sessions.length ?? 0;
  const subjectNames = useMemo(() => subjects.map((s) => s.name), [subjects]);

  /** Horizonte do plano: pelo menos 7 dias, mais se houver blocos além disso. */
  const { todayIndex, planDays } = useMemo(() => {
    if (!plan) return { todayIndex: -1, planDays: 0 };
    const maxDay = plan.sessions.reduce((m, s) => Math.max(m, s.dayIndex), -1);
    return { todayIndex: dayIndexOf(plan), planDays: Math.max(7, maxDay + 1) };
  }, [plan]);
  const expired = plan !== null && todayIndex >= planDays;

  const todaySessions = useMemo(() => {
    if (!plan || todayIndex < 0) return [];
    return plan.sessions.filter((s) => s.dayIndex === todayIndex);
  }, [plan, todayIndex]);
  const todayDone =
    todaySessions.every((s) => s.done) && todaySessions.length > 0;

  const days = useMemo(() => {
    if (!plan) return [];
    const planStart = startOfDay(new Date(plan.createdAt));
    const byDay = new Map<number, StudySession[]>();
    for (const s of plan.sessions) {
      const list = byDay.get(s.dayIndex) ?? [];
      list.push(s);
      byDay.set(s.dayIndex, list);
    }
    return Array.from({ length: planDays }, (_, i) => ({
      dayIndex: i,
      date: addDays(planStart, i),
      sessions: byDay.get(i) ?? [],
    }));
  }, [plan, planDays]);

  const today = startOfDay(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plano de estudos"
        title="Cronograma"
        subtitle="Clique em qualquer bloco para renomear, ou em “adicionar” para escrever o que quiser: matéria do ENEM, idioma, aula do cursinho."
      >

        <div className="card card-raised p-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div>
              <span className="eyebrow" id="minutes-label">
                Tempo por dia
              </span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                <div
                  className="seg ml-1"
                  role="group"
                  aria-label="Tempo sugerido"
                >
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

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {confirming && (
                <button
                  onClick={() => setConfirming(null)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
              )}
              {total > 0 && confirming !== 'regen' && (
                <button
                  onClick={() =>
                    confirming === 'clear'
                      ? void clearAll()
                      : setConfirming('clear')
                  }
                  disabled={loading}
                  className={`btn btn-ghost ${confirming === 'clear' ? 'text-danger' : ''}`}
                >
                  {confirming === 'clear' ? 'Confirmar: apagar tudo' : 'Limpar'}
                </button>
              )}
              {confirming !== 'clear' && (
                <button
                  // Gerar substitui o plano inteiro no backend, então um plano
                  // existente exige confirmação em dois passos.
                  onClick={() =>
                    total > 0 && confirming !== 'regen'
                      ? setConfirming('regen')
                      : void generate()
                  }
                  disabled={loading || !minutesValid}
                  className={`btn ${confirming === 'regen' ? 'btn-ghost text-danger' : 'btn-primary'}`}
                >
                  {loading
                    ? 'Montando…'
                    : confirming === 'regen'
                      ? 'Confirmar: substituir a semana'
                      : total > 0
                        ? 'Gerar semana'
                        : 'Gerar cronograma'}
                </button>
              )}
            </div>
          </div>
          {!minutesValid && (
            <p id="minutes-hint" className="mt-2 text-xs text-danger">
              Entre {MIN_MINUTES} e {MAX_MINUTES} minutos.
            </p>
          )}
        </div>
      </PageHeader>

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
        <div className="card flex flex-wrap items-center gap-3 p-4 ring-1 ring-warning/30">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">
              Este cronograma já terminou
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Ele começou em {fmtDay(new Date(plan.createdAt))}. Gere uma nova
              semana para continuar.
            </p>
          </div>
          <button
            onClick={() => void generate()}
            disabled={loading || !minutesValid}
            className="btn btn-primary shrink-0"
          >
            Gerar nova
          </button>
        </div>
      )}

      {plan && todaySessions.length > 0 && (
        <section className="card card-raised flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand"
            aria-hidden
          >
            <IconCalendar width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Hoje</p>
            {/* Lista os blocos do dia em vez de eleger um "dominante": com
                dois blocos de mesma duração o desempate era arbitrário. */}
            <ul className="mt-1 flex flex-wrap items-center gap-1.5">
              {todaySessions.map((s) => (
                <li
                  key={s.id}
                  className={`chip ${s.done ? 'text-muted line-through' : ''}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      AREA_DOT[areaKey(s.subject?.name ?? s.label)]
                    }`}
                    aria-hidden
                  />
                  {shortSubject(s.label)}
                  <span className="font-data text-xs text-muted">
                    {s.minutes}min
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {todayDone && (
            <span className="chip shrink-0 bg-success/12 text-success">
              <IconCheck width={13} height={13} /> concluído
            </span>
          )}
          <div className="shrink-0 text-right">
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {done}
              <span className="text-muted">/{total}</span>
            </p>
            <p className="text-xs text-muted">blocos feitos</p>
          </div>
        </section>
      )}

      {/* Sugestões de nome compartilhadas por todos os campos do calendário. */}
      <datalist id="cronograma-materias">
        {subjectNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {!loaded ? (
        <div
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
          aria-busy
        >
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : plan === null ? (
        loadFailed ? null : (
          <section className="card p-8 text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-brand/12 text-brand">
              <IconCalendar width={48} height={48} />
            </span>
            <p className="mt-4 font-display text-base font-bold">
              Monte sua semana
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted text-pretty">
              Gere uma semana equilibrada entre as matérias do ENEM, ou comece
              do zero e escreva os blocos você mesmo.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => void generate()}
                disabled={loading || !minutesValid}
                className="btn btn-primary"
              >
                Gerar cronograma
              </button>
              <button
                onClick={() => void addBlock(0, 'Matemática')}
                className="btn btn-ghost"
              >
                <IconPlus width={14} height={14} />
                Começar do zero
              </button>
            </div>
          </section>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map((d) => (
            <DayCell
              key={d.dayIndex}
              date={d.date}
              dayIndex={d.dayIndex}
              sessions={d.sessions}
              isToday={sameDay(d.date, today)}
              isPast={d.date < today}
              onAdd={(day, label) => void addBlock(day, label)}
              onToggle={(s) => void toggleDone(s)}
              onRename={(s, label) => void rename(s, label)}
              onRetime={(s, m) => void retime(s, m)}
              onRemove={(s) => void removeBlock(s)}
            />
          ))}
        </div>
      )}

      {plan !== null && total === 0 && (
        <p className="text-center text-sm text-muted">
          Calendário vazio. Use “adicionar” em qualquer dia, ou gere uma semana
          automaticamente.
        </p>
      )}
    </div>
  );
}
