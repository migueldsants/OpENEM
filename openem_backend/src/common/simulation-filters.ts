/**
 * Filtros do simulado personalizado — normalização, persistência e tradução
 * para o `where` do Prisma.
 *
 * Por que existe: o simulado "por tema" do aluno não é um template fixo, é uma
 * combinação (áreas + matérias + assuntos + provas + dificuldade) que precisa
 * valer em três lugares diferentes — ao iniciar, ao salvar o simulado para
 * refazer depois e ao exportar o PDF. Um módulo puro garante que os três
 * concordem sobre o que "Matemática, Funções, 20 questões" significa.
 *
 * Regra central: as seleções de ÁREA, MATÉRIA e ASSUNTO se somam (união), não
 * se cruzam. Escolher a área "Matemática" e o assunto "Genética" traz as duas
 * coisas; cruzá-las devolveria vazio, que é o bug que o aluno mais reclamava —
 * a maior parte do banco oficial ainda não tem matéria/assunto, então um filtro
 * por matéria que também exigisse a área não encontrava nada.
 */

import { Prisma } from '@prisma/client';

/** Quantidade mínima e máxima de questões de um simulado personalizado. */
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 180;
/** Minutos por questão quando o aluno não define o tempo (ritmo do ENEM). */
export const MINUTES_PER_QUESTION = 3;

export interface SimulationFilters {
  /** Áreas do conhecimento (alcança questão oficial sem matéria/assunto). */
  subjectAreaIds?: string[];
  subjectIds?: string[];
  topicIds?: string[];
  /** Provas específicas: "2023", "2023-reaplicacao". */
  examSlugs?: string[];
  /** Faixa de anos das provas oficiais. */
  yearFrom?: number;
  yearTo?: number;
  /** Nível 1..5 — só as questões calibradas têm nível diferente do padrão. */
  difficulty?: number;
  /** "ingles" | "espanhol" — recorta a versão da língua estrangeira. */
  language?: string;
  questionCount?: number;
  timeLimitMin?: number;
  /** Sorteio ponderado pelo peso de incidência no ENEM. */
  pareto?: boolean;
  /** Só questões que o aluno nunca respondeu. */
  unseenOnly?: boolean;
  /** Só as favoritas do aluno. */
  onlyFavorites?: boolean;
  /** Só as que o aluno errou antes — treino do ponto fraco. */
  wrongOnly?: boolean;
}

/** Tira vazio, repetido e espaço de uma lista de ids. */
function ids(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const limpos = [
    ...new Set(
      input
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  return limpos.length ? limpos : undefined;
}

function inteiro(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * Normaliza o que veio do cliente (ou do template salvo) para a forma canônica:
 * listas sem repetição, números dentro da faixa e nada de campo vazio. Aceita
 * também os campos no singular que a API usava antes do simulado multi-tema.
 */
export function normalizeFilters(
  input:
    | (SimulationFilters & {
        subjectAreaId?: string;
        subjectId?: string;
        topicId?: string;
        examSlug?: string;
      })
    | null
    | undefined,
): SimulationFilters {
  if (!input) return {};
  const juntar = (lista?: string[], unico?: string) =>
    ids([...(lista ?? []), ...(unico ? [unico] : [])]);

  const out: SimulationFilters = {};
  const areas = juntar(input.subjectAreaIds, input.subjectAreaId);
  const subjects = juntar(input.subjectIds, input.subjectId);
  const topics = juntar(input.topicIds, input.topicId);
  const exams = juntar(input.examSlugs, input.examSlug);
  if (areas) out.subjectAreaIds = areas;
  if (subjects) out.subjectIds = subjects;
  if (topics) out.topicIds = topics;
  if (exams) out.examSlugs = exams;

  const de = inteiro(input.yearFrom, 1998, 2100);
  const ate = inteiro(input.yearTo, 1998, 2100);
  // Faixa invertida é erro de digitação, não motivo para devolver nada.
  if (de !== undefined)
    out.yearFrom = ate !== undefined ? Math.min(de, ate) : de;
  if (ate !== undefined)
    out.yearTo = de !== undefined ? Math.max(de, ate) : ate;

  const nivel = inteiro(input.difficulty, 1, 5);
  if (nivel !== undefined) out.difficulty = nivel;
  if (input.language === 'ingles' || input.language === 'espanhol') {
    out.language = input.language;
  }
  const quantas = inteiro(input.questionCount, MIN_QUESTIONS, MAX_QUESTIONS);
  if (quantas !== undefined) out.questionCount = quantas;
  const tempo = inteiro(input.timeLimitMin, 1, 600);
  if (tempo !== undefined) out.timeLimitMin = tempo;
  if (input.pareto) out.pareto = true;
  if (input.unseenOnly) out.unseenOnly = true;
  if (input.onlyFavorites) out.onlyFavorites = true;
  if (input.wrongOnly) out.wrongOnly = true;
  return out;
}

/** Há algum recorte de conteúdo (não só de contagem/tempo)? */
export function hasContentFilter(f: SimulationFilters): boolean {
  return !!(
    f.subjectAreaIds?.length ||
    f.subjectIds?.length ||
    f.topicIds?.length ||
    f.examSlugs?.length ||
    f.yearFrom ||
    f.yearTo ||
    f.difficulty ||
    f.unseenOnly ||
    f.onlyFavorites ||
    f.wrongOnly
  );
}

/** Tem qualquer coisa definida — inclusive só a contagem. */
export function hasAnyFilter(f: SimulationFilters): boolean {
  return hasContentFilter(f) || !!f.questionCount || !!f.timeLimitMin;
}

/** Tempo do simulado: o escolhido, ou 3 min por questão (ritmo do ENEM). */
export function resolveTimeLimit(
  f: SimulationFilters,
  questionCount: number,
): number {
  return (
    f.timeLimitMin ??
    Math.max(5, Math.round(questionCount * MINUTES_PER_QUESTION))
  );
}

/**
 * Traduz os filtros para o `where` do Prisma.
 *
 * `userId` é necessário para os recortes pessoais (nunca respondidas, erradas,
 * favoritas); sem ele esses filtros são ignorados em vez de quebrar.
 */
export function buildQuestionWhere(
  f: SimulationFilters,
  userId?: string,
): Prisma.QuestionWhereInput {
  const and: Prisma.QuestionWhereInput[] = [];

  // União das seleções de conteúdo: área OU matéria OU assunto.
  const escopo: Prisma.QuestionWhereInput[] = [];
  if (f.subjectAreaIds?.length) {
    escopo.push({ subjectAreaId: { in: f.subjectAreaIds } });
  }
  if (f.subjectIds?.length) {
    escopo.push({ topic: { subjectId: { in: f.subjectIds } } });
  }
  if (f.topicIds?.length) escopo.push({ topicId: { in: f.topicIds } });
  if (escopo.length === 1) and.push(escopo[0]);
  else if (escopo.length > 1) and.push({ OR: escopo });

  // Prova: slugs escolhidos e/ou faixa de anos.
  const prova: Prisma.ExamYearWhereInput = {};
  if (f.examSlugs?.length) prova.slug = { in: f.examSlugs };
  if (f.yearFrom !== undefined || f.yearTo !== undefined) {
    prova.year = {
      ...(f.yearFrom !== undefined ? { gte: f.yearFrom } : {}),
      ...(f.yearTo !== undefined ? { lte: f.yearTo } : {}),
    };
  }
  if (Object.keys(prova).length) and.push({ examYear: prova });

  if (f.difficulty !== undefined) and.push({ difficulty: f.difficulty });

  // Língua estrangeira: as questões sem idioma continuam; só a versão na outra
  // língua sai. Sem isso o aluno recebe a mesma questão em inglês e espanhol.
  if (f.language) {
    and.push({ OR: [{ language: null }, { language: f.language }] });
  }

  if (userId) {
    if (f.unseenOnly) and.push({ answers: { none: { userId } } });
    if (f.onlyFavorites) and.push({ favorites: { some: { userId } } });
    if (f.wrongOnly) {
      and.push({ answers: { some: { userId, isCorrect: false } } });
    }
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

/** Serializa para a coluna `SimulationTemplate.filters` (texto, SQLite). */
export function serializeFilters(f: SimulationFilters): string {
  return JSON.stringify(normalizeFilters(f));
}

/**
 * Lê a coluna `filters`. JSON inválido devolve {} em vez de explodir: um
 * template corrompido deve virar "simulado geral", não erro 500 na listagem.
 */
export function parseFilters(
  raw: string | null | undefined,
): SimulationFilters {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return normalizeFilters(parsed as SimulationFilters);
  } catch {
    return {};
  }
}

/**
 * Rótulo curto do recorte, para o nome do simulado salvo e o subtítulo do PDF:
 * "Matemática · Funções · 20 questões". Recebe os nomes já resolvidos porque
 * este módulo não fala com o banco.
 */
export function describeFilters(
  f: SimulationFilters,
  names: {
    areas?: string[];
    subjects?: string[];
    topics?: string[];
    exams?: string[];
  } = {},
): string {
  const partes: string[] = [];
  const conteudo = [
    ...(names.topics ?? []),
    ...(names.subjects ?? []),
    ...(names.areas ?? []),
  ];
  if (conteudo.length) {
    partes.push(
      conteudo.length > 3
        ? `${conteudo.slice(0, 3).join(', ')} e mais ${conteudo.length - 3}`
        : conteudo.join(', '),
    );
  }
  if (names.exams?.length) partes.push(names.exams.join(', '));
  else if (f.yearFrom || f.yearTo) {
    partes.push(
      f.yearFrom && f.yearTo
        ? `${f.yearFrom}–${f.yearTo}`
        : `${f.yearFrom ?? f.yearTo}`,
    );
  }
  if (f.difficulty) partes.push(`nível ${f.difficulty}`);
  if (f.unseenOnly) partes.push('inéditas');
  if (f.wrongOnly) partes.push('que errei');
  if (f.onlyFavorites) partes.push('favoritas');
  if (partes.length === 0) partes.push('Todas as áreas');
  if (f.questionCount) partes.push(`${f.questionCount} questões`);
  return partes.join(' · ');
}
