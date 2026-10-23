import {
  type CacheStore,
  createCacheStore,
  FallbackCacheStore,
  MemoryCacheStore,
  RedisCacheStore,
  redisUrlFromEnv,
} from './cache-store';

describe('MemoryCacheStore — rate limiting', () => {
  it('incrWithTtl: o prazo conta do primeiro incremento', async () => {
    let t = 0;
    const s = new MemoryCacheStore(() => t);
    await expect(s.incrWithTtl('n', 1000)).resolves.toBe(1);
    t = 600;
    await expect(s.incrWithTtl('n', 1000)).resolves.toBe(2);
    await expect(s.pttl('n')).resolves.toBe(400);
    t = 1000;
    await expect(s.incrWithTtl('n', 1000)).resolves.toBe(1);
  });

  it('pttl de chave ausente é null, e sem prazo é -1', async () => {
    const s = new MemoryCacheStore();
    await expect(s.pttl('nada')).resolves.toBeNull();
    await s.incr('versao');
    await expect(s.pttl('versao')).resolves.toBe(-1);
  });

  it('rateHit bloqueia ao passar do limite e não conta enquanto bloqueado', async () => {
    let t = 0;
    const s = new MemoryCacheStore(() => t);
    await s.rateHit('k', 1000, 2, 5000);
    await s.rateHit('k', 1000, 2, 5000);
    await expect(s.rateHit('k', 1000, 2, 5000)).resolves.toMatchObject({
      blocked: true,
      blockMs: 5000,
    });
    t = 2000;
    await expect(s.rateHit('k', 1000, 2, 5000)).resolves.toMatchObject({
      blocked: true,
      blockMs: 3000,
    });
    t = 5000;
    await expect(s.rateHit('k', 1000, 2, 5000)).resolves.toMatchObject({
      hits: 1,
      blocked: false,
    });
  });
});

describe('FallbackCacheStore', () => {
  function quebrado(): CacheStore {
    const boom = () => Promise.reject(new Error('ECONNREFUSED'));
    return {
      kind: 'redis',
      get: boom,
      set: boom,
      del: boom,
      incr: boom,
      setIfAbsent: boom,
      delIfValue: boom,
      incrWithTtl: boom,
      pttl: boom,
      rateHit: boom,
      ping: () => Promise.resolve(false),
      close: () => Promise.resolve(),
    };
  }

  it('com o primário fora do ar, conta na reserva e avisa', async () => {
    const onError = jest.fn();
    const s = new FallbackCacheStore(
      quebrado(),
      new MemoryCacheStore(),
      onError,
    );
    await s.rateHit('k', 1000, 1, 1000);
    await expect(s.rateHit('k', 1000, 1, 1000)).resolves.toMatchObject({
      blocked: true,
    });
    expect(onError).toHaveBeenCalled();
    expect(s.kind).toBe('redis');
  });

  it('com o primário no ar, não toca na reserva', async () => {
    const reserva = new MemoryCacheStore();
    const s = new FallbackCacheStore(new MemoryCacheStore(), reserva);
    await s.set('k', 'v', 1000);
    await expect(s.get('k')).resolves.toBe('v');
    await expect(reserva.get('k')).resolves.toBeNull();
  });
});

describe('MemoryCacheStore', () => {
  it('grava, lê e apaga', async () => {
    const s = new MemoryCacheStore();
    await s.set('k', 'v', 1000);
    await expect(s.get('k')).resolves.toBe('v');
    await s.del('k');
    await expect(s.get('k')).resolves.toBeNull();
  });

  it('expira no TTL', async () => {
    let t = 0;
    const s = new MemoryCacheStore(() => t);
    await s.set('k', 'v', 1000);
    t = 999;
    await expect(s.get('k')).resolves.toBe('v');
    t = 1000;
    await expect(s.get('k')).resolves.toBeNull();
  });

  it('incr começa em 1 e não expira', async () => {
    let t = 0;
    const s = new MemoryCacheStore(() => t);
    await expect(s.incr('n')).resolves.toBe(1);
    await expect(s.incr('n')).resolves.toBe(2);
    t = Number.MAX_SAFE_INTEGER;
    await expect(s.get('n')).resolves.toBe('2');
  });

  it('setIfAbsent só grava a primeira vez', async () => {
    const s = new MemoryCacheStore();
    await expect(s.setIfAbsent('l', 'a', 1000)).resolves.toBe(true);
    await expect(s.setIfAbsent('l', 'b', 1000)).resolves.toBe(false);
    await expect(s.get('l')).resolves.toBe('a');
  });

  it('delIfValue não apaga valor de outro', async () => {
    const s = new MemoryCacheStore();
    await s.set('l', 'a', 1000);
    await s.delIfValue('l', 'b');
    await expect(s.get('l')).resolves.toBe('a');
    await s.delIfValue('l', 'a');
    await expect(s.get('l')).resolves.toBeNull();
  });

  it('passado o teto, despeja a chave mais antiga', async () => {
    const s = new MemoryCacheStore(Date.now, 2);
    await s.set('a', '1', 1000);
    await s.set('b', '2', 1000);
    // Regravar "a" a põe no fim da fila.
    await s.set('a', '1', 1000);
    await s.set('c', '3', 1000);
    await expect(s.get('b')).resolves.toBeNull();
    await expect(s.get('a')).resolves.toBe('1');
    await expect(s.get('c')).resolves.toBe('3');
  });

  it('ping responde e close esvazia', async () => {
    const s = new MemoryCacheStore();
    await s.set('k', 'v', 1000);
    await expect(s.ping()).resolves.toBe(true);
    await s.close();
    await expect(s.get('k')).resolves.toBeNull();
  });
});

describe('redisUrlFromEnv', () => {
  it.each([
    [{}, null],
    [{ REDIS_URL: '' }, null],
    [{ REDIS_URL: '   ' }, null],
    [{ REDIS_URL: ' redis://:s@redis:6379 ' }, 'redis://:s@redis:6379'],
  ])('%p → %p', (env, esperado) => {
    expect(redisUrlFromEnv(env)).toBe(esperado);
  });
});

describe('createCacheStore', () => {
  it('sem REDIS_URL, memória', () => {
    expect(createCacheStore({}).kind).toBe('memory');
  });

  it('com REDIS_URL, Redis (sem conectar aqui)', () => {
    const fake = { kind: 'redis' } as RedisCacheStore;
    const spy = jest.spyOn(RedisCacheStore, 'fromUrl').mockReturnValue(fake);
    expect(createCacheStore({ REDIS_URL: 'redis://x:6379' })).toBe(fake);
    expect(spy).toHaveBeenCalledWith('redis://x:6379', undefined);
    spy.mockRestore();
  });
});
