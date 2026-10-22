import { MemoryCacheStore } from './cache-store';
import { CacheService } from './cache.service';

/** Cache em memória novo, para testes de unidade de quem depende do cache. */
export function memoryCache(): CacheService {
  return new CacheService(new MemoryCacheStore());
}
