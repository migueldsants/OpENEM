import { blockDay, weekMinutes } from './weekly-goal-minutes';

// Plano criado na segunda 05/10/2026, 10h de Brasília.
const PLAN = new Date('2026-10-05T13:00:00Z');
const block = (dayIndex: number, minutes = 45) => ({
  planCreatedAt: PLAN,
  dayIndex,
  minutes,
});

describe('blockDay', () => {
  it('é o dia de criação do plano (Brasília) mais o dayIndex', () => {
    expect(blockDay(PLAN, 0)).toBe('2026-10-05');
    expect(blockDay(PLAN, 9)).toBe('2026-10-14');
  });

  it('plano criado às 22h de Brasília começa naquele dia, não no seguinte', () => {
    expect(blockDay(new Date('2026-10-06T01:00:00Z'), 0)).toBe('2026-10-05');
  });
});

describe('weekMinutes', () => {
  it('na 2ª semana do mesmo plano conta os blocos daquela semana (antes zerava)', () => {
    const blocks = [block(0), block(6), block(7, 30), block(13, 20)];
    expect(weekMinutes(blocks, [], '2026-10-05')).toBe(90);
    expect(weekMinutes(blocks, [], '2026-10-12')).toBe(50);
    expect(weekMinutes(blocks, [], '2026-10-19')).toBe(0);
  });

  it('soma o Pomodoro concluído na semana', () => {
    const focus = [
      { completedAt: new Date('2026-10-13T15:00:00Z'), durationSec: 25 * 60 },
      { completedAt: new Date('2026-10-14T15:00:00Z'), durationSec: 25 * 60 },
      // fora da semana
      { completedAt: new Date('2026-10-20T15:00:00Z'), durationSec: 60 * 60 },
    ];
    expect(weekMinutes([block(7, 30)], focus, '2026-10-12')).toBe(80);
  });

  it('sessão de foco no domingo às 22h de Brasília ainda é desta semana', () => {
    // Domingo 18/10, 22h em Brasília = segunda 19/10, 01h em UTC.
    const focus = [
      { completedAt: new Date('2026-10-19T01:00:00Z'), durationSec: 50 * 60 },
    ];
    expect(weekMinutes([], focus, '2026-10-12')).toBe(50);
    expect(weekMinutes([], focus, '2026-10-19')).toBe(0);
  });

  it('arredonda os segundos do Pomodoro só no total e ignora duração inválida', () => {
    const at = new Date('2026-10-13T15:00:00Z');
    const focus = [
      { completedAt: at, durationSec: 40 },
      { completedAt: at, durationSec: 40 },
      { completedAt: at, durationSec: -600 },
    ];
    expect(weekMinutes([], focus, '2026-10-12')).toBe(1);
  });
});
