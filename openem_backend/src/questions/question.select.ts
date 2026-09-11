import { Prisma } from '@prisma/client';

/**
 * Selects compartilhados da questão.
 *
 * Existiam quatro cópias quase idênticas espalhadas por questions, favorites,
 * recommendation e simulations. Com o banco oficial do ENEM a ordem das
 * alternativas passou a ser semântica (a letra vem do gabarito), e um `orderBy`
 * esquecido em uma das cópias é gabarito errado na tela — daí a centralização.
 */

/** Alternativas na ordem oficial, sem revelar qual é a correta. */
export const ALTERNATIVES_PUBLIC = {
  select: { id: true, letter: true, text: true, imageUrl: true },
  orderBy: { position: 'asc' },
} as const satisfies Prisma.Question$alternativesArgs;

/** Alternativas na ordem oficial, com o gabarito. */
export const ALTERNATIVES_WITH_ANSWER = {
  select: {
    id: true,
    letter: true,
    text: true,
    imageUrl: true,
    isCorrect: true,
  },
  orderBy: { position: 'asc' },
} as const satisfies Prisma.Question$alternativesArgs;

/** Taxonomia da questão: assunto quando já classificada, área sempre. */
export const QUESTION_TAXONOMY = {
  subjectArea: { select: { id: true, name: true } },
  topic: {
    select: {
      id: true,
      name: true,
      subject: { select: { id: true, name: true } },
    },
  },
} as const;

/** Questão para responder: sem gabarito e sem comentário. */
export const QUESTION_PUBLIC_SELECT = {
  id: true,
  code: true,
  number: true,
  statement: true,
  questionPrompt: true,
  language: true,
  difficulty: true,
  source: true,
  ...QUESTION_TAXONOMY,
  examYear: { select: { year: true, slug: true, label: true } },
  alternatives: ALTERNATIVES_PUBLIC,
} as const satisfies Prisma.QuestionSelect;

/** Questão comentada: gabarito + explicação (e a origem dela, para o aviso de IA). */
export const QUESTION_DETAIL_SELECT = {
  ...QUESTION_PUBLIC_SELECT,
  explanation: true,
  explanationSource: true,
  alternatives: ALTERNATIVES_WITH_ANSWER,
} as const satisfies Prisma.QuestionSelect;
