import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { CacheStore } from '../cache/cache-store';
import { RATE_PREFIX, RATE_STORE } from './rate-limit.tokens';

/** O registro que o ThrottlerGuard espera (tempos em segundos). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Contadores do `@nestjs/throttler` no Redis (issue #87): com várias
 * instâncias da API, o limite é contado uma vez só, e um deploy não zera os
 * bloqueios. Cada pedido é um script Lua (INCR + PEXPIRE + bloqueio,
 * atômicos). Sem Redis, ou com ele fora do ar, conta na memória.
 */
@Injectable()
export class RateThrottlerStorage implements ThrottlerStorage {
  constructor(
    @Inject(RATE_STORE) private readonly store: CacheStore,
    @Inject(RATE_PREFIX) private readonly prefix: string,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hit = await this.store.rateHit(
      `${this.prefix}:${throttlerName}:${key}`,
      ttl,
      limit,
      blockDuration,
    );
    return {
      totalHits: hit.hits,
      timeToExpire: Math.ceil(hit.ttlMs / 1000),
      isBlocked: hit.blocked,
      timeToBlockExpire: Math.ceil(hit.blockMs / 1000),
    };
  }
}
