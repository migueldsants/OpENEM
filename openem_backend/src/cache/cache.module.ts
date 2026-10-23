import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shouldLog } from '../common/cache-keys';
import { createCacheStore } from './cache-store';
import { CACHE_STORE, CacheService } from './cache.service';

/**
 * Cache global (issue #86): injete `CacheService` em qualquer módulo. Sem
 * `REDIS_URL` o backend sobe com o cache em memória; em produção isso só gera
 * um aviso, para o self-host com uma instância continuar funcionando.
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('CacheModule');
        let ultimo: number | null = null;
        const store = createCacheStore(
          { REDIS_URL: config.get<string>('REDIS_URL') },
          (err) => {
            const agora = Date.now();
            if (!shouldLog(agora, ultimo)) return;
            ultimo = agora;
            logger.warn(`Redis: ${err.message}`);
          },
        );
        if (store.kind === 'memory') {
          const msg =
            'REDIS_URL não definida: cache só na memória deste processo';
          if (config.get<string>('NODE_ENV') === 'production') {
            logger.warn(`${msg} (com mais de uma instância, defina REDIS_URL)`);
          } else {
            logger.log(msg);
          }
        }
        return store;
      },
    },
    CacheService,
  ],
  exports: [CACHE_STORE, CacheService],
})
export class CacheModule {}
