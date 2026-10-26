import { createHash } from 'node:crypto';
import { safeEqual } from './auth-tokens';

/**
 * Regras puras do login com Google (OpenID Connect, authorization code com
 * PKCE). Os endereços são os documentados pelo Google; a rede fica no
 * `GoogleOidcClient`.
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
/** O Google assina o `iss` com e sem o esquema. */
export const GOOGLE_ISSUERS = [
  'https://accounts.google.com',
  'accounts.google.com',
] as const;
/**
 * Só o necessário para achar a conta: `openid email`. Sem `profile`, o nome e
 * a foto do aluno não chegam ao OpENEM.
 */
export const GOOGLE_SCOPES = 'openid email';
/** Folga para relógio adiantado ou atrasado ao conferir `exp` e `iat`. */
export const CLOCK_SKEW_SEC = 60;
/** Quanto tempo o aluno tem para escolher a conta no Google. */
export const GOOGLE_FLOW_TTL_MS = 10 * 60 * 1000;

/**
 * O que deu errado, no fragmento de volta ao app (`#erro=`). O app troca
 * cada código por uma frase.
 */
export type GoogleErrorCode =
  | 'cancelado' // o aluno desistiu na tela do Google
  | 'sessao' // cookie vencido, outra aba ou `state`/`nonce` trocado
  | 'email' // o Google não confirmou o e-mail
  | 'conta' // e-mail preso a outra conta Google ou a duas contas daqui
  | 'falha'; // rede, resposta inválida, assinatura

export class GoogleLoginError extends Error {
  constructor(
    readonly code: GoogleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleLoginError';
  }
}

/** O que fica no cookie entre a ida ao Google e a volta. */
export interface GoogleFlow {
  state: string;
  nonce: string;
  /** PKCE: o Google só entrega o token a quem mostrar este segredo. */
  verifier: string;
}

/** `code_challenge` do PKCE (S256). */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Endereço da tela de login do Google. */
export function googleAuthorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  flow: GoogleFlow;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state: opts.flow.state,
    nonce: opts.flow.nonce,
    code_challenge: pkceChallenge(opts.flow.verifier),
    code_challenge_method: 'S256',
    // Computador da escola: o Google pergunta qual conta, em vez de entrar
    // direto na do último aluno que usou a máquina.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Corpo do POST que troca o código pelo ID token. */
export function tokenRequestBody(opts: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    code_verifier: opts.verifier,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
}

export interface GoogleIdentity {
  /** Identificador estável da conta Google. */
  sub: string;
  email: string;
}

function audienceOk(claims: Record<string, unknown>, clientId: string) {
  const aud = claims.aud;
  if (typeof aud === 'string') return aud === clientId;
  if (!Array.isArray(aud) || !aud.includes(clientId)) return false;
  // Token para vários clientes: o `azp` diz para quem ele foi emitido.
  return aud.length === 1 || claims.azp === clientId;
}

/**
 * Confere as claims do ID token (a assinatura já foi conferida): emissor,
 * destinatário, validade, `nonce` e e-mail confirmado pelo Google. Só e-mail
 * confirmado entra, porque é ele que liga a conta Google à conta daqui.
 */
export function checkGoogleClaims(
  claims: Record<string, unknown>,
  opts: { clientId: string; nonce: string; nowSec: number },
): GoogleIdentity {
  const falha = (msg: string) => new GoogleLoginError('falha', msg);
  if (!GOOGLE_ISSUERS.includes(claims.iss as (typeof GOOGLE_ISSUERS)[number])) {
    throw falha('emissor inesperado');
  }
  if (!audienceOk(claims, opts.clientId)) throw falha('token de outro cliente');
  if (
    typeof claims.exp !== 'number' ||
    claims.exp + CLOCK_SKEW_SEC < opts.nowSec
  ) {
    throw falha('token vencido');
  }
  if (
    typeof claims.iat === 'number' &&
    claims.iat - CLOCK_SKEW_SEC > opts.nowSec
  ) {
    throw falha('token emitido no futuro');
  }
  if (
    typeof claims.nonce !== 'string' ||
    !safeEqual(claims.nonce, opts.nonce)
  ) {
    throw new GoogleLoginError('sessao', 'nonce diferente do pedido');
  }
  if (typeof claims.sub !== 'string' || !claims.sub) throw falha('sem sub');
  if (typeof claims.email !== 'string' || !claims.email.includes('@')) {
    throw falha('sem e-mail');
  }
  // Booleano no ID token; versões antigas da API mandavam o texto "true".
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw new GoogleLoginError('email', 'e-mail não confirmado pelo Google');
  }
  return { sub: claims.sub, email: claims.email };
}
