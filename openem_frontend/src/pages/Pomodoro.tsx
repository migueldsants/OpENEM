import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type FocusSession, type FocusMinutesBySubject } from '../api';
import { EmptyState } from '../components/EmptyState';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { PomodoroRing } from '../components/PomodoroRing';
import Reveal from '../components/Reveal';
import { SkeletonCard } from '../components/Skeleton';
import {
  IconCheck,
  IconClock,
  IconPause,
  IconPlay,
  IconTimer,
  IconX,
} from '../components/icons';
import { AREA_DOT, AREA_TEXT, areaKey } from '../lib/areas';
import { fmtClock, fmtMinutes, PRESETS } from '../lib/pomodoro';
import { usePomodoro } from '../pomodoro';

const HISTORY_DAYS = 30;

/** Rótulo de dia relativo: "Hoje", "Ontem" ou a data curta. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Campo numérico de minutos usado nos ajustes. */
function MinuteField({
  label,
  value,
  min,
  max,
  onChange,
  suffix = 'min',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input w-20 text-center font-data tabular-nums"
        />
        <span className="text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}

/** Bloco de estatística compacto. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3.5">
      <p className="font-data text-xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

/**
 * Tela dedicada do Pomodoro (issue #41): relógio grande, ajuste de ciclos e o
 * histórico de foco. O cronômetro em si mora no <PomodoroProvider>, então sair
 * desta tela não interrompe a sessão — ela continua no pop-up flutuante.
 */
export default function Pomodoro() {
  const {
    config,
    setConfig,
    mode,
    paused,
    remaining,
    progress,
    cycles,
    longBreak,
    subjectId,
    setSubjectId,
    subjects,
    todayMinutes,
    saving,
    saved,
    award,
    start,
    pause,
    resume,
    stop,
    skipBreak,
  } = usePomodoro();

  const [history, setHistory] = useState<FocusSession[] | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [bySubject, setBySubject] = useState<FocusMinutesBySubject[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        api.focusHistory(HISTORY_DAYS),
        api.focusBySubject(HISTORY_DAYS),
      ]);
      setHistory(h.sessions);
      setTotalMinutes(h.totalMinutes);
      setBySubject(s.filter((x) => x.minutes > 0));
    } catch {
      setHistory([]); // sem histórico a tela ainda serve para focar
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Cada sessão concluída (`saved` muda) invalida o histórico exibido.
  useEffect(() => {
    if (saved) void load();
  }, [saved, load]);

  const focusing = mode === 'focus';
  const idle = mode === 'idle';
  const tone = idle || focusing ? 'text-brand' : 'text-nat';

  const phaseLabel = idle
    ? 'Pronto para focar'
    : focusing
      ? paused
        ? 'Pausado'
        : 'Focando…'
      : longBreak
        ? 'Pausa longa'
        : 'Pausa curta';

  const grouped = useMemo(() => {
    const map = new Map<string, FocusSession[]>();
    for (const s of history ?? []) {
      const key = dayLabel(s.completedAt);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [history]);

  const maxSubjectMin = Math.max(1, ...bySubject.map((s) => s.minutes));
  // Bolinhas do ciclo atual rumo à pausa longa (0 = pausa longa desligada).
  const ring = config.longBreakEvery;
  const doneInRing = ring > 0 ? cycles % ring : 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Modo Foco</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Pomodoro
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted text-pretty">
          Blocos de foco cronometrados com pausas curtas. Cada ciclo concluído
          vira minutos de estudo e XP — e o cronômetro te acompanha pelo app.
        </p>
      </header>

      {/* ---- Relógio ---- */}
      <Reveal>
        <section className="card card-raised p-6 text-center sm:p-8">
          <div className="flex flex-col items-center">
            <PomodoroRing
              progress={idle ? 0 : progress}
              size={228}
              stroke={10}
              className={tone}
            >
              <span className="flex flex-col items-center">
                <span className="font-data text-5xl font-extrabold tabular-nums sm:text-6xl">
                  {fmtClock(remaining)}
                </span>
                <span className="mt-1 text-xs font-semibold text-muted">
                  {phaseLabel}
                </span>
              </span>
            </PomodoroRing>

            {/* Progresso rumo à pausa longa. */}
            {ring > 0 && (
              <div
                className="mt-5 flex items-center gap-1.5"
                aria-label={`${doneInRing} de ${ring} ciclos até a pausa longa`}
              >
                {Array.from({ length: ring }, (_, i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-full transition-colors ${
                      i < doneInRing ? 'bg-brand' : 'bg-surface-2'
                    }`}
                  />
                ))}
                <span className="ml-1.5 text-xs text-muted">
                  {cycles} {cycles === 1 ? 'ciclo hoje' : 'ciclos hoje'}
                </span>
              </div>
            )}

            {/* Matéria: só antes de começar, para não trocar no meio do ciclo. */}
            {idle && subjects.length > 0 && (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                aria-label="Matéria da sessão"
                className="input mt-5 w-full max-w-xs"
              >
                <option value="">Sem matéria</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {idle && (
                <button onClick={start} className="btn btn-primary">
                  <IconPlay width={15} height={15} filled /> Focar{' '}
                  {config.focusMin} min
                </button>
              )}
              {focusing && (
                <>
                  <button
                    onClick={paused ? resume : pause}
                    className="btn btn-primary"
                  >
                    {paused ? (
                      <>
                        <IconPlay width={15} height={15} filled /> Retomar
                      </>
                    ) : (
                      <>
                        <IconPause width={15} height={15} /> Pausar
                      </>
                    )}
                  </button>
                  <button onClick={stop} className="btn btn-ghost text-red">
                    <IconX width={14} height={14} /> Abandonar
                  </button>
                </>
              )}
              {mode === 'break' && (
                <button onClick={skipBreak} className="btn btn-primary">
                  <IconPlay width={15} height={15} filled /> Pular pausa
                </button>
              )}
            </div>

            {mode === 'break' && (
              <p className="mt-3 text-sm text-muted">
                {saving
                  ? 'Registrando sessão…'
                  : saved
                    ? `Sessão registrada${
                        saved.subjectName ? ` — ${saved.subjectName}` : ''
                      }! Levante, beba água, alongue.`
                    : 'Levante, beba água, alongue.'}
              </p>
            )}

            {award && (
              <div className="mt-3 w-full max-w-sm">
                <GamificationFeedback g={award} />
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* ---- Ajustes ---- */}
      <Reveal delay={60}>
        <section className="card p-4">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <IconTimer width={18} height={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">
                Ciclos e duração
              </span>
              <span className="block text-xs text-muted">
                {config.focusMin} min de foco · {config.breakMin} min de pausa
                {config.longBreakEvery > 0
                  ? ` · ${config.longBreakMin} min a cada ${config.longBreakEvery} ciclos`
                  : ''}
              </span>
            </span>
            <span className="text-xs font-semibold text-brand">
              {settingsOpen ? 'Fechar' : 'Ajustar'}
            </span>
          </button>

          {settingsOpen && (
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const active =
                    config.focusMin === p.config.focusMin &&
                    config.breakMin === p.config.breakMin;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setConfig(p.config)}
                      data-active={active}
                      className="chip"
                    >
                      {active && <IconCheck width={13} height={13} />}
                      {p.label}
                      <span className="ml-1 font-data text-[0.7rem] opacity-70">
                        {p.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MinuteField
                  label="Foco"
                  value={config.focusMin}
                  min={1}
                  max={240}
                  onChange={(focusMin) => setConfig({ focusMin })}
                />
                <MinuteField
                  label="Pausa curta"
                  value={config.breakMin}
                  min={1}
                  max={60}
                  onChange={(breakMin) => setConfig({ breakMin })}
                />
                <MinuteField
                  label="Pausa longa"
                  value={config.longBreakMin}
                  min={1}
                  max={60}
                  onChange={(longBreakMin) => setConfig({ longBreakMin })}
                />
                <MinuteField
                  label="Pausa longa a cada"
                  value={config.longBreakEvery}
                  min={0}
                  max={12}
                  suffix="ciclos"
                  onChange={(longBreakEvery) => setConfig({ longBreakEvery })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.sound}
                  onChange={(e) => setConfig({ sound: e.target.checked })}
                  className="size-4 accent-[var(--brand)]"
                />
                Tocar um som ao fim de cada fase
              </label>

              {!idle && (
                <p className="text-xs text-muted">
                  As mudanças valem a partir do próximo ciclo — o atual segue com
                  a duração em que começou.
                </p>
              )}
            </div>
          )}
        </section>
      </Reveal>

      {/* ---- Estatísticas ---- */}
      <Reveal delay={120}>
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Seu foco</h2>
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="hoje"
              value={todayMinutes !== null ? fmtMinutes(todayMinutes) : '—'}
            />
            <Stat label={`em ${HISTORY_DAYS} dias`} value={fmtMinutes(totalMinutes)} />
            <Stat label="sessões" value={String(history?.length ?? 0)} />
          </div>
        </section>
      </Reveal>

      {/* ---- Foco por matéria ---- */}
      {bySubject.length > 0 && (
        <Reveal delay={180}>
          <section className="card p-4">
            <h2 className="font-display text-lg font-bold">Por matéria</h2>
            <ul className="mt-3 space-y-2.5">
              {bySubject.map((s) => {
                const k = areaKey(s.subjectName);
                return (
                  <li key={s.subjectId ?? 'none'}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${AREA_DOT[k]}`}
                        />
                        <span className="truncate">{s.subjectName}</span>
                      </span>
                      <span
                        className={`shrink-0 font-data text-xs font-bold tabular-nums ${AREA_TEXT[k]}`}
                      >
                        {fmtMinutes(s.minutes)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${AREA_DOT[k]}`}
                        style={{
                          width: `${Math.round((s.minutes / maxSubjectMin) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      )}

      {/* ---- Histórico ---- */}
      <Reveal delay={240}>
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Histórico</h2>
          {history === null ? (
            <SkeletonCard />
          ) : history.length === 0 ? (
            <EmptyState
              icon={IconClock}
              title="Nenhuma sessão ainda"
              description="Rode um ciclo de foco e ele aparece aqui, com a matéria e o horário."
              tip="Escolher a matéria antes de começar alimenta o gráfico por matéria."
            />
          ) : (
            <div className="space-y-4">
              {grouped.map(([day, sessions]) => (
                <div key={day}>
                  <p className="eyebrow">{day}</p>
                  <ul className="mt-2 space-y-1.5">
                    {sessions.map((s) => {
                      const k = areaKey(s.subjectName ?? undefined);
                      return (
                        <li
                          key={s.id}
                          className="card flex items-center gap-3 px-3.5 py-2.5"
                        >
                          <span
                            className={`size-2 shrink-0 rounded-full ${AREA_DOT[k]}`}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {s.subjectName ?? 'Sem matéria'}
                          </span>
                          <span className="shrink-0 font-data text-xs font-bold tabular-nums">
                            {Math.round(s.durationSec / 60)} min
                          </span>
                          <span className="shrink-0 font-data text-xs text-muted tabular-nums">
                            {hhmm(s.completedAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
