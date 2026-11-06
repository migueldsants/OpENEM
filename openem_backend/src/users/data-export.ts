import { Prisma } from '@prisma/client';
import { studyDay } from '../common/study-day';

/**
 * Exportação dos dados do aluno (`GET /users/me/export`, LGPD art. 18, II e
 * V): um JSON com tudo o que está ligado à conta. Mudou a forma do arquivo,
 * suba a versão.
 */
export const EXPORT_FORMAT = 'openem-export';
export const EXPORT_FORMAT_VERSION = 1;

// O código legível da questão ("ENEM-2023-136") ao lado do id, para o
// arquivo fazer sentido fora do app.
const QUESTION_CODE = { select: { code: true } } as const;

/**
 * Cada relação de `User`, com os filhos que só existem por causa dela (as
 * sessões do cronograma, os cards de um deck, as notas de um vídeo...). O
 * teste compara esta lista com o schema: tabela nova ligada ao aluno quebra o
 * teste até entrar aqui. `passwordHash` nunca entra, nem os hashes dos links
 * de redefinição de senha e dos códigos de login do Google: deles saem só as
 * datas.
 */
export const EXPORT_SELECT = {
  id: true,
  email: true,
  createdAt: true,
  termsAcceptedAt: true,
  termsVersion: true,
  emailVerifiedAt: true,
  googleSub: true,
  tokenVersion: true,
  passwordResetTokens: {
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, expiresAt: true, usedAt: true },
  },
  loginCodes: {
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, expiresAt: true, passwordDisabled: true },
  },
  profile: true,
  answers: {
    orderBy: { createdAt: 'asc' },
    include: { question: QUESTION_CODE },
  },
  simulations: {
    orderBy: { startedAt: 'asc' },
    include: {
      template: { select: { name: true, scope: true } },
      questions: {
        orderBy: { position: 'asc' },
        select: { questionId: true, position: true },
      },
    },
  },
  simulationTemplates: true,
  reviewItems: { include: { topic: { select: { name: true } } } },
  favorites: { include: { question: QUESTION_CODE } },
  questionNotes: { include: { question: QUESTION_CODE } },
  studyPlan: {
    include: {
      sessions: { orderBy: [{ dayIndex: 'asc' }, { position: 'asc' }] },
    },
  },
  weeklyGoals: true,
  focusSessions: {
    where: { completedAt: { not: null } },
    orderBy: { completedAt: 'asc' },
  },
  essays: {
    include: {
      prompt: { select: { title: true, theme: true, year: true } },
      evaluation: true,
    },
  },
  gamification: true,
  achievements: true,
  dailyChallenges: true,
  xpLogs: { orderBy: { createdAt: 'asc' } },
  forumThreads: { orderBy: { createdAt: 'asc' } },
  forumPosts: { orderBy: { createdAt: 'asc' } },
  postLikes: true,
  forumReports: true,
  flashcardDecks: { include: { flashcards: { orderBy: { order: 'asc' } } } },
  flashcardReviews: true,
  deckVotes: true,
  formulas: { include: { symbols: { orderBy: { position: 'asc' } } } },
  formulaFavorites: true,
  videos: { include: { notes: { orderBy: { timestampSec: 'asc' } } } },
  // As notas também ficam em `videos`; aqui ficam com o id do vídeo, como no banco.
  videoNotes: true,
  themes: true,
  themeLikes: true,
  aiUsages: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.UserSelect;

/** Campos que nunca saem no arquivo, em nível nenhum. */
const SECRET_KEYS = new Set(['passwordHash', 'tokenHash', 'codeHash']);

/**
 * Cópia sem os campos secretos. O select já não os pede: isto é a segunda
 * trava, para um `include` futuro não vazar o hash da senha.
 */
export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripSecrets) as T;
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (!SECRET_KEYS.has(key)) out[key] = stripSecrets(inner);
  }
  return out as T;
}

/** O arquivo final: cabeçalho do formato, a conta e uma chave por relação. */
export function buildExport(
  user: Record<string, unknown>,
  now: Date,
): Record<string, unknown> {
  const {
    id,
    email,
    createdAt,
    termsAcceptedAt,
    termsVersion,
    emailVerifiedAt,
    googleSub,
    tokenVersion,
    ...rest
  } = stripSecrets(user);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account: {
      id,
      email,
      createdAt,
      termsAcceptedAt,
      termsVersion,
      emailVerifiedAt,
      googleSub,
      tokenVersion,
    },
    ...rest,
  };
}

/** Nome do arquivo, com o dia de Brasília: openem-meus-dados-2026-10-25.json. */
export function exportFilename(now: Date): string {
  return `openem-meus-dados-${studyDay(now)}.json`;
}
