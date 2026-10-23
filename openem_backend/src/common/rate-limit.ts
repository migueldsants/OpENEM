import { createHash } from 'node:crypto';

/**
 * Regras puras do rate limiting (issue #87): de quem é o pedido (tracker), as
 * chaves no Redis, o bloqueio progressivo do login e a mensagem do 429.
 */

/** Token do cabeçalho `Authorization: Bearer <token>`, ou null. */
export function bearerToken(
  header: string | string[] | undefined,
): string | null {
  const valor = Array.isArray(header) ? header[0] : header;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(valor ?? '');
  return m ? m[1] : null;
}

/**
 * De quem é o pedido. Com login válido, o aluno: dezenas de alunos atrás do
 * mesmo IP (escola, cursinho, CGNAT da operadora) não dividem o limite. Sem
 * login, ou com token inválido, o IP.
 */
export function trackerFor(who: {
  userId?: string | null;
  ip?: string;
}): string {
  if (who.userId) return `user:${who.userId}`;
  return `ip:${who.ip || 'desconhecido'}`;
}

/** Prefixo de toda chave de rate limiting no Redis. */
export const RATE_KEY_PREFIX = 'openem:v1:rl';

/**
 * Prefixo das chaves desta instância. Instâncias com o mesmo prefixo dividem
 * os contadores (é o que se quer em produção). `THROTTLE_KEY_PREFIX` separa
 * implantações que usam o mesmo Redis. Nos testes (`NODE_ENV=test`) cada app
 * ganha os próprios contadores, como na memória: as suítes e2e rodam em
 * paralelo no mesmo Redis e não podem gastar o limite umas das outras.
 */
export function rateKeyPrefix(
  env: { THROTTLE_KEY_PREFIX?: string; NODE_ENV?: string },
  randomId: () => string,
): string {
  const proprio = env.THROTTLE_KEY_PREFIX?.trim();
  if (proprio) return `${RATE_KEY_PREFIX}:${proprio}`;
  if (env.NODE_ENV === 'test') return `${RATE_KEY_PREFIX}:test-${randomId()}`;
  return RATE_KEY_PREFIX;
}

/** Segundos para o cabeçalho Retry-After (nunca 0: "tente já" confunde). */
export function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/** Texto do 429, em português e com a espera. */
export function rateLimitMessage(seconds: number): string {
  return seconds >= 120
    ? `Muitas tentativas. Tente de novo em ${Math.ceil(seconds / 60)} min.`
    : `Muitas tentativas. Tente de novo em ${seconds} s.`;
}

// ---- Login por conta ----

/** Senhas erradas aceitas por conta dentro da janela. */
export const LOGIN_FAILURE_LIMIT = 5;
/** Janela das falhas de login. */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Primeiro bloqueio da conta; cada novo bloqueio no mesmo dia dobra. */
export const LOGIN_BLOCK_BASE_MS = 15 * 60 * 1000;
/** Teto do bloqueio progressivo. */
export const LOGIN_BLOCK_MAX_MS = 24 * 60 * 60 * 1000;
/** Por quanto tempo os bloqueios anteriores contam para dobrar o próximo. */
export const LOGIN_STRIKES_TTL_MS = 24 * 60 * 60 * 1000;

/** Duração do n-ésimo bloqueio (1, 2, 3...): 15 min, 30 min, 1 h... até 24 h. */
export function loginBlockMs(strike: number): number {
  const n = Math.max(1, Math.floor(strike));
  // 2^7 × 15 min já passa de 24 h; limitar o expoente evita Infinity.
  return Math.min(
    LOGIN_BLOCK_BASE_MS * 2 ** Math.min(n - 1, 10),
    LOGIN_BLOCK_MAX_MS,
  );
}

/** E-mail como o aluno o digitaria de novo: sem espaços nem maiúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Identificador da conta nas chaves do login: hash do e-mail normalizado, para
 * o Redis não guardar e-mails. Vale também para e-mail sem conta, e é isso que
 * impede descobrir quais existem pelo bloqueio.
 */
export function accountId(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

/** Chaves do controle de login de uma conta. */
export function loginKeys(
  prefix: string,
  email: string,
): { failures: string; block: string; strikes: string } {
  const base = `${prefix}:login:${accountId(email)}`;
  return {
    failures: `${base}:falhas`,
    block: `${base}:bloqueio`,
    strikes: `${base}:bloqueios`,
  };
}
