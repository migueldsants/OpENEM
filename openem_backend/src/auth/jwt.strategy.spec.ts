import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

function makeStrategy(user: { id: string } | null) {
  const config = new ConfigService({
    JWT_SECRET: 'segredo-de-teste-com-comprimento-suficiente',
  });
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  return {
    strategy: new JwtStrategy(config, prisma as unknown as PrismaService),
    prisma,
  };
}

describe('JwtStrategy', () => {
  it('devolve o aluno do token quando a conta existe', async () => {
    const { strategy, prisma } = makeStrategy({ id: 'u1' });
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com' }),
    ).resolves.toEqual({ userId: 'u1', email: 'a@b.com' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true },
    });
  });

  it('token de conta excluída é 401', async () => {
    const { strategy } = makeStrategy(null);
    await expect(
      strategy.validate({ sub: 'apagado', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
