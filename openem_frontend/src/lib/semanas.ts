// Formatação da tela Desempenho semana a semana (issue #90). Pura e testada:
// as datas chegam do backend como "AAAA-MM-DD" no dia de Brasília, então nada
// aqui passa por fuso.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function partes(dia: string): { ano: number; mes: number; dia: number; semana: number } {
  const [a, m, d] = dia.split('-').map(Number);
  return { ano: a, mes: m, dia: d, semana: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
}

/** "19 a 25 out", ou "29 set a 5 out" quando a semana vira o mês. */
export function intervaloDaSemana(inicio: string, fim: string): string {
  const a = partes(inicio);
  const b = partes(fim);
  return a.mes === b.mes
    ? `${a.dia} a ${b.dia} ${MESES[b.mes - 1]}`
    : `${a.dia} ${MESES[a.mes - 1]} a ${b.dia} ${MESES[b.mes - 1]}`;
}

/** Rótulo curto do dia da semana: "seg". */
export function diaCurto(dia: string): string {
  return DIAS_CURTOS[partes(dia).semana];
}

/** Número do dia no mês: 21. */
export function numeroDoDia(dia: string): number {
  return partes(dia).dia;
}

/** "quarta, 21 de out" (para leitores de tela). */
export function diaPorExtenso(dia: string): string {
  const p = partes(dia);
  return `${DIAS_LONGOS[p.semana]}, ${p.dia} de ${MESES[p.mes - 1]}`;
}

/** Meta de minutos da semana inteira a partir da meta diária do perfil. */
export function metaDaSemana(minutosPorDia: number | null | undefined): number | null {
  return minutosPorDia && minutosPorDia > 0 ? minutosPorDia * 7 : null;
}

/** Porcentagem da meta (0 a 100) para a barra; acima da meta fica cheia. */
export function fracaoDaMeta(feito: number, meta: number | null): number {
  if (!meta) return 0;
  return Math.max(0, Math.min(100, Math.round((feito / meta) * 100)));
}

/** "1h30", "45 min", "2h". */
export function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * Variação do acerto em pontos percentuais: "+6 p.p.", "−3 p.p." (sinal de
 * menos de verdade), "igual"; null sem comparação. "p.p." e não "pts": o XP
 * do app também fala em pontos.
 */
export function textoDaVariacao(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta === 0) return 'igual';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} p.p.`;
}

export type EstadoDoDia = 'estudou' | 'hoje-estudou' | 'hoje' | 'futuro' | 'vazio';

/**
 * Como desenhar o dia na faixa: estudou, hoje (estudado ou ainda em branco;
 * hoje sempre leva o contorno), dia por vir ou dia sem estudo.
 */
export function estadoDoDia(dia: { date: string; studied: boolean }, hoje: string): EstadoDoDia {
  if (dia.date === hoje) return dia.studied ? 'hoje-estudou' : 'hoje';
  if (dia.studied) return 'estudou';
  if (dia.date > hoje) return 'futuro';
  return 'vazio';
}

/** Sem nenhuma atividade em todas as semanas: a tela mostra o estado de início. */
export function semAtividade(semanas: { answers: number; minutes: number }[]): boolean {
  return semanas.every((s) => s.answers === 0 && s.minutes === 0);
}

/** Por que o assunto está nas prioridades, em linguagem de aluno. */
export function motivoDaPrioridade(p: { correct: number; answers: number; weight: number }): string {
  const base = acertosDaPrioridade(p);
  return caiMuitoNaProva(p) ? `${base} · cai muito na prova` : base;
}

/** "1 de 4 certas". */
export function acertosDaPrioridade(p: { correct: number; answers: number }): string {
  return `${p.correct} de ${p.answers} certas`;
}

/** Assunto de peso 4 ou 5 (incidência alta no ENEM). */
export function caiMuitoNaProva(p: { weight: number }): boolean {
  return p.weight >= 4;
}
