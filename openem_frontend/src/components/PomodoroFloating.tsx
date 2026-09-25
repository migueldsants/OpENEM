import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { fmtClock } from '../lib/pomodoro';
import { usePomodoro } from '../pomodoro';
import { PomodoroRing } from './PomodoroRing';
import { IconExpand, IconMinus, IconPause, IconPlay, IconX } from './icons';

/**
 * Pop-up flutuante do Pomodoro (issue #41): enquanto um ciclo roda, o
 * cronômetro acompanha o usuário pelo canto da tela em qualquer tela do app.
 * Some sozinho quando o timer está ocioso e quando já estamos em /pomodoro,
 * onde o relógio grande é o próprio conteúdo.
 */
export function PomodoroFloating() {
  const { mode, paused, remaining, progress, subjectId, subjects, longBreak, pause, resume, stop, skipBreak } =
    usePomodoro();
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  if (mode === 'idle' || pathname === '/pomodoro') return null;

  const focusing = mode === 'focus';
  const tone = focusing ? 'text-brand' : 'text-success';
  const subject = subjects.find((s) => s.id === subjectId)?.name;
  const label = focusing
    ? paused
      ? 'Foco pausado'
      : 'Focando'
    : longBreak
      ? 'Pausa longa'
      : 'Pausa';

  // z-[25]: acima da tabbar (z-20) e abaixo do bottom-sheet "Mais" (z-30).
  // --dock: sobe acima de uma barra fixa da página (ver DockOffset).
  const anchor =
    'fixed right-4 bottom-[calc(6rem+var(--dock,0rem))] z-[25] md:bottom-[calc(1.5rem+var(--dock,0rem))] md:right-6 print:hidden';

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={`${label}, ${fmtClock(remaining)} restantes. Abrir o cronômetro`}
        className={`${anchor} card card-raised lift flex items-center gap-2 py-2 pl-2 pr-3 ${tone}`}
      >
        <PomodoroRing progress={progress} size={30} stroke={3} />
        <span className="font-data text-sm font-bold tabular-nums text-fg">
          {fmtClock(remaining)}
        </span>
      </button>
    );
  }

  return (
    <section
      aria-label="Cronômetro Pomodoro"
      className={`${anchor} card card-raised animate-fade w-[15.5rem] p-3`}
    >
      <div className="flex items-center gap-2.5">
        <PomodoroRing progress={progress} size={44} className={tone}>
          <span className={`font-data text-xs font-bold ${tone}`}>
            {focusing ? 'FOCO' : 'PAUSA'}
          </span>
        </PomodoroRing>

        <div className="min-w-0 flex-1">
          <p className="font-data text-2xl font-bold leading-none tabular-nums">
            {fmtClock(remaining)}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {label}
            {focusing && subject ? ` · ${subject}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Minimizar cronômetro"
          title="Minimizar"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <IconMinus width={15} height={15} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5">
        {focusing ? (
          <button
            type="button"
            onClick={paused ? resume : pause}
            className="btn btn-ghost h-8 px-2.5 text-xs"
          >
            {paused ? (
              <>
                <IconPlay width={13} height={13} filled /> Retomar
              </>
            ) : (
              <>
                <IconPause width={13} height={13} /> Pausar
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={skipBreak}
            className="btn btn-ghost h-8 px-2.5 text-xs"
          >
            <IconPlay width={13} height={13} filled /> Pular pausa
          </button>
        )}

        {focusing && (
          <button
            type="button"
            onClick={stop}
            aria-label="Abandonar sessão"
            title="Abandonar"
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <IconX width={14} height={14} />
          </button>
        )}

        <NavLink
          to="/pomodoro"
          aria-label="Abrir a tela do Pomodoro"
          title="Abrir tela cheia"
          className="ml-auto grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <IconExpand width={14} height={14} />
        </NavLink>
      </div>
    </section>
  );
}
