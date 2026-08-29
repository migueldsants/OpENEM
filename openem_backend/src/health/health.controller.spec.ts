import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('status ok com banco up', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) } as any;
    const controller = new HealthController(prisma);
    expect(await controller.check()).toEqual({ status: 'ok', database: 'up' });
  });

  it('status ok com banco down quando a query falha', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error()),
    } as any;
    const controller = new HealthController(prisma);
    expect(await controller.check()).toEqual({
      status: 'ok',
      database: 'down',
    });
  });
});
