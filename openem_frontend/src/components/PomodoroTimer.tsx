import { NavLink } from 'react-router-dom';
import { fmtClock } from '../lib/pomodoro';
import { usePomodoro } from '../pomodoro';
import { GamificationFeedback } from './GamificationFeedback';
import { IconPause, IconPlay, IconTimer, IconX } from './icons';

/**
 * Card do Modo Foco na Home (issue #41): atalho para começar um ciclo sem sair
 * da tela inicial. O cronômetro em si vive no <PomodoroProvider>, então este
 * card, o pop-up flutuante e a tela /pomodoro mostram sempre a mesma sessão.
 */
export function PomodoroTimer() {
  const {
    config,
    mode,
    paused,
    remaining,
    progress,
    todayMinutes,
    subjects,
    subjectId,
    setSubjectId,
    saving,
    saved,
    award,
    start,
    pause,
    resume,
    stop,
    skipBreak,
    longBreak,
  } = usePomodoro();

  const idle = mode === 'idle';
  const focusing = mode === 'focus';
  const label = focusing
    ? paused
      ? 'Pausado'
      : 'Focando…'
    : mode === 'break'
      ? longBreak
        ? 'Pausa longa'
        : 'Pausa'
      : 'Pronto para focar';
  const pct = Math.round(progress * 100);

  return (
    <div className="card card-raised p-4">
      <div className="flex items-center gap-3">
        <NavLink
          to="/pomodoro"
          aria-label="Abrir a tela do Pomodoro"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand transition-colors hover:bg-brand/20"
        >
          <IconTimer width={22} height={22} />
        </NavLink>
        <div className="min-w-0 flex-1">
          <NavLink to="/pomodoro" className="font-display font-bold">
            Modo Foco
          </NavLink>
          <p className="text-xs text-muted">
            {todayMinutes !== null ? `${todayMinutes} min de foco hoje` : label}
          </p>
        </div>
        {idle && (
          <button onClick={start} className="btn btn-primary shrink-0">
            <IconPlay width={14} height={14} filled /> Focar {config.focusMin}{' '}
            min
          </button>
        )}
      </div>

      {award && (
        <div className="mt-2">
          <GamificationFeedback g={award} />
        </div>
      )}

      {!idle && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-data text-3xl font-extrabold tabular-nums">
              {fmtClock(remaining)}
            </span>
            <span className="text-xs font-semibold text-muted">{label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          {focusing && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={paused ? resume : pause}
                className="btn btn-ghost"
              >
                {paused ? (
                  <>
                    <IconPlay width={14} height={14} /> Retomar
                  </>
                ) : (
                  <>
                    <IconPause width={14} height={14} /> Pausar
                  </>
                )}
              </button>
              <button onClick={stop} className="btn btn-ghost text-red">
                <IconX width={14} height={14} /> Abandonar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Escolha de matéria antes de iniciar (issue #41). */}
      {idle && subjects.length > 0 && (
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          aria-label="Matéria da sessão"
          className="input mt-3 w-full"
        >
          <option value="">Sem matéria</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {mode === 'break' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">
            {saving
              ? 'Registrando sessão…'
              : saved
                ? `Sessão registrada${
                    saved.subjectName ? ` — ${saved.subjectName}` : ''
                  }! Faça uma pausa de ${
                    longBreak ? config.longBreakMin : config.breakMin
                  } min.`
                : `Pausa de ${
                    longBreak ? config.longBreakMin : config.breakMin
                  } minutos — respire e alongue.`}
          </p>
          <button onClick={skipBreak} className="btn btn-primary">
            Nova sessão
          </button>
        </div>
      )}
    </div>
  );
}
