// Testes do núcleo puro do Pomodoro (issue #41).
import { describe, it, expect } from 'vitest';
import {
  clampConfig,
  DEFAULT_CONFIG,
  fmtClock,
  fmtMinutes,
  PRESETS,
} from './pomodoro';

describe('lib/pomodoro — fmtClock', () => {
  it('formata minutos e segundos com dois dígitos', () => {
    expect(fmtClock(1500)).toBe('25:00');
    expect(fmtClock(59)).toBe('0:59');
    expect(fmtClock(61)).toBe('1:01');
  });

  it('passa a exibir horas acima de 60 min', () => {
    expect(fmtClock(3600)).toBe('1:00:00');
    expect(fmtClock(3900)).toBe('1:05:00');
  });

  it('nunca fica negativo', () => {
    expect(fmtClock(-10)).toBe('0:00');
  });
});

describe('lib/pomodoro — fmtMinutes', () => {
  it('mostra só minutos abaixo de uma hora', () => {
    expect(fmtMinutes(0)).toBe('0 min');
    expect(fmtMinutes(59)).toBe('59 min');
  });

  it('quebra em horas a partir de 60', () => {
    expect(fmtMinutes(60)).toBe('1 h');
    expect(fmtMinutes(95)).toBe('1 h 35 min');
    expect(fmtMinutes(120)).toBe('2 h');
  });
});

describe('lib/pomodoro — clampConfig', () => {
  it('mantém uma configuração válida', () => {
    expect(clampConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
  });

  it('limita o foco à faixa aceita pelo backend (1–240 min)', () => {
    expect(clampConfig({ focusMin: 0 }).focusMin).toBe(1);
    expect(clampConfig({ focusMin: 9999 }).focusMin).toBe(240);
  });

  it('limita as pausas e o intervalo da pausa longa', () => {
    expect(clampConfig({ breakMin: 0 }).breakMin).toBe(1);
    expect(clampConfig({ longBreakMin: 999 }).longBreakMin).toBe(60);
    expect(clampConfig({ longBreakEvery: -3 }).longBreakEvery).toBe(0);
    expect(clampConfig({ longBreakEvery: 50 }).longBreakEvery).toBe(12);
  });

  it('cai no padrão para valores não numéricos (input vazio, JSON corrompido)', () => {
    expect(clampConfig({ focusMin: NaN }).focusMin).toBe(
      DEFAULT_CONFIG.focusMin,
    );
    expect(
      clampConfig({ breakMin: 'abc' as unknown as number }).breakMin,
    ).toBe(DEFAULT_CONFIG.breakMin);
  });

  it('arredonda frações e preserva a preferência de som', () => {
    expect(clampConfig({ focusMin: 25.6 }).focusMin).toBe(26);
    expect(clampConfig({ sound: false }).sound).toBe(false);
    expect(clampConfig({}).sound).toBe(true);
  });
});

describe('lib/pomodoro — PRESETS', () => {
  it('todos os presets sobrevivem ao clamp sem alteração', () => {
    for (const p of PRESETS) {
      expect(clampConfig(p.config)).toEqual({ ...p.config, sound: true });
    }
  });
});
