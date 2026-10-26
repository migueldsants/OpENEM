import { normalizeEmail } from '../common/rate-limit';
import type { PrismaService } from '../prisma/prisma.service';

export interface EmailLookupUser {
  id: string;
  email: string;
  passwordHash: string | null;
  googleSub: string | null;
  emailVerifiedAt: Date | null;
}

export type EmailLookup =
  | { kind: 'none' }
  | { kind: 'found'; user: EmailLookupUser }
  /** Duas contas com o mesmo e-mail em caixas diferentes, nenhuma exata. */
  | { kind: 'ambiguous' };

const select = {
  id: true,
  email: true,
  passwordHash: true,
  googleSub: true,
  emailVerifiedAt: true,
} as const;

/**
 * Conta de um e-mail digitado ou vindo do Google. O e-mail é gravado
 * normalizado (minúsculas, sem espaços; migração `email_minusculas`), então
 * vale primeiro o igual exato ao normalizado. Sem ele, o igual sem diferenciar
 * maiúsculas cobre as contas antigas que colidiam e ficaram como estavam,
 * desde que seja uma conta só.
 */
export async function findUserByEmail(
  prisma: Pick<PrismaService, 'user'>,
  email: string,
): Promise<EmailLookup> {
  const limpo = normalizeEmail(email);
  const exato = await prisma.user.findUnique({
    where: { email: limpo },
    select,
  });
  if (exato) return { kind: 'found', user: exato };
  const parecidos = await prisma.user.findMany({
    where: { email: { equals: limpo, mode: 'insensitive' } },
    select,
    take: 2,
  });
  if (parecidos.length === 0) return { kind: 'none' };
  if (parecidos.length > 1) return { kind: 'ambiguous' };
  return { kind: 'found', user: parecidos[0] };
}
