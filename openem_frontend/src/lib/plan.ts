import type { StudyPlan, StudySession } from '../api';

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Índice do dia de hoje dentro do plano (negativo = plano começa no futuro). */
export function dayIndexOf(plan: StudyPlan, today = new Date()): number {
  const planStart = startOfDay(new Date(plan.createdAt));
  return Math.round(
    (startOfDay(today).getTime() - planStart.getTime()) / 86_400_000,
  );
}

/** Blocos do cronograma marcados para hoje, na ordem do dia. */
export function sessoesDeHoje(
  plan: StudyPlan,
  today = new Date(),
): StudySession[] {
  const hoje = dayIndexOf(plan, today);
  return plan.sessions
    .filter((s) => s.dayIndex === hoje)
    .sort((a, b) => a.position - b.position);
}
