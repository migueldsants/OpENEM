import {
  addDays,
  dayLabelDate,
  daysBetween,
  startOfStudyDay,
  studyDay,
  weekStart,
} from './study-day';

describe('studyDay', () => {
  it('a noite de Brasília continua no mesmo dia (em UTC já seria o seguinte)', () => {
    // 22h de 21/10 em Brasília = 01h de 22/10 em UTC.
    expect(studyDay(new Date('2026-10-22T01:00:00Z'))).toBe('2026-10-21');
    expect(studyDay(new Date('2026-10-22T02:59:59Z'))).toBe('2026-10-21');
  });

  it('o dia vira à meia-noite de Brasília (03h UTC)', () => {
    expect(studyDay(new Date('2026-10-22T03:00:00Z'))).toBe('2026-10-22');
  });
});

describe('addDays / daysBetween / weekStart', () => {
  it('soma e subtrai atravessando mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('conta dias de calendário entre duas datas', () => {
    expect(daysBetween('2026-10-20', '2026-10-21')).toBe(1);
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0);
    expect(daysBetween('2026-10-21', '2026-10-19')).toBe(-2);
  });

  it('a semana começa na segunda', () => {
    expect(weekStart('2026-10-21')).toBe('2026-10-19'); // quarta
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // segunda
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // domingo
  });
});

describe('dayLabelDate / startOfStudyDay', () => {
  it('o rótulo é a meia-noite UTC da data', () => {
    expect(dayLabelDate('2026-10-21').toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    );
  });

  it('o dia começa às 03h UTC (Brasília é UTC-3)', () => {
    expect(startOfStudyDay('2026-10-21').toISOString()).toBe(
      '2026-10-21T03:00:00.000Z',
    );
    expect(studyDay(startOfStudyDay('2026-10-21'))).toBe('2026-10-21');
    expect(
      studyDay(new Date(startOfStudyDay('2026-10-21').getTime() - 1)),
    ).toBe('2026-10-20');
  });
});
