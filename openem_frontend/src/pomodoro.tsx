import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  type FocusSession,
  type GamificationDelta,
  type Subject,
} from './api';
import {
  clampConfig,
  DEFAULT_CONFIG,
  fmtClock,
  type PomodoroConfig,
  type PomodoroMode,
} from './lib/pomodoro';

/* ---------------------------------------------------------------------------
   Estado global do Pomodoro (issue #41).

   Vive acima das rotas: o cronômetro continua correndo enquanto o usuário
   navega, alimentando ao mesmo tempo o card da Home, a tela /pomodoro e o
   pop-up flutuante — os três leem a mesma sessão.

   A contagem é derivada de um instante-alvo (`endsAt`), nunca de um contador
   decrementado a cada tick: o navegador estrangula o setInterval de abas em
   segundo plano, e um contador decrementado atrasaria o relógio.
--------------------------------------------------------------------------- */

const STORAGE_KEY = 'openem:pomodoro:v1';

/** Toque curto de fim de fase. Acessório: qualquer falha é ignorada. */
function chime(enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.72);
    osc.onended = () => void ctx.close();
  } catch {
    /* som é acessório — nunca deve derrubar o timer */
  }
}

interface PersistedSession {
  config: PomodoroConfig;
  mode: PomodoroMode;
  paused: boolean;
  /** Instante-alvo (epoch ms) quando rodando; null quando pausado. */
  endsAt: number | null;
  /** Segundos restantes congelados quando pausado. */
  frozen: number;
  startedAt: string;
  subjectId: string;
  cycles: number;
  longBreak: boolean;
}

function loadPersisted(): Partial<PersistedSession> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedSession>) : {};
  } catch {
    return {};
  }
}

export interface PomodoroState {
  config: PomodoroConfig;
  setConfig: (next: Partial<PomodoroConfig>) => void;
  mode: PomodoroMode;
  paused: boolean;
  /** Segundos restantes na fase atual. */
  remaining: number;
  /** Duração total da fase atual, em segundos. */
  totalSec: number;
  /** Fração já decorrida da fase atual (0–1). */
  progress: number;
  /** Ciclos de foco concluídos desde que o app abriu. */
  cycles: number;
  /** A pausa em curso (ou a próxima) é a longa? */
  longBreak: boolean;
  subjectId: string;
  setSubjectId: (id: string) => void;
  subjects: Subject[];
  todayMinutes: number | null;
  saving: boolean;
  saved: FocusSession | null;
  award: GamificationDelta | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Abandona a fase atual e volta ao estado ocioso. */
  stop: () => void;
  /** Pula a pausa e volta ao estado ocioso, pronto para focar. */
  skipBreak: () => void;
  refreshToday: () => Promise<void>;
}

const PomodoroContext = createContext<PomodoroState | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  // Snapshot inicial lido do localStorage uma única vez. A sessão restaurada
  // só continua se ainda houver tempo: um ciclo que venceu com o app fechado
  // não vira sessão registrada (não sabemos se houve foco de verdade).
  const [{ config: initialConfig, restored }] = useState(() => {
    const persisted = loadPersisted();
    const left =
      persisted.endsAt != null && !persisted.paused
        ? Math.round((persisted.endsAt - Date.now()) / 1000)
        : (persisted.frozen ?? 0);
    const alive =
      (persisted.mode === 'focus' || persisted.mode === 'break') && left > 0;
    return {
      config: clampConfig(persisted.config ?? DEFAULT_CONFIG),
      restored: alive ? { ...persisted, left } : null,
    };
  });

  const [config, setConfigState] = useState<PomodoroConfig>(initialConfig);
  const [mode, setMode] = useState<PomodoroMode>(restored?.mode ?? 'idle');
  const [paused, setPaused] = useState(restored?.paused ?? false);
  const [endsAt, setEndsAt] = useState<number | null>(
    restored && !restored.paused ? (restored.endsAt ?? null) : null,
  );
  const [remaining, setRemaining] = useState(
    restored?.left ?? initialConfig.focusMin * 60,
  );
  const [cycles, setCycles] = useState(restored?.cycles ?? 0);
  const [longBreak, setLongBreak] = useState(restored?.longBreak ?? false);
  const [subjectId, setSubjectId] = useState(restored?.subjectId ?? '');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todayMinutes, setTodayMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<FocusSession | null>(null);
  const [award, setAward] = useState<GamificationDelta | null>(null);

  const startedAtRef = useRef<string>(
    restored?.startedAt ?? new Date().toISOString(),
  );
  // Guarda contra registrar a mesma sessão duas vezes (re-render, StrictMode).
  const finishingRef = useRef(false);

  const totalSec =
    mode === 'break'
      ? (longBreak ? config.longBreakMin : config.breakMin) * 60
      : config.focusMin * 60;

  const refreshToday = useCallback(async () => {
    try {
      const r = await api.focusToday();
      setTodayMinutes(r.minutes);
    } catch {
      setTodayMinutes(null); // offline/sem sessão: o timer funciona igual
    }
  }, []);

  useEffect(() => {
    void refreshToday();
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [refreshToday]);

  // Persiste config + sessão: recarregar a página não perde o ciclo em curso.
  useEffect(() => {
    const snapshot: PersistedSession = {
      config,
      mode,
      paused,
      endsAt,
      frozen: remaining,
      startedAt: startedAtRef.current,
      subjectId,
      cycles,
      longBreak,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* modo privado/quota: perder a persistência não quebra a sessão */
    }
  }, [config, mode, paused, endsAt, remaining, subjectId, cycles, longBreak]);

  // Tick de 1s recalculado a partir do alvo — imune ao throttle de aba oculta.
  useEffect(() => {
    if (endsAt == null || paused || mode === 'idle') return;
    const sync = () =>
      setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    const t = setInterval(sync, 1000);
    return () => clearInterval(t);
  }, [endsAt, paused, mode]);

  const beginPhase = useCallback((next: PomodoroMode, seconds: number) => {
    if (next === 'focus') startedAtRef.current = new Date().toISOString();
    setMode(next);
    setPaused(false);
    setRemaining(seconds);
    setEndsAt(Date.now() + seconds * 1000);
  }, []);

  const finishFocus = useCallback(async () => {
    const durationSec = config.focusMin * 60;
    setSaving(true);
    try {
      const res = await api.completeFocusSession({
        durationSec,
        startedAt: startedAtRef.current,
        subjectId: subjectId || undefined,
      });
      setSaved(res);
      setAward(res.gamification ?? null);
      setTodayMinutes((m) => (m ?? 0) + Math.round(durationSec / 60));
    } catch {
      setSaved(null); // falha silenciosa: o foco do usuário vem primeiro
    } finally {
      setSaving(false);
      const done = cycles + 1;
      const isLong =
        config.longBreakEvery > 0 && done % config.longBreakEvery === 0;
      setCycles(done);
      setLongBreak(isLong);
      beginPhase('break', (isLong ? config.longBreakMin : config.breakMin) * 60);
      chime(config.sound);
      finishingRef.current = false;
    }
  }, [config, subjectId, cycles, beginPhase]);

  // Fim de fase: foco registra a sessão e abre a pausa; pausa volta ao ocioso.
  useEffect(() => {
    if (mode === 'idle' || paused || remaining > 0) return;
    if (mode === 'focus') {
      if (finishingRef.current) return;
      finishingRef.current = true;
      void finishFocus();
      return;
    }
    chime(config.sound);
    setMode('idle');
    setEndsAt(null);
    setRemaining(config.focusMin * 60);
  }, [mode, paused, remaining, finishFocus, config.sound, config.focusMin]);

  // Relógio no título da aba — dá para acompanhar de outra janela.
  useEffect(() => {
    const base = 'OpENEM';
    if (mode === 'idle') {
      document.title = base;
      return;
    }
    document.title = `${fmtClock(remaining)} · ${
      mode === 'focus' ? 'Foco' : 'Pausa'
    } — ${base}`;
    return () => {
      document.title = base;
    };
  }, [mode, remaining]);

  const start = useCallback(() => {
    setSaved(null);
    setAward(null);
    beginPhase('focus', config.focusMin * 60);
  }, [beginPhase, config.focusMin]);

  const pause = useCallback(() => {
    setEndsAt((at) => {
      if (at != null)
        setRemaining(Math.max(0, Math.round((at - Date.now()) / 1000)));
      return null;
    });
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
    setEndsAt(Date.now() + remaining * 1000);
  }, [remaining]);

  const backToIdle = useCallback(() => {
    setMode('idle');
    setPaused(false);
    setEndsAt(null);
    setRemaining(config.focusMin * 60);
    setSaved(null);
    setAward(null);
  }, [config.focusMin]);

  const setConfig = useCallback((next: Partial<PomodoroConfig>) => {
    setConfigState((prev) => clampConfig({ ...prev, ...next }));
  }, []);

  // Mexer na duração do foco com o timer parado reflete no relógio na hora.
  useEffect(() => {
    if (mode === 'idle') setRemaining(config.focusMin * 60);
  }, [mode, config.focusMin]);

  const value = useMemo<PomodoroState>(
    () => ({
      config,
      setConfig,
      mode,
      paused,
      remaining,
      totalSec,
      progress: totalSec > 0 ? 1 - remaining / totalSec : 0,
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
      stop: backToIdle,
      skipBreak: backToIdle,
      refreshToday,
    }),
    [
      config,
      setConfig,
      mode,
      paused,
      remaining,
      totalSec,
      cycles,
      longBreak,
      subjectId,
      subjects,
      todayMinutes,
      saving,
      saved,
      award,
      start,
      pause,
      resume,
      backToIdle,
      refreshToday,
    ],
  );

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePomodoro(): PomodoroState {
  const ctx = useContext(PomodoroContext);
  if (!ctx)
    throw new Error('usePomodoro deve ser usado dentro de <PomodoroProvider>');
  return ctx;
}
