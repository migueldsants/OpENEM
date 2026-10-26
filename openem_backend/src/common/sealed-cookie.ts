import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Valor de cookie cifrado e autenticado (AES-256-GCM). O login com Google
 * guarda nele o `state`, o `nonce` e o segredo do PKCE entre a ida e a volta:
 * nada fica na memória do servidor, então funciona com várias instâncias e
 * sem Redis. A chave sai do `JWT_SECRET` por HKDF, separada por finalidade.
 */

const VERSAO = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function chave(secret: string, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secret, 'openem', `cookie:${purpose}`, 32),
  );
}

/** Cifra `data`, que vale até `nowMs + ttlMs`. */
export function sealJson(
  data: unknown,
  opts: { secret: string; purpose: string; nowMs: number; ttlMs: number },
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    'aes-256-gcm',
    chave(opts.secret, opts.purpose),
    iv,
  );
  const corpo = Buffer.from(
    JSON.stringify({ d: data, e: opts.nowMs + opts.ttlMs }),
    'utf8',
  );
  const cifrado = Buffer.concat([cipher.update(corpo), cipher.final()]);
  const pacote = Buffer.concat([iv, cipher.getAuthTag(), cifrado]);
  return `${VERSAO}.${pacote.toString('base64url')}`;
}

/** Decifra; null se faltar, tiver sido mexido, for de outra finalidade ou vencer. */
export function openSealedJson<T>(
  value: string | null | undefined,
  opts: { secret: string; purpose: string; nowMs: number },
): T | null {
  if (!value?.startsWith(`${VERSAO}.`)) return null;
  const pacote = Buffer.from(value.slice(VERSAO.length + 1), 'base64url');
  if (pacote.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      chave(opts.secret, opts.purpose),
      pacote.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(pacote.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const corpo = Buffer.concat([
      decipher.update(pacote.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
    const { d, e } = JSON.parse(corpo.toString('utf8')) as { d: T; e: number };
    if (typeof e !== 'number' || e <= opts.nowMs) return null;
    return d;
  } catch {
    return null;
  }
}

/** Valor de um cookie no cabeçalho `Cookie`, ou null. */
export function readCookie(
  header: string | string[] | undefined,
  name: string,
): string | null {
  const texto = Array.isArray(header) ? header.join('; ') : (header ?? '');
  for (const parte of texto.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() !== name) continue;
    const valor = parte.slice(igual + 1).trim();
    try {
      return decodeURIComponent(valor);
    } catch {
      return valor;
    }
  }
  return null;
}
