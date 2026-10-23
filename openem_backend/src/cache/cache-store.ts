import Redis from 'ioredis';

/**
 * Onde o cache guarda os valores: o Redis quando há `REDIS_URL`, a memória do
 * processo quando não há. Sem dependência do Nest: os scripts do `prisma/`
 * usam o mesmo armazenamento para invalidar o catálogo.
 */
export interface CacheStore {
  readonly kind: 'redis' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Incrementa um contador sem prazo (versão de namespace). */
  incr(key: string): Promise<number>;
  /** Grava só se a chave não existir (trava). true = gravou. */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Apaga só se o valor ainda for este (soltar a própria trava). */
  delIfValue(key: string, value: string): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

interface MemoryEntry {
  value: string;
  /** Infinity = sem prazo. */
  expiresAt: number;
}

/** Teto de chaves em memória; passado dele, sai a mais antiga. */
export const MEMORY_MAX_ENTRIES = 5000;

/**
 * Cache em memória, para dev sem Docker, testes e self-host com uma instância.
 * Vale só para o próprio processo.
 */
export class MemoryCacheStore implements CacheStore {
  readonly kind = 'memory' as const;
  private readonly entries = new Map<string, MemoryEntry>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = MEMORY_MAX_ENTRIES,
  ) {}

  private read(key: string): MemoryEntry | undefined {
    const e = this.entries.get(key);
    if (e && e.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  private write(key: string, entry: MemoryEntry): void {
    // Regravar põe a chave no fim da fila de despejo.
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.read(key)?.value ?? null);
  }

  set(key: string, value: string, ttlMs: number): Promise<void> {
    this.write(key, { value, expiresAt: this.now() + ttlMs });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  incr(key: string): Promise<number> {
    const atual = Number.parseInt(this.read(key)?.value ?? '0', 10) || 0;
    const novo = atual + 1;
    this.write(key, { value: String(novo), expiresAt: Infinity });
    return Promise.resolve(novo);
  }

  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (this.read(key)) return Promise.resolve(false);
    this.write(key, { value, expiresAt: this.now() + ttlMs });
    return Promise.resolve(true);
  }

  delIfValue(key: string, value: string): Promise<void> {
    if (this.read(key)?.value === value) this.entries.delete(key);
    return Promise.resolve();
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }
}

/** Apaga a chave só se o valor bater, numa operação atômica. */
const DEL_IF_VALUE = `if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

export class RedisCacheStore implements CacheStore {
  readonly kind = 'redis' as const;

  constructor(private readonly redis: Redis) {}

  /**
   * Cliente que falha rápido: sem fila offline, um comando com o Redis fora do
   * ar dá erro na hora (e o serviço lê do banco), em vez de segurar a
   * requisição até a conexão voltar.
   */
  static fromUrl(url: string, onError?: (err: Error) => void): RedisCacheStore {
    const redis = new Redis(url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 1000,
      // Reconecta sempre, com espera crescente até 5 s.
      retryStrategy: (tentativas) => Math.min(tentativas * 200, 5000),
    });
    // Sem ouvinte, o ioredis imprime cada falha de conexão no console.
    redis.on('error', (err: Error) => onError?.(err));
    return new RedisCacheStore(redis);
  }

  /**
   * Espera a conexão ficar pronta. Sem fila offline, um comando dado antes
   * disso falha; a API aceita (vira *miss*), mas um script que roda um comando
   * só precisa esperar.
   */
  ready(timeoutMs = 3000): Promise<void> {
    if (this.redis.status === 'ready') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.redis.off('ready', onReady);
        reject(new Error(`Redis não respondeu em ${timeoutMs} ms`));
      }, timeoutMs);
      const onReady = () => {
        clearTimeout(timer);
        resolve();
      };
      this.redis.once('ready', onReady);
    });
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.redis.set(key, value, 'PX', Math.max(1, Math.floor(ttlMs)));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const ok = await this.redis.set(
      key,
      value,
      'PX',
      Math.max(1, Math.floor(ttlMs)),
      'NX',
    );
    return ok === 'OK';
  }

  async delIfValue(key: string, value: string): Promise<void> {
    await this.redis.eval(DEL_IF_VALUE, 1, key, value);
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Fecha a conexão de vez. Com a conexão pronta, `quit` deixa os comandos em
   * andamento terminarem (com prazo). Sem ela (Redis fora do ar), `quit` não
   * cancela a próxima tentativa de reconexão, e o timer dela segura o processo
   * vivo: no CI, o Jest nunca terminava. `disconnect` encerra e cancela.
   */
  async close(): Promise<void> {
    if (this.redis.status === 'ready') {
      try {
        await Promise.race([
          this.redis.quit(),
          new Promise((r) => setTimeout(r, 1000).unref()),
        ]);
      } catch {
        // cai no disconnect
      }
    }
    if (this.redis.status !== 'end') this.redis.disconnect();
  }
}

/** `REDIS_URL` vazia conta como não definida, como as variáveis de IA. */
export function redisUrlFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const url = env.REDIS_URL?.trim();
  return url ? url : null;
}

export function createCacheStore(
  env: Record<string, string | undefined> = process.env,
  onError?: (err: Error) => void,
): CacheStore {
  const url = redisUrlFromEnv(env);
  return url ? RedisCacheStore.fromUrl(url, onError) : new MemoryCacheStore();
}
