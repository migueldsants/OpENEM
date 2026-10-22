import { namespaceVersionKey } from '../common/cache-keys';
import { RedisCacheStore, redisUrlFromEnv } from './cache-store';

/** Tempo de vida das leituras de catálogo (matérias, provas, facetas, questão). */
export const CATALOG_TTL_MS = 60 * 60 * 1000;

/**
 * Troca a versão do namespace `catalog` direto no Redis. Chamado no fim dos
 * scripts que mudam o catálogo (seed, import das provas, classificação,
 * bootstrap), que rodam fora do processo da API.
 *
 * Sem `REDIS_URL` não há o que invalidar daqui: o cache em memória é da API, e
 * as chaves de catálogo lá duram no máximo um minuto (`effectiveTtl`). Falha
 * do Redis só gera um aviso: o script já fez o trabalho dele, e o cache
 * expira sozinho em uma hora.
 */
export async function invalidateCatalogCache(
  env: Record<string, string | undefined> = process.env,
  log: (msg: string) => void = console.log,
): Promise<void> {
  const url = redisUrlFromEnv(env);
  if (!url) return;
  const store = RedisCacheStore.fromUrl(url);
  try {
    await store.ready();
    const versao = await store.incr(namespaceVersionKey('catalog'));
    log(`[cache] catálogo invalidado (versão ${versao})`);
  } catch (err) {
    log(
      `[cache] não foi possível invalidar o catálogo: ${(err as Error).message}`,
    );
  } finally {
    await store.close();
  }
}
