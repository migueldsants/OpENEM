import { Inject, Injectable } from '@nestjs/common';
import type { KeyObject } from 'node:crypto';
import {
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  GoogleLoginError,
} from '../common/google-oidc';
import { jwtHeader, rsaKeysFromJwks, verifyRs256 } from '../common/jwt-rs256';
import { GOOGLE_FETCH } from './auth.tokens';

/** Por quanto tempo as chaves públicas do Google ficam guardadas. */
export const JWKS_TTL_MS = 60 * 60 * 1000;
/** Chave desconhecida faz buscar de novo, mas no máximo uma vez por minuto. */
export const JWKS_MIN_REFRESH_MS = 60 * 1000;
/** Tempo-limite de cada chamada ao Google. */
export const GOOGLE_HTTP_TIMEOUT_MS = 10_000;

/**
 * A parte de rede do login com Google: troca o código pelo ID token e
 * confere a assinatura com as chaves públicas do Google.
 */
@Injectable()
export class GoogleOidcClient {
  private keys = new Map<string, KeyObject>();
  private fetchedAt: number | null = null;
  /** Relógio; os testes trocam. */
  now: () => number = Date.now;

  constructor(@Inject(GOOGLE_FETCH) private readonly fetchFn: typeof fetch) {}

  /** Troca o código da volta pelo ID token (com o segredo do PKCE). */
  async exchangeCode(body: URLSearchParams): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(GOOGLE_HTTP_TIMEOUT_MS),
      });
    } catch (err) {
      throw new GoogleLoginError(
        'falha',
        `Google fora do alcance: ${(err as Error)?.message ?? err}`,
      );
    }
    const data = (await res.json().catch(() => null)) as {
      id_token?: unknown;
      error?: unknown;
    } | null;
    if (!res.ok || typeof data?.id_token !== 'string') {
      throw new GoogleLoginError(
        'falha',
        `troca do código recusada (${res.status}${typeof data?.error === 'string' ? `: ${data.error}` : ''})`,
      );
    }
    return data.id_token;
  }

  /** Claims do ID token, se a assinatura for de uma chave do Google. */
  async verifiedClaims(idToken: string): Promise<Record<string, unknown>> {
    const kid = jwtHeader(idToken)?.kid;
    if (typeof kid !== 'string') {
      throw new GoogleLoginError('falha', 'ID token sem kid');
    }
    const key = await this.publicKey(kid);
    const claims = key ? verifyRs256(idToken, key) : null;
    if (!claims) {
      throw new GoogleLoginError('falha', 'assinatura do ID token inválida');
    }
    return claims;
  }

  private async publicKey(kid: string): Promise<KeyObject | null> {
    const idade =
      this.fetchedAt === null ? Infinity : this.now() - this.fetchedAt;
    if (idade < JWKS_TTL_MS && this.keys.has(kid)) return this.keys.get(kid)!;
    // Vencido, ou chave nova (o Google gira as chaves): busca de novo, mas
    // um kid inventado não faz cada pedido bater no Google.
    if (idade >= JWKS_MIN_REFRESH_MS) await this.loadKeys();
    return this.keys.get(kid) ?? null;
  }

  private async loadKeys(): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchFn(GOOGLE_JWKS_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(GOOGLE_HTTP_TIMEOUT_MS),
      });
    } catch (err) {
      throw new GoogleLoginError(
        'falha',
        `chaves do Google fora do alcance: ${(err as Error)?.message ?? err}`,
      );
    }
    if (!res.ok) {
      throw new GoogleLoginError('falha', `chaves do Google: ${res.status}`);
    }
    const chaves = rsaKeysFromJwks(await res.json().catch(() => null));
    if (chaves.size === 0) {
      throw new GoogleLoginError('falha', 'o Google não mandou chaves RSA');
    }
    this.keys = chaves;
    this.fetchedAt = this.now();
  }
}
