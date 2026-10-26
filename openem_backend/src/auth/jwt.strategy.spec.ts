import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { SessionsService } from './sessions.service';

/** `currentVersion` devolve null quando a conta não existe mais. */
function makeStrategy(version: number | null) {
  const config = new ConfigService({
    JWT_SECRET: 'segredo-de-teste-com-comprimento-suficiente',
  });
  const sessions = { currentVersion: jest.fn().mockResolvedValue(version) };
  return {
    strategy: new JwtStrategy(config, sessions as unknown as SessionsService),
    sessions,
  };
}

describe('JwtStrategy', () => {
  it('devolve o aluno do token quando a conta existe e a sessão vale', async () => {
    const { strategy, sessions } = makeStrategy(2);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', ver: 2 }),
    ).resolves.toEqual({ userId: 'u1', email: 'a@b.com' });
    expect(sessions.currentVersion).toHaveBeenCalledWith('u1');
  });

  it('token de conta excluída é 401', async () => {
    const { strategy } = makeStrategy(null);
    await expect(
      strategy.validate({ sub: 'apagado', email: 'a@b.com', ver: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token de antes da troca de senha (versão antiga) é 401', async () => {
    const { strategy } = makeStrategy(3);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com', ver: 2 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token sem versão, de antes do campo existir, vale como versão 0', async () => {
    const { strategy } = makeStrategy(0);
    await expect(
      strategy.validate({ sub: 'u1', email: 'a@b.com' }),
    ).resolves.toEqual({ userId: 'u1', email: 'a@b.com' });
  });
});
