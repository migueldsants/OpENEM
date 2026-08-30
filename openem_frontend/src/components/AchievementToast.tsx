import { useEffect, useState } from 'react';
import type { Achievement } from '../api';

/**
 * Toast de desbloqueio de conquista (issue #48): slide-up + fade no canto
 * inferior direito, ~5s por conquista, empilhável.
 */
function Toast({
  a,
  index,
  onDone,
}: {
  a: Achievement;
  index: number;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const out = setTimeout(() => setLeaving(true), 4300);
    const gone = setTimeout(onDone, 4900);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      style={{ bottom: `calc(${index} * 5rem + 1rem)` }}
      className={`card fixed right-4 z-50 flex w-72 items-center gap-3 border border-line bg-surface p-3 shadow-[var(--shadow)] transition-all duration-500 ${
        leaving
          ? 'translate-y-2 opacity-0'
          : 'translate-y-0 animate-[toast-in_.5s_ease-out]'
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-2xl">
        {a.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-brand">Conquista desbloqueada</p>
        <p className={`truncate font-display font-bold ${a.color}`}>{a.name}</p>
        <p className="truncate text-xs text-muted">{a.description}</p>
      </div>
      <span className="shrink-0 rounded-md bg-brand/12 px-2 py-1 text-xs font-bold text-brand">
        +{a.xp} XP
      </span>
    </div>
  );
}

/** Pilha de toasts — um por conquista desbloqueada (issue #48). */
export function AchievementToasts({ list }: { list: Achievement[] }) {
  const [shown, setShown] = useState<Achievement[]>([]);

  useEffect(() => {
    if (list.length > 0) setShown(list);
  }, [list]);

  if (shown.length === 0) return null;
  return (
    <div aria-live="polite">
      {shown.map((a, i) => (
        <Toast
          key={a.code}
          a={a}
          index={i}
          onDone={() =>
            setShown((cur) => cur.filter((x) => x.code !== a.code))
          }
        />
      ))}
    </div>
  );
}