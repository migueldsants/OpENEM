import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { memoryCache } from '../cache/testing';
import type { PrismaService } from '../prisma/prisma.service';
import { fakeAuthPrisma } from './fake-auth-prisma';
import { JwtStrategy } from './jwt.strategy';
import { SessionsService } from './sessions.service';

describe('SessionsService e JwtStrategy', () => {
  const jwt = new JwtService({ secret: 'segredo-de-teste-comprido' });
  let prisma: ReturnType<typeof fakeAuthPrisma>;
  let sessions: SessionsService;
  let strategy: JwtStrategy;
  let userId: string;

  beforeEach(async () => {
    prisma = fakeAuthPrisma();
    sessions = new SessionsService(
      prisma as unknown as PrismaService,
      jwt,
      memoryCache(),
    );
    strategy = new JwtStrategy(
      new ConfigService({ JWT_SECRET: 'segredo-de-teste-comprido' }),
      sessions,
    );
    userId = (
      await prisma.user.create({
        data: { email: 'a@b.com', passwordHash: 'h' },
      })
    ).id as string;
  });

  it('o token leva a versão atual da conta', async () => {
    const res = await sessions.issue({
      id: userId,
      email: 'a@b.com',
      tokenVersion: 3,
    });
    expect(res.user).toEqual({ id: userId, email: 'a@b.com' });
    expect(jwt.decode(res.accessToken)).toMatchObject({
      sub: userId,
      email: 'a@b.com',
      ver: 3,
    });
  });

  it('a estratégia aceita a versão atual e o token antigo sem `ver`', async () => {
    await expect(
      strategy.validate({ sub: userId, email: 'a@b.com', ver: 0 }),
    ).resolves.toEqual({ userId, email: 'a@b.com' });
    await expect(
      strategy.validate({ sub: userId, email: 'a@b.com' }),
    ).resolves.toEqual({ userId, email: 'a@b.com' });
  });

  it('encerrar as sessões derruba os tokens antigos na hora', async () => {
    // Lê uma vez, para a versão ficar no cache.
    expect(await sessions.currentVersion(userId)).toBe(0);
    const user = await sessions.revokeAll(userId);
    expect(user.tokenVersion).toBe(1);
    await expect(
      strategy.validate({ sub: userId, email: 'a@b.com', ver: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      strategy.validate({ sub: userId, email: 'a@b.com', ver: 1 }),
    ).resolves.toEqual({ userId, email: 'a@b.com' });
  });

  it('grava as outras mudanças junto com a versão', async () => {
    await sessions.revokeAll(userId, { passwordHash: 'novo' });
    expect(prisma.tabelas.user[0]).toMatchObject({
      passwordHash: 'novo',
      tokenVersion: 1,
    });
  });

  it('conta excluída: versão nula e token recusado', async () => {
    expect(await sessions.currentVersion('nao-existe')).toBeNull();
    await expect(
      strategy.validate({ sub: 'nao-existe', email: 'x@y.z', ver: 0 }),
    ).rejects.toThrow('Sessão encerrada');
  });

  it('a versão fica no cache: um pedido por aluno vai ao banco', async () => {
    const spy = jest.spyOn(prisma.user, 'findUnique');
    await sessions.currentVersion(userId);
    await sessions.currentVersion(userId);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
