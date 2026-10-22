// Dia de estudo no fuso de Brasília. Em UTC o dia virava às 21h: quem estuda
// à noite via a questão das 22h cair no dia seguinte, a sequência pular e o
// desafio diário renovar no meio da noite.
//
// O dia é sempre um rótulo de calendário ("2026-10-21"); para gravar em coluna
// DateTime ele vira a meia-noite UTC daquela data (`dayLabelDate`), que é só
// um rótulo, não o instante em que o dia começa (`startOfStudyDay`).

export const STUDY_TIME_ZONE = 'America/Sao_Paulo';

const DAY_MS = 86_400_000;

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: STUDY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: STUDY_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** Dia de calendário em Brasília, como "2026-10-21". */
export function studyDay(date: Date): string {
  return dateFormat.format(date);
}

/** Soma dias a uma data "AAAA-MM-DD" (aritmética de calendário, sem fuso). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Dias de calendário de `from` até `to` (negativo se `to` vem antes). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (dayLabelDate(to).getTime() - dayLabelDate(from).getTime()) / DAY_MS,
  );
}

/** Segunda-feira da semana do dia (a semana vai de segunda a domingo). */
export function weekStart(day: string): string {
  const weekday = dayLabelDate(day).getUTCDay(); // 0 = domingo
  return addDays(day, -((weekday + 6) % 7));
}

/** Meia-noite UTC da data: o rótulo do dia numa coluna DateTime. */
export function dayLabelDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Diferença entre o relógio de Brasília e o UTC naquele instante (ms). */
function zoneOffsetMs(at: Date): number {
  const p = Object.fromEntries(
    clockFormat.formatToParts(at).map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return wall - (at.getTime() - at.getMilliseconds());
}

/** Instante em que o dia começa em Brasília (00:00 local). */
export function startOfStudyDay(day: string): Date {
  const midnightUtc = dayLabelDate(day).getTime();
  return new Date(midnightUtc - zoneOffsetMs(new Date(midnightUtc)));
}
