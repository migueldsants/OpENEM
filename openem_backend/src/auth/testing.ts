import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import {
  GOOGLE_JWKS_URL,
  GOOGLE_TOKEN_URL,
  pkceChallenge,
} from '../common/google-oidc';

/**
 * Google falso para os testes do login com Google: responde a troca do
 * código com um ID token assinado por uma chave RSA própria e publica essa
 * chave no JWKS. Nada sai para a rede.
 */
export interface FakeGoogle {
  fetch: typeof fetch;
  /** Claims do ID token da próxima troca de código (null = 400). */
  nextClaims: Record<string, unknown> | null;
  /** `code_challenge` esperado: com ele, a troca confere o PKCE. */
  expectedChallenge: string | null;
  /** Corpos recebidos pelo endpoint de token. */
  tokenRequests: URLSearchParams[];
  jwksRequests: number;
  kid: string;
  /** Assina um ID token com a chave do falso (ou outra). */
  signIdToken(
    claims: Record<string, unknown>,
    opts?: { kid?: string; key?: KeyObject; alg?: string },
  ): string;
}

function base64url(valor: unknown): string {
  return Buffer.from(JSON.stringify(valor)).toString('base64url');
}

export function fakeGoogle(): FakeGoogle {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' });

  const fake: FakeGoogle = {
    nextClaims: null,
    expectedChallenge: null,
    tokenRequests: [],
    jwksRequests: 0,
    kid: 'chave-de-teste',
    signIdToken(claims, opts = {}) {
      const cabecalho = base64url({
        alg: opts.alg ?? 'RS256',
        kid: opts.kid ?? fake.kid,
        typ: 'JWT',
      });
      const corpo = base64url(claims);
      const assinatura = sign(
        'RSA-SHA256',
        Buffer.from(`${cabecalho}.${corpo}`),
        opts.key ?? privateKey,
      ).toString('base64url');
      return `${cabecalho}.${corpo}.${assinatura}`;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- imita o fetch
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === GOOGLE_JWKS_URL) {
        fake.jwksRequests++;
        return Response.json({
          keys: [{ ...jwk, kid: fake.kid, alg: 'RS256', use: 'sig' }],
        });
      }
      if (url === GOOGLE_TOKEN_URL) {
        const body = new URLSearchParams(
          typeof init?.body === 'string' ? init.body : '',
        );
        fake.tokenRequests.push(body);
        const pkceOk =
          !fake.expectedChallenge ||
          pkceChallenge(body.get('code_verifier') ?? '') ===
            fake.expectedChallenge;
        if (!fake.nextClaims || !pkceOk) {
          return Response.json({ error: 'invalid_grant' }, { status: 400 });
        }
        return Response.json({
          access_token: 'nao-usado',
          id_token: fake.signIdToken(fake.nextClaims),
          token_type: 'Bearer',
        });
      }
      return new Response('não encontrado', { status: 404 });
    }) as typeof fetch,
  };
  return fake;
}
