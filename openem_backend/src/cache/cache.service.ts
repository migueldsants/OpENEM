import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  cacheKey,
  type CacheNamespace,
  deserialize,
  effectiveTtl,
  namespaceVersionKey,
  parseVersion,
  serialize,
  shouldLog,
  ttlWithJitter,
} from '../common/cache-keys';
import type { CacheStore } from './cache-store';

export const CACHE_STORE = Symbol('CACHE_STORE');

export interface CacheKeyOptions {
  /** Namespace invalidado junto (ex.: `catalog`, trocado pelo import). */
  ns?: CacheNamespace;
}

/**
 * Cache compartilhado (issue #86). Com `REDIS_URL` vale para todas as
 * instâncias; sem ela, só para este processo.
 *
 * Erro do armazenamento nunca chega ao aluno: vira *miss* (o valor sai do
 * banco) e um aviso no log, no máximo um por minuto.
 *
 * Só entra aqui o que é igual para todo aluno. Resposta com dado de um aluno
 * (favorito, nota, resposta) nunca vai para uma chave compartilhada, e
 * correção de simulado, gabarito, XP e cota de IA não passam pelo cache.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  /** Cargas em andamento neste processo, por chave (single-flight). */
  private readonly loading = new Map<string, Promise<unknown>>();
  private lastErrorLog: number | null = null;
  /** Relógio dos avisos de erro; os testes trocam. */
  now: () => number = Date.now;

  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore) {}

  get backend(): CacheStore['kind'] {
    return this.store.kind;
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }

  /** `up`/`down` com Redis; `disabled` quando o cache é só da memória. */
  async status(): Promise<'up' | 'down' | 'disabled'> {
    if (this.store.kind === 'memory') return 'disabled';
    return (await this.store.ping()) ? 'up' : 'down';
  }

  private warn(op: string, err: unknown): void {
    const agora = this.now();
    if (!shouldLog(agora, this.lastErrorLog)) return;
    this.lastErrorLog = agora;
    this.logger.warn(
      `cache indisponível (${op}): ${(err as Error)?.message ?? err}; lendo do banco`,
    );
  }

  /** Chave completa, com a versão atual do namespace. null = Redis falhou. */
  private async key(
    parts: readonly (string | number)[],
    opts: CacheKeyOptions,
  ): Promise<string | null> {
    if (!opts.ns) return cacheKey(parts);
    try {
      const raw = await this.store.get(namespaceVersionKey(opts.ns));
      return cacheKey(parts, { name: opts.ns, version: parseVersion(raw) });
    } catch (err) {
      this.warn('versão', err);
      return null;
    }
  }

  async get<T>(
    parts: readonly (string | number)[],
    opts: CacheKeyOptions = {},
  ): Promise<T | undefined> {
    const key = await this.key(parts, opts);
    if (!key) return undefined;
    try {
      const found = deserialize<T>(await this.store.get(key));
      return found.hit ? found.value : undefined;
    } catch (err) {
      this.warn('get', err);
      return undefined;
    }
  }

  async set(
    parts: readonly (string | number)[],
    value: unknown,
    ttlMs: number,
    opts: CacheKeyOptions = {},
  ): Promise<void> {
    const key = await this.key(parts, opts);
    if (key) await this.write(key, value, ttlMs, opts);
  }

  private async write(
    key: string,
    value: unknown,
    ttlMs: number,
    opts: CacheKeyOptions,
  ): Promise<void> {
    const ttl = effectiveTtl(ttlWithJitter(ttlMs), {
      memory: this.store.kind === 'memory',
      namespaced: !!opts.ns,
    });
    try {
      await this.store.set(key, serialize(value), ttl);
    } catch (err) {
      this.warn('set', err);
    }
  }

  async del(
    parts: readonly (string | number)[],
    opts: CacheKeyOptions = {},
  ): Promise<void> {
    const key = await this.key(parts, opts);
    if (!key) return;
    try {
      await this.store.del(key);
    } catch (err) {
      this.warn('del', err);
    }
  }

  /**
   * Lê do cache ou carrega e grava. Pedidos simultâneos da mesma chave neste
   * processo esperam a mesma carga, para um cache vazio não mandar a mesma
   * consulta ao banco uma vez por aluno. `undefined` do loader não é gravado
   * (ex.: questão inexistente), para id inventado não encher o cache.
   */
  async getOrSet<T>(
    parts: readonly (string | number)[],
    ttlMs: number,
    loader: () => Promise<T>,
    opts: CacheKeyOptions = {},
  ): Promise<T> {
    const key = await this.key(parts, opts);
    if (!key) return loader();

    const emAndamento = this.loading.get(key);
    if (emAndamento) return emAndamento as Promise<T>;

    const tarefa = (async () => {
      try {
        const found = deserialize<T>(await this.store.get(key));
        if (found.hit) {
          this.logger.debug(`hit ${key}`);
          return found.value;
        }
      } catch (err) {
        this.warn('get', err);
      }
      this.logger.debug(`miss ${key}`);
      const value = await loader();
      if (value !== undefined) await this.write(key, value, ttlMs, opts);
      return value;
    })().finally(() => this.loading.delete(key));
    this.loading.set(key, tarefa);
    return tarefa;
  }

  /**
   * Invalida um namespace trocando a versão. Os scripts de seed e import fazem
   * o mesmo por `invalidateCatalogCache` (`catalog-invalidation.ts`).
   */
  async bump(ns: CacheNamespace): Promise<void> {
    try {
      await this.store.incr(namespaceVersionKey(ns));
    } catch (err) {
      this.warn('bump', err);
    }
  }

  /**
   * Trava entre instâncias (`SET NX PX`). Devolve o dono da trava, para
   * soltar com `unlock`, ou null quando outra instância já a tem. Com o Redis
   * fora do ar devolve um dono assim mesmo: sem trava, o pior caso é pagar
   * duas vezes, nunca deixar de responder.
   */
  async lock(
    parts: readonly (string | number)[],
    ttlMs: number,
  ): Promise<string | null> {
    const token = randomUUID();
    try {
      const ok = await this.store.setIfAbsent(
        cacheKey(['lock', ...parts]),
        token,
        ttlMs,
      );
      return ok ? token : null;
    } catch (err) {
      this.warn('lock', err);
      return token;
    }
  }

  async unlock(
    parts: readonly (string | number)[],
    token: string,
  ): Promise<void> {
    try {
      await this.store.delIfValue(cacheKey(['lock', ...parts]), token);
    } catch (err) {
      this.warn('unlock', err);
    }
  }
}
