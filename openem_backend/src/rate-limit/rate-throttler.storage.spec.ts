import { MemoryCacheStore } from '../cache/cache-store';
import { RateThrottlerStorage } from './rate-throttler.storage';

function setup() {
  let t = 0;
  const store = new MemoryCacheStore(() => t);
  return {
    storage: new RateThrottlerStorage(store, 'rl'),
    avanca: (ms: number) => {
      t += ms;
    },
  };
}

describe('RateThrottlerStorage', () => {
  it('conta até o limite sem bloquear', async () => {
    const { storage } = setup();
    for (let i = 1; i <= 3; i++) {
      const r = await storage.increment('k', 60_000, 3, 60_000, 'default');
      expect(r).toEqual({
        totalHits: i,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    }
  });

  it('passou do limite, bloqueia pelo tempo pedido', async () => {
    const { storage } = setup();
    for (let i = 0; i < 3; i++) {
      await storage.increment('k', 60_000, 3, 30_000, 'default');
    }
    const r = await storage.increment('k', 60_000, 3, 30_000, 'default');
    expect(r.isBlocked).toBe(true);
    expect(r.timeToBlockExpire).toBe(30);
  });

  it('bloqueada, o tempo restante cai e a contagem recomeça depois', async () => {
    const { storage, avanca } = setup();
    for (let i = 0; i < 4; i++) {
      await storage.increment('k', 1000, 3, 10_000, 'burst');
    }
    avanca(4000);
    const meio = await storage.increment('k', 1000, 3, 10_000, 'burst');
    expect(meio.isBlocked).toBe(true);
    expect(meio.timeToBlockExpire).toBe(6);
    avanca(6000);
    const depois = await storage.increment('k', 1000, 3, 10_000, 'burst');
    expect(depois).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('a janela vence e a contagem recomeça', async () => {
    const { storage, avanca } = setup();
    await storage.increment('k', 1000, 3, 1000, 'default');
    await storage.increment('k', 1000, 3, 1000, 'default');
    avanca(1000);
    const r = await storage.increment('k', 1000, 3, 1000, 'default');
    expect(r.totalHits).toBe(1);
  });

  it('throttlers diferentes não dividem o contador', async () => {
    const { storage } = setup();
    await storage.increment('k', 1000, 1, 1000, 'burst');
    const r = await storage.increment('k', 1000, 1, 1000, 'default');
    expect(r).toMatchObject({ totalHits: 1, isBlocked: false });
  });
});
