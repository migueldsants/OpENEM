import { MEMORY_NAMESPACE_TTL_MS } from '../common/cache-keys';
import { type CacheStore, MemoryCacheStore } from './cache-store';
import { CacheService } from './cache.service';

/** Armazenamento que falha em tudo, como um Redis fora do ar. */
function brokenStore(): CacheStore {
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

const HORA = 60 * 60 * 1000;

describe('CacheService', () => {
  describe('getOrSet', () => {
    it('carrega uma vez e serve do cache depois', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const loader = jest.fn().mockResolvedValue({ n: 1 });
      await expect(cache.getOrSet(['k'], HORA, loader)).resolves.toEqual({
        n: 1,
      });
      await expect(cache.getOrSet(['k'], HORA, loader)).resolves.toEqual({
        n: 1,
      });
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('pedidos simultâneos esperam a mesma carga', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      let solta!: (v: string) => void;
      const loader = jest.fn(() => new Promise<string>((r) => (solta = r)));
      const a = cache.getOrSet(['k'], HORA, loader);
      const b = cache.getOrSet(['k'], HORA, loader);
      await new Promise((r) => setImmediate(r));
      solta('x');
      await expect(Promise.all([a, b])).resolves.toEqual(['x', 'x']);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('undefined do loader não é gravado', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const loader = jest.fn().mockResolvedValue(undefined);
      await cache.getOrSet(['nada'], HORA, loader);
      await cache.getOrSet(['nada'], HORA, loader);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('null é gravado (é um valor)', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const loader = jest.fn().mockResolvedValue(null);
      await cache.getOrSet(['nulo'], HORA, loader);
      await expect(cache.getOrSet(['nulo'], HORA, loader)).resolves.toBeNull();
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('erro do loader chega a quem pediu e não fica gravado', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const loader = jest
        .fn()
        .mockRejectedValueOnce(new Error('banco'))
        .mockResolvedValueOnce('ok');
      await expect(cache.getOrSet(['k'], HORA, loader)).rejects.toThrow(
        'banco',
      );
      await expect(cache.getOrSet(['k'], HORA, loader)).resolves.toBe('ok');
    });

    it('com o armazenamento fora do ar, lê do loader sem erro', async () => {
      const cache = new CacheService(brokenStore());
      const loader = jest.fn().mockResolvedValue([1, 2]);
      await expect(
        cache.getOrSet(['k'], HORA, loader, { ns: 'catalog' }),
      ).resolves.toEqual([1, 2]);
      await expect(cache.getOrSet(['k'], HORA, loader)).resolves.toEqual([
        1, 2,
      ]);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('avisa no log no máximo uma vez por minuto', async () => {
      const cache = new CacheService(brokenStore());
      let t = 0;
      cache.now = () => t;
      const warn = jest
        .spyOn(
          (cache as unknown as { logger: { warn: () => void } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      const loader = () => Promise.resolve(1);
      await cache.getOrSet(['a'], HORA, loader);
      await cache.getOrSet(['b'], HORA, loader);
      expect(warn).toHaveBeenCalledTimes(1);
      t = 60_000;
      await cache.getOrSet(['c'], HORA, loader);
      expect(warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('namespace', () => {
    it('bump invalida tudo do namespace', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const loader = jest
        .fn()
        .mockResolvedValueOnce('velho')
        .mockResolvedValueOnce('novo');
      await cache.getOrSet(['exams'], HORA, loader, { ns: 'catalog' });
      await cache.bump('catalog');
      await expect(
        cache.getOrSet(['exams'], HORA, loader, { ns: 'catalog' }),
      ).resolves.toBe('novo');
    });

    it('bump não mexe em chave sem namespace', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      await cache.set(['stars', 'a/b'], 7, HORA);
      await cache.bump('catalog');
      await expect(cache.get(['stars', 'a/b'])).resolves.toBe(7);
    });

    it('em memória, chave de namespace expira em um minuto', async () => {
      let t = 0;
      const cache = new CacheService(new MemoryCacheStore(() => t));
      await cache.set(['exams'], 'x', HORA, { ns: 'catalog' });
      await cache.set(['solta'], 'y', HORA);
      t = MEMORY_NAMESPACE_TTL_MS;
      await expect(cache.get(['exams'], { ns: 'catalog' })).resolves.toBe(
        undefined,
      );
      await expect(cache.get(['solta'])).resolves.toBe('y');
    });

    it('del apaga só a chave pedida', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      await cache.set(['question', 'q1'], 1, HORA, { ns: 'catalog' });
      await cache.set(['question', 'q2'], 2, HORA, { ns: 'catalog' });
      await cache.del(['question', 'q1'], { ns: 'catalog' });
      await expect(
        cache.get(['question', 'q1'], { ns: 'catalog' }),
      ).resolves.toBeUndefined();
      await expect(
        cache.get(['question', 'q2'], { ns: 'catalog' }),
      ).resolves.toBe(2);
    });
  });

  describe('lock', () => {
    it('só um dono por vez, e só o dono solta', async () => {
      const cache = new CacheService(new MemoryCacheStore());
      const dono = await cache.lock(['explanation', 'q1'], 1000);
      expect(dono).toEqual(expect.any(String));
      await expect(cache.lock(['explanation', 'q1'], 1000)).resolves.toBeNull();
      await cache.unlock(['explanation', 'q1'], 'outro-dono');
      await expect(cache.lock(['explanation', 'q1'], 1000)).resolves.toBeNull();
      await cache.unlock(['explanation', 'q1'], dono!);
      await expect(cache.lock(['explanation', 'q1'], 1000)).resolves.toEqual(
        expect.any(String),
      );
    });

    it('a trava expira sozinha', async () => {
      let t = 0;
      const cache = new CacheService(new MemoryCacheStore(() => t));
      await cache.lock(['x'], 1000);
      t = 1000;
      await expect(cache.lock(['x'], 1000)).resolves.toEqual(
        expect.any(String),
      );
    });

    it('com o armazenamento fora do ar, deixa seguir', async () => {
      const cache = new CacheService(brokenStore());
      await expect(cache.lock(['x'], 1000)).resolves.toEqual(
        expect.any(String),
      );
      await expect(cache.unlock(['x'], 'qualquer')).resolves.toBeUndefined();
    });
  });

  describe('status', () => {
    it('memória é "disabled"', async () => {
      await expect(
        new CacheService(new MemoryCacheStore()).status(),
      ).resolves.toBe('disabled');
    });

    it('Redis sem resposta é "down"', async () => {
      await expect(new CacheService(brokenStore()).status()).resolves.toBe(
        'down',
      );
    });

    it('Redis respondendo é "up"', async () => {
      const store = { ...brokenStore(), ping: () => Promise.resolve(true) };
      await expect(new CacheService(store).status()).resolves.toBe('up');
    });
  });

  it('fecha o armazenamento ao desligar', async () => {
    const store = new MemoryCacheStore();
    const close = jest.spyOn(store, 'close');
    await new CacheService(store).onModuleDestroy();
    expect(close).toHaveBeenCalled();
  });
});
