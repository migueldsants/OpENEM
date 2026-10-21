// Minutos de estudo de uma meta semanal (issue #44). Duas fontes somam:
// - blocos concluídos do cronograma, cada um no dia do calendário em que está
//   (o dia de criação do plano + `dayIndex`, como a tela Cronograma mostra);
// - sessões de foco do Pomodoro (`FocusSession`), pelo dia em que terminaram.
// Antes só contavam blocos de um plano criado na própria semana: a partir da
// 2ª semana do mesmo plano a meta zerava, e o Pomodoro nunca entrava.
// Os dias são de Brasília (`study-day`).

import { addDays, studyDay } from './study-day';

export interface DoneBlock {
  planCreatedAt: Date;
  dayIndex: number;
  minutes: number;
}

export interface FocusChunk {
  completedAt: Date;
  durationSec: number;
}

/** Dia do calendário em que o bloco está: o dia em que o plano começou + `dayIndex`. */
export function blockDay(planCreatedAt: Date, dayIndex: number): string {
  return addDays(studyDay(planCreatedAt), dayIndex);
}

/** O dia está na semana que começa em `weekStart` (segunda) e vai até domingo. */
function inWeek(day: string, weekStart: string): boolean {
  return day >= weekStart && day <= addDays(weekStart, 6);
}

/** Minutos da semana: blocos concluídos nela + Pomodoro concluído nela. */
export function weekMinutes(
  blocks: readonly DoneBlock[],
  focus: readonly FocusChunk[],
  weekStart: string,
): number {
  const blockMinutes = blocks
    .filter((b) => inWeek(blockDay(b.planCreatedAt, b.dayIndex), weekStart))
    .reduce((sum, b) => sum + b.minutes, 0);
  const focusSeconds = focus
    .filter(
      (f) => f.durationSec > 0 && inWeek(studyDay(f.completedAt), weekStart),
    )
    .reduce((sum, f) => sum + f.durationSec, 0);
  return blockMinutes + Math.round(focusSeconds / 60);
}
