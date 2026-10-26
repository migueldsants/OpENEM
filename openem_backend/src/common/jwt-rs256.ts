import { createPublicKey, type KeyObject, verify } from 'node:crypto';

/**
 * Conferência de um JWT assinado com RS256 (o ID token do Google) com o
 * `crypto` do Node. Só a assinatura: as claims ficam com quem chama.
 */

export interface Jwk {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

function json(parte: string): Record<string, unknown> | null {
  try {
    const valor: unknown = JSON.parse(
      Buffer.from(parte, 'base64url').toString('utf8'),
    );
    return valor && typeof valor === 'object' && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Cabeçalho do JWT (sem conferir nada), ou null se não for um JWT. */
export function jwtHeader(
  token: string,
): { alg?: unknown; kid?: unknown } | null {
  const partes = token.split('.');
  return partes.length === 3 ? json(partes[0]) : null;
}

/** Chaves RSA de assinatura de um JWKS, por `kid`. */
export function rsaKeysFromJwks(jwks: unknown): Map<string, KeyObject> {
  const chaves = new Map<string, KeyObject>();
  const lista = (jwks as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(lista)) return chaves;
  for (const jwk of lista as Jwk[]) {
    if (jwk?.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
    if (jwk.use && jwk.use !== 'sig') continue;
    try {
      chaves.set(
        jwk.kid,
        createPublicKey({
          key: { kty: 'RSA', n: jwk.n, e: jwk.e },
          format: 'jwk',
        }),
      );
    } catch {
      // chave malformada: fica de fora
    }
  }
  return chaves;
}

/**
 * Payload do token se a assinatura RS256 confere com a chave; null se não
 * confere, se o `alg` não for RS256 (nada de `none` nem HS256 com a chave
 * pública como segredo) ou se o token estiver malformado.
 */
export function verifyRs256(
  token: string,
  key: KeyObject,
): Record<string, unknown> | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecalho, corpo, assinatura] = partes;
  if (json(cabecalho)?.alg !== 'RS256') return null;
  const ok = verify(
    'RSA-SHA256',
    Buffer.from(`${cabecalho}.${corpo}`),
    key,
    Buffer.from(assinatura, 'base64url'),
  );
  return ok ? json(corpo) : null;
}
