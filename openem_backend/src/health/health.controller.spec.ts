import { memoryCache } from '../cache/testing';
import type { CacheService } from '../cache/cache.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('status ok com banco up', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const controller = new HealthController(prisma, memoryCache());
    expect(await controller.check()).toEqual({
      status: 'ok',
      database: 'up',
      redis: 'disabled',
    });
  });

  it('status ok com banco down quando a query falha', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error()),
    } as any;
    const controller = new HealthController(prisma, memoryCache());
    expect(await controller.check()).toEqual({
      status: 'ok',
      database: 'down',
      redis: 'disabled',
    });
  });

  it('Redis fora do ar aparece no corpo sem mudar o status', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const cache = { status: jest.fn().mockResolvedValue('down') };
    const controller = new HealthController(
      prisma,
      cache as unknown as CacheService,
    );
    expect(await controller.check()).toEqual({
      status: 'ok',
      database: 'up',
      redis: 'down',
    });
  });
});
