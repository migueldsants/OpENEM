import { RedisCacheStore } from './cache-store';
import { invalidateCatalogCache } from './catalog-invalidation';

describe('invalidateCatalogCache', () => {
  afterEach(() => jest.restoreAllMocks());

  function fakeStore(incr: () => Promise<number>) {
    const store = {
      ready: jest.fn().mockResolvedValue(undefined),
      incr: jest.fn(incr),
      close: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .spyOn(RedisCacheStore, 'fromUrl')
      .mockReturnValue(store as unknown as RedisCacheStore);
    return store;
  }

  it('sem REDIS_URL não conecta em nada', async () => {
    const spy = jest.spyOn(RedisCacheStore, 'fromUrl');
    await invalidateCatalogCache({}, () => undefined);
    expect(spy).not.toHaveBeenCalled();
  });

  it('troca a versão do catálogo e fecha a conexão', async () => {
    const store = fakeStore(() => Promise.resolve(3));
    const log = jest.fn();
    await invalidateCatalogCache({ REDIS_URL: 'redis://x' }, log);
    expect(store.incr).toHaveBeenCalledWith('openem:v1:ns:catalog');
    expect(store.close).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('versão 3'));
  });

  it('Redis fora do ar só avisa, sem lançar', async () => {
    const store = fakeStore(() => Promise.reject(new Error('ECONNREFUSED')));
    const log = jest.fn();
    await expect(
      invalidateCatalogCache({ REDIS_URL: 'redis://x' }, log),
    ).resolves.toBeUndefined();
    expect(store.close).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });
});
