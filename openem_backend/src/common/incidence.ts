/**
 * Incidência dos assuntos no ENEM (discussão #122): quantas questões de cada
 * assunto caíram, em média, nas provas regulares mais recentes do banco.
 * Lógica pura; a consulta fica em `src/tracks/incidence-query.ts`.
 *
 * O assunto de cada questão é classificação do OpENEM (palavras-chave e IA),
 * não do INEP: a tela chama o número de estimativa.
 */

/** Quantas provas regulares entram na conta: as mais recentes do banco. */
export const INCIDENCE_WINDOW = 10;

/**
 * A prova traz 5 questões de inglês e 5 de espanhol, e o aluno faz só uma
 * língua. A soma por matéria conta só o inglês, para Língua Estrangeira não
 * valer 10 por prova; o assunto de espanhol continua com a própria conta.
 */
export const SECONDARY_LANGUAGE = 'espanhol';

export interface WindowExam {
  id: string;
  year: number;
}

export interface IncidenceWindow {
  fromYear: number;
  toYear: number;
  /** Quantas provas entraram (até `INCIDENCE_WINDOW`). */
  exams: number;
  /** Ano de cada prova, em ordem crescente: o eixo de `byYear`. */
  years: number[];
}

export interface IncidenceRow {
  topicId: string;
  examYearId: string;
  language: string | null;
  n: number;
}

export interface TopicIncidence {
  /** Média de questões por prova da janela, contando todas as línguas. */
  perExam: number;
  /** Média por prova sem a segunda língua: é a parcela que soma na matéria. */
  primaryPerExam: number;
  /** Em quantas provas da janela o assunto caiu. */
  years: number;
  /** Questões em cada prova da janela, na ordem de `IncidenceWindow.years`. */
  byYear: number[];
}

/**
 * As `size` provas regulares mais recentes, em ordem crescente de ano. Uma
 * janela por prova, não por ano fixo: quando a prova do ano seguinte for
 * importada, ela entra e a mais antiga sai sem mudar código.
 */
export function pickWindow(
  exams: readonly WindowExam[],
  size = INCIDENCE_WINDOW,
): WindowExam[] {
  return [...exams]
    .sort((a, b) => b.year - a.year || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, size))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}

export function describeWindow(
  window: readonly WindowExam[],
): IncidenceWindow | null {
  if (window.length === 0) return null;
  return {
    fromYear: window[0].year,
    toYear: window[window.length - 1].year,
    exams: window.length,
    years: window.map((e) => e.year),
  };
}

/** Duas casas bastam para a tela e deixam a resposta da API curta. */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Incidência de cada assunto que apareceu na janela. Linhas de provas fora
 * da janela são ignoradas; assunto que não aparece não entra no resultado
 * (quem lê trata ausência como zero).
 */
export function computeIncidence(
  window: readonly WindowExam[],
  rows: readonly IncidenceRow[],
): Record<string, TopicIncidence> {
  const position = new Map(window.map((e, i) => [e.id, i]));
  const exams = window.length;
  const acc = new Map<string, { byYear: number[]; primary: number }>();
  for (const row of rows) {
    const i = position.get(row.examYearId);
    if (i === undefined || row.n <= 0) continue;
    const t = acc.get(row.topicId) ?? {
      byYear: new Array<number>(exams).fill(0),
      primary: 0,
    };
    t.byYear[i] += row.n;
    if (row.language !== SECONDARY_LANGUAGE) t.primary += row.n;
    acc.set(row.topicId, t);
  }

  const out: Record<string, TopicIncidence> = {};
  for (const [topicId, t] of acc) {
    const total = t.byYear.reduce((s, n) => s + n, 0);
    out[topicId] = {
      perExam: round2(total / exams),
      primaryPerExam: round2(t.primary / exams),
      years: t.byYear.filter((n) => n > 0).length,
      byYear: t.byYear,
    };
  }
  return out;
}
