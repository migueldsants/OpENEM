import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tokens de uso único da conta: o link de "esqueci minha senha" e o código
 * que o app troca pelo login depois do Google. O banco guarda só o hash; o
 * token sai por e-mail ou na URL de volta ao app, uma vez.
 */

/** Validade do link de redefinição de senha. */
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
/** Validade do código do Google: o app o troca logo que a página abre. */
export const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;

/** Links pedidos por e-mail dentro da janela; o próximo pedido ganha 429. */
export const RESET_EMAIL_LIMIT = 3;
/** Janela do limite de links por e-mail. */
export const RESET_EMAIL_WINDOW_MS = 60 * 60 * 1000;

/** Texto da resposta do "esqueci minha senha", igual com e sem conta. */
export const RESET_REQUESTED_MESSAGE =
  'Se houver uma conta com esse e-mail, enviamos um link para criar uma senha nova. Ele vale por 30 minutos.';

/** Token aleatório de 256 bits em base64url (vai numa URL sem escapar). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * O que o banco guarda de um token: o SHA-256. O token já tem 256 bits de
 * acaso, então não precisa de argon2; e quem ler o banco não usa o link.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compara dois textos em tempo constante. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Chave do contador de links pedidos para um e-mail (já em hash). */
export function resetEmailKey(prefix: string, accountId: string): string {
  return `${prefix}:reset:${accountId}`;
}
