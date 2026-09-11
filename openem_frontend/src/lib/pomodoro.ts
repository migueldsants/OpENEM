// Núcleo puro do Pomodoro (issue #41): configuração, limites e formatação.
// Fica separado do provider (`src/pomodoro.tsx`) para poder ser testado sem
// React — e para o fast refresh não reclamar de módulo misto.

export type PomodoroMode = 'idle' | 'focus' | 'break';

export interface PomodoroConfig {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  /** Ciclos de foco até a pausa longa; 0 desliga a pausa longa. */
  longBreakEvery: number;
  /** Toque curto ao fim de cada fase. */
  sound: boolean;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  sound: true,
};

/** Presets prontos — cobrem os ritmos mais comuns sem abrir os ajustes. */
export const PRESETS: {
  key: string;
  label: string;
  hint: string;
  config: Omit<PomodoroConfig, 'sound'>;
}[] = [
  {
    key: 'classico',
    label: 'Clássico',
    hint: '25 / 5',
    config: { focusMin: 25, breakMin: 5, longBreakMin: 15, longBreakEvery: 4 },
  },
  {
    key: 'curto',
    label: 'Curto',
    hint: '15 / 3',
    config: { focusMin: 15, breakMin: 3, longBreakMin: 10, longBreakEvery: 4 },
  },
  {
    key: 'imersao',
    label: 'Imersão',
    hint: '50 / 10',
    config: { focusMin: 50, breakMin: 10, longBreakMin: 20, longBreakEvery: 2 },
  },
];

/** Limites do backend: a sessão vai de 30s a 4h (CompleteFocusSessionDto). */
const MIN_FOCUS_MIN = 1;
const MAX_FOCUS_MIN = 240;

/** Normaliza a config vinda do formulário ou do localStorage. */
export function clampConfig(c: Partial<PomodoroConfig>): PomodoroConfig {
  const int = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback;
  const between = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  return {
    focusMin: between(
      int(c.focusMin, DEFAULT_CONFIG.focusMin),
      MIN_FOCUS_MIN,
      MAX_FOCUS_MIN,
    ),
    breakMin: between(int(c.breakMin, DEFAULT_CONFIG.breakMin), 1, 60),
    longBreakMin: between(
      int(c.longBreakMin, DEFAULT_CONFIG.longBreakMin),
      1,
      60,
    ),
    longBreakEvery: between(
      int(c.longBreakEvery, DEFAULT_CONFIG.longBreakEvery),
      0,
      12,
    ),
    sound: c.sound ?? DEFAULT_CONFIG.sound,
  };
}

/** `1500` → `"25:00"`; acima de uma hora vira `"1:05:00"`. */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${rest}`;
  return `${m}:${rest}`;
}

/** `95` → `"1 h 35 min"` — usado nas estatísticas da tela. */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
