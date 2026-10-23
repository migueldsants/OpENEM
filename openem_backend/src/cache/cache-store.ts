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
  /** Incrementa um contador; o prazo começa a contar no primeiro incremento. */
  incrWithTtl(key: string, ttlMs: number): Promise<number>;
  /** Milissegundos até a chave expirar; null se ela não existe. */
  pttl(key: string): Promise<number | null>;
  /**
   * Um pedido contra um limite de janela fixa (rate limiting): conta o pedido
   * e, se passou de `limit`, bloqueia a chave por `blockMs`. Bloqueada, não
   * conta mais nada até o bloqueio vencer. Atômico no Redis (script Lua).
   */
  rateHit(
    key: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ): Promise<RateHit>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export interface RateHit {
  hits: number;
  /** Milissegundos até a janela de contagem recomeçar. */
  ttlMs: number;
  blocked: boolean;
  /** Milissegundos até o bloqueio vencer (0 sem bloqueio). */
  blockMs: number;
}

/** Chave do bloqueio de uma chave de rate limiting. */
export function blockKeyOf(key: string): string {
  return `${key}:block`;
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

  incrWithTtl(key: string, ttlMs: number): Promise<number> {
    const atual = this.read(key);
    const novo = (Number.parseInt(atual?.value ?? '0', 10) || 0) + 1;
    this.write(key, {
      value: String(novo),
      expiresAt: atual ? atual.expiresAt : this.now() + ttlMs,
    });
    return Promise.resolve(novo);
  }

  pttl(key: string): Promise<number | null> {
    const e = this.read(key);
    if (!e) return Promise.resolve(null);
    return Promise.resolve(
      e.expiresAt === Infinity ? -1 : e.expiresAt - this.now(),
    );
  }

  async rateHit(
    key: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ): Promise<RateHit> {
    const bloqueio = this.read(blockKeyOf(key));
    if (bloqueio) {
      const atual = this.read(key);
      return {
        hits: Number.parseInt(atual?.value ?? '0', 10) || 0,
        ttlMs: atual ? atual.expiresAt - this.now() : 0,
        blocked: true,
        blockMs: bloqueio.expiresAt - this.now(),
      };
    }
    const hits = await this.incrWithTtl(key, ttlMs);
    const restante = this.read(key)!.expiresAt - this.now();
    if (hits > limit) {
      this.write(blockKeyOf(key), {
        value: '1',
        expiresAt: this.now() + blockMs,
      });
      // Vencido o bloqueio, a contagem recomeça do zero.
      this.entries.delete(key);
      return { hits, ttlMs: restante, blocked: true, blockMs };
    }
    return { hits, ttlMs: restante, blocked: false, blockMs: 0 };
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

/** INCR que liga o prazo só no primeiro incremento. */
const INCR_WITH_TTL = `local n = redis.call('INCR', KEYS[1])
if n == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return n`;

/**
 * Janela fixa com bloqueio, a mesma regra do MemoryCacheStore.rateHit.
 * KEYS[1] = contador, KEYS[2] = bloqueio; ARGV = ttl, limite, bloqueio (ms).
 * Devolve {pedidos, ms da janela, bloqueado (0/1), ms do bloqueio}.
 */
const RATE_HIT = `local bloqueio = redis.call('PTTL', KEYS[2])
if bloqueio > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, redis.call('PTTL', KEYS[1]), 1, bloqueio}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}`;

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

  async incrWithTtl(key: string, ttlMs: number): Promise<number> {
    return Number(
      await this.redis.eval(
        INCR_WITH_TTL,
        1,
        key,
        Math.max(1, Math.floor(ttlMs)),
      ),
    );
  }

  async pttl(key: string): Promise<number | null> {
    const ms = await this.redis.pttl(key);
    // -2: não existe; -1: sem prazo.
    return ms === -2 ? null : ms;
  }

  async rateHit(
    key: string,
    ttlMs: number,
    limit: number,
    blockMs: number,
  ): Promise<RateHit> {
    const [hits, ttl, blocked, block] = (await this.redis.eval(
      RATE_HIT,
      2,
      key,
      blockKeyOf(key),
      Math.max(1, Math.floor(ttlMs)),
      limit,
      Math.max(1, Math.floor(blockMs)),
    )) as [number, number, number, number];
    return {
      hits: Number(hits),
      ttlMs: Math.max(0, Number(ttl)),
      blocked: Number(blocked) === 1,
      blockMs: Math.max(0, Number(block)),
    };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
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

/**
 * Usa o primeiro armazenamento e, quando ele falha, o segundo. É o que o rate
 * limiting usa: com o Redis fora do ar os limites continuam valendo, contados
 * na memória de cada instância, em vez de travar a API ou liberar tudo.
 */
export class FallbackCacheStore implements CacheStore {
  get kind(): CacheStore['kind'] {
    return this.primary.kind;
  }

  constructor(
    private readonly primary: CacheStore,
    private readonly fallback: CacheStore,
    private readonly onError: (err: unknown) => void = () => undefined,
  ) {}

  private async run<T>(op: (s: CacheStore) => Promise<T>): Promise<T> {
    try {
      return await op(this.primary);
    } catch (err) {
      this.onError(err);
      return op(this.fallback);
    }
  }

  get(key: string) {
    return this.run((s) => s.get(key));
  }
  set(key: string, value: string, ttlMs: number) {
    return this.run((s) => s.set(key, value, ttlMs));
  }
  del(key: string) {
    return this.run((s) => s.del(key));
  }
  incr(key: string) {
    return this.run((s) => s.incr(key));
  }
  setIfAbsent(key: string, value: string, ttlMs: number) {
    return this.run((s) => s.setIfAbsent(key, value, ttlMs));
  }
  delIfValue(key: string, value: string) {
    return this.run((s) => s.delIfValue(key, value));
  }
  incrWithTtl(key: string, ttlMs: number) {
    return this.run((s) => s.incrWithTtl(key, ttlMs));
  }
  pttl(key: string) {
    return this.run((s) => s.pttl(key));
  }
  rateHit(key: string, ttlMs: number, limit: number, blockMs: number) {
    return this.run((s) => s.rateHit(key, ttlMs, limit, blockMs));
  }
  ping() {
    return this.primary.ping();
  }
  async close(): Promise<void> {
    // O primário é do CacheModule, que o fecha; aqui só a memória.
    await this.fallback.close();
  }
}
