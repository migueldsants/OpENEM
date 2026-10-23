import { randomUUID } from 'node:crypto';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CacheStore,
  FallbackCacheStore,
  MemoryCacheStore,
} from '../cache/cache-store';
import { CACHE_STORE } from '../cache/cache.service';
import { shouldLog } from '../common/cache-keys';
import { rateKeyPrefix } from '../common/rate-limit';
import { LoginAttemptsService } from './login-attempts.service';
import { RATE_PREFIX, RATE_STORE } from './rate-limit.tokens';
import { RateThrottlerStorage } from './rate-throttler.storage';

/**
 * Teto de chaves na memória de reserva. Bem acima do cache: despejar um
 * contador de login zeraria o limite de quem ataca.
 */
const RATE_MEMORY_MAX_ENTRIES = 100_000;

/**
 * Rate limiting distribuído (issue #87). Os contadores ficam no mesmo Redis
 * do cache; com ele fora do ar (ou sem `REDIS_URL`), na memória de cada
 * instância. Os limites nunca deixam de valer, nem travam a API.
 */
@Global()
@Module({
  providers: [
    {
      provide: RATE_STORE,
      inject: [CACHE_STORE],
      useFactory: (cache: CacheStore): CacheStore => {
        const memoria = new MemoryCacheStore(Date.now, RATE_MEMORY_MAX_ENTRIES);
        if (cache.kind === 'memory') return memoria;
        const logger = new Logger('RateLimit');
        let ultimo: number | null = null;
        return new FallbackCacheStore(cache, memoria, (err) => {
          const agora = Date.now();
          if (!shouldLog(agora, ultimo)) return;
          ultimo = agora;
          logger.warn(
            `Redis indisponível (${(err as Error)?.message ?? err}); limites contados na memória desta instância`,
          );
        });
      },
    },
    {
      provide: RATE_PREFIX,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        rateKeyPrefix(
          {
            THROTTLE_KEY_PREFIX: config.get<string>('THROTTLE_KEY_PREFIX'),
            NODE_ENV: config.get<string>('NODE_ENV'),
          },
          randomUUID,
        ),
    },
    RateThrottlerStorage,
    LoginAttemptsService,
  ],
  exports: [
    RATE_STORE,
    RATE_PREFIX,
    RateThrottlerStorage,
    LoginAttemptsService,
  ],
})
export class RateLimitModule {}
