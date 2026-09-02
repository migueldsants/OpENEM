import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type FocusSession,
  type GamificationDelta,
  type Subject,
} from '../api';
import { GamificationFeedback } from './GamificationFeedback';
import { IconPause, IconPlay, IconTimer, IconX } from './icons';

type Phase = 'idle' | 'focusing' | 'paused' | 'break';

/** Pomodoro padrão: 25 min de foco / 5 min de pausa. */
const FOCUS_SEC = 25 * 60;
const BREAK_SEC = 5 * 60;

function fmtClock(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * Modo Foco / Pomodoro (issue #41): cronômetro 25/5 com seleção de matéria,
 * registro automático da sessão concluída (com XP) e minutos de foco hoje.
 */
export function PomodoroTimer() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(FOCUS_SEC);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [todayMinutes, setTodayMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<FocusSession | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());

  // Minutos de foco de hoje (widget) — recarrega quando o widget abre.
  useEffect(() => {
    void api
      .focusToday()
      .then((r) => setTodayMinutes(r.minutes))
      .catch(() => setTodayMinutes(null));
  }, []);

  // Catálogo de matérias (uma vez).
  useEffect(() => {
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  const finishFocus = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.completeFocusSession({
        durationSec: FOCUS_SEC,
        startedAt: startedAtRef.current,
        subjectId: subjectId || undefined,
      });
      setSaved(res);
      setAward(res.gamification ?? null);
      setTodayMinutes((m) => (m ?? 0) + 25);
    } catch {
      setSaved(null); // falha silenciosa: o foco do usuário vem primeiro
    } finally {
      setSaving(false);
      setPhase('break');
      setRemaining(BREAK_SEC);
    }
  }, [subjectId]);

  // Tick do timer (1s) durante o foco.
  useEffect(() => {
    if (phase !== 'focusing') return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Chegou ao zero: registra a sessão (uma vez — guard por saving/phase).
  useEffect(() => {
    if (phase !== 'focusing' || remaining > 0 || saving) return;
    void finishFocus();
  }, [phase, remaining, saving, finishFocus]);

  function start() {
    startedAtRef.current = new Date().toISOString();
    setSaved(null);
    setAward(null);
    setRemaining(FOCUS_SEC);
    setPhase('focusing');
  }

  function breakDone() {
    setPhase('idle');
    setRemaining(FOCUS_SEC);
    setSaved(null);
    setAward(null);
  }

  const label =
    phase === 'focusing'
      ? 'Focando…'
      : phase === 'paused'
        ? 'Pausado'
        : 'Pronto para focar';
  const pct = Math.round(((FOCUS_SEC - remaining) / FOCUS_SEC) * 100);

  return (
    <div className="card card-raised p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <IconTimer width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Modo Foco</p>
          <p className="text-xs text-muted">
            {todayMinutes !== null ? `${todayMinutes} min de foco hoje` : label}
          </p>
        </div>
        {phase === 'idle' && (
          <button onClick={start} className="btn btn-primary shrink-0">
            <IconPlay width={14} height={14} filled /> Focar 25 min
          </button>
        )}
      </div>

      {award && (
        <div className="mt-2">
          <GamificationFeedback g={award} />
        </div>
      )}

      {(phase === 'focusing' || phase === 'paused') && (
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
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'focusing' ? (
              <button
                onClick={() => setPhase('paused')}
                className="btn btn-ghost"
              >
                <IconPause width={14} height={14} /> Pausar
              </button>
            ) : (
              <button onClick={() => setPhase('focusing')} className="btn btn-ghost">
                <IconPlay width={14} height={14} /> Retomar
              </button>
            )}
            <button onClick={start} className="btn btn-ghost text-red">
              <IconX width={14} height={14} /> Abandonar
            </button>
          </div>
        </div>
      )}

      {/* Escolha de matéria antes de iniciar (issue #41). */}
      {phase === 'idle' && subjects.length > 0 && (
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

      {phase === 'break' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">
            {saving
              ? 'Registrando sessão…'
              : saved
                ? `Sessão registrada${saved.subjectName ? ` — ${saved.subjectName}` : ''}! Faça uma pausa de 5 min.`
                : 'Pausa de 5 minutos — respire e alongue.'}
          </p>
          <button onClick={breakDone} className="btn btn-primary">
            Nova sessão
          </button>
        </div>
      )}
    </div>
  );
}