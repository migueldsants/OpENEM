/**
 * Regras puras da camada de cache (issue #86): montagem de chave, TTL com
 * variação, serialização e o intervalo dos avisos de erro. O `CacheService`
 * (`src/cache/`) só liga isto ao Redis ou à memória.
 */

/** Prefixo de toda chave. O `v1` muda se o formato das chaves mudar. */
export const CACHE_PREFIX = 'openem:v1';

/**
 * Grupos de chaves invalidados juntos. `catalog` cobre o que só muda com
 * seed, import das provas e classificação: matérias, provas, facetas e a
 * questão por id.
 */
export type CacheNamespace = 'catalog';

/** Onde fica a versão atual de um namespace. */
export function namespaceVersionKey(ns: CacheNamespace): string {
  return `${CACHE_PREFIX}:ns:${ns}`;
}

/**
 * Chave de um valor. Com namespace, a versão entra na chave: invalidar é
 * trocar a versão, e as chaves antigas expiram sozinhas pelo TTL, sem varrer
 * o Redis com SCAN. Cada parte é codificada para um `:` vindo de fora (um id,
 * um idioma) não se passar por separador.
 */
export function cacheKey(
  parts: readonly (string | number)[],
  ns?: { name: CacheNamespace; version: string },
): string {
  if (parts.length === 0) throw new Error('chave de cache vazia');
  const corpo = parts.map((p) => encodeURIComponent(String(p))).join(':');
  return ns
    ? `${CACHE_PREFIX}:${ns.name}:${ns.version}:${corpo}`
    : `${CACHE_PREFIX}:${corpo}`;
}

/** Versão lida do armazenamento; ausente ou inválida vale "0". */
export function parseVersion(raw: string | null | undefined): string {
  return raw && /^\d+$/.test(raw) ? raw : '0';
}

/** Fração do TTL que pode ser cortada ao acaso. */
export const TTL_JITTER = 0.1;

/**
 * TTL com até 10% a menos, sorteado. Chaves gravadas juntas (todas depois de
 * um import) não expiram no mesmo instante, e o banco não recebe todas as
 * recargas de uma vez.
 */
export function ttlWithJitter(
  ttlMs: number,
  random: () => number = Math.random,
): number {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error(`TTL inválido: ${ttlMs}`);
  }
  const corte = Math.floor(ttlMs * TTL_JITTER * random());
  return Math.max(1, Math.floor(ttlMs) - corte);
}

/**
 * Sem Redis, um script (seed, import) roda em outro processo e não alcança o
 * cache em memória da API. As chaves de namespace duram no máximo isto, para
 * o catálogo novo aparecer em até um minuto.
 */
export const MEMORY_NAMESPACE_TTL_MS = 60_000;

/** TTL efetivo de uma chave, conforme o armazenamento. */
export function effectiveTtl(
  ttlMs: number,
  opts: { memory: boolean; namespaced: boolean },
): number {
  return opts.memory && opts.namespaced
    ? Math.min(ttlMs, MEMORY_NAMESPACE_TTL_MS)
    : ttlMs;
}

/**
 * O valor vai embrulhado: assim `null` guardado (ex.: "o GitHub não
 * respondeu") se distingue de chave ausente.
 */
export function serialize(value: unknown): string {
  if (value === undefined) throw new Error('undefined não vai para o cache');
  return JSON.stringify({ v: value });
}

export type Lookup<T> = { hit: true; value: T } | { hit: false };

/** Conteúdo corrompido ou de outro formato conta como ausente. */
export function deserialize<T>(raw: string | null | undefined): Lookup<T> {
  if (raw == null) return { hit: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'v' in parsed) {
      return { hit: true, value: (parsed as { v: T }).v };
    }
  } catch {
    // cai no "ausente"
  }
  return { hit: false };
}

/** Intervalo mínimo entre dois avisos de "Redis fora do ar" no log. */
export const ERROR_LOG_INTERVAL_MS = 60_000;

/** Se já passou tempo bastante desde o último aviso (null = nunca avisou). */
export function shouldLog(
  now: number,
  last: number | null,
  intervalMs = ERROR_LOG_INTERVAL_MS,
): boolean {
  return last === null || now - last >= intervalMs;
}
