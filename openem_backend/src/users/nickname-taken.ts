export const NICKNAME_TAKEN = 'Esse apelido já está em uso. Escolha outro.';

/** Violação de unicidade (P2002) no apelido, e não em outro campo. */
export function isNicknameTaken(err: unknown): boolean {
  const e = err as { code?: unknown; meta?: { target?: unknown } } | null;
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes('nickname');
  return typeof target === 'string' && target.includes('nickname');
}
