// Paginação das respostas de um tópico do fórum. As respostas saem em ordem de
// criação (`createdAt`, desempate por `id`), e o cursor aponta a última
// resposta da página. Ele carrega os dois valores em vez de só o id: o `cursor`
// do Prisma procura a linha e devolve página vazia se ela não existir mais.
// Para o cliente o cursor é opaco (base64url).

export const POSTS_PAGE_DEFAULT = 20;
export const POSTS_PAGE_MAX = 50;

export interface PostCursor {
  createdAt: Date;
  id: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function encodePostCursor(post: PostCursor): string {
  return Buffer.from(
    `${post.createdAt.toISOString()}|${post.id}`,
    'utf8',
  ).toString('base64url');
}

/** Devolve `null` para cursor malformado (o serviço responde 400). */
export function decodePostCursor(cursor: string): PostCursor | null {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const sep = raw.indexOf('|');
  if (sep < 0) return null;
  const iso = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== iso) {
    return null;
  }
  if (!ID_RE.test(id)) return null;
  return { createdAt, id };
}

/** Filtro das respostas que vêm depois do cursor, na mesma ordem da página. */
export function afterCursor(cursor: PostCursor) {
  return {
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ],
  };
}

export function clampPageSize(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return POSTS_PAGE_DEFAULT;
  return Math.min(POSTS_PAGE_MAX, Math.max(1, Math.trunc(limit)));
}

/**
 * Recebe as linhas buscadas com `take: limit + 1` e separa a página: a linha a
 * mais só diz que existe outra página, e o cursor é o da última que fica.
 */
export function slicePage<T extends PostCursor>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodePostCursor(items[items.length - 1]) };
}
