import {
  BadRequestException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { MemoryCacheStore } from '../cache/cache-store';
import { memoryCache } from '../cache/testing';
import { authFeatures } from '../common/auth-config';
import { hashToken } from '../common/auth-tokens';
import { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  LoginAttemptsService,
  TooManyAttemptsException,
} from '../rate-limit/login-attempts.service';
import { fakeAuthPrisma } from './fake-auth-prisma';
import { PasswordResetService } from './password-reset.service';
import { SessionsService } from './sessions.service';

const features = authFeatures({
  SITE_URL: 'https://o.ex',
  SMTP_URL: 'smtp://localhost:2525',
  MAIL_FROM: 'OpENEM <nao-responda@o.ex>',
});

function montar(opts: { mail?: boolean } = {}) {
  const prisma = fakeAuthPrisma();
  const store = new MemoryCacheStore();
  const sendMail = jest.fn().mockResolvedValue({});
  const mail = new MailService(
    opts.mail === false ? null : { sendMail },
    'OpENEM <nao-responda@o.ex>',
  );
  const jwt = new JwtService({ secret: 'segredo-de-teste-comprido' });
  const sessions = new SessionsService(
    prisma as unknown as PrismaService,
    jwt,
    memoryCache(),
  );
  const attempts = new LoginAttemptsService(store, 'rl');
  const service = new PasswordResetService(
    prisma as unknown as PrismaService,
    mail,
    sessions,
    attempts,
    store,
    'rl',
    features,
  );
  return { prisma, sendMail, service, jwt, attempts };
}

/** Token do link do último e-mail mandado. */
function tokenDoEmail(sendMail: jest.Mock): string {
  const { text } = sendMail.mock.calls.at(-1)[0] as { text: string };
  const m = /#token=([A-Za-z0-9_-]+)/.exec(text);
  if (!m) throw new Error('e-mail sem link');
  return m[1];
}

describe('PasswordResetService', () => {
  it('desligado sem SMTP: 503', async () => {
    const { service } = montar({ mail: false });
    expect(service.enabled).toBe(false);
    await expect(service.request('a@b.com')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('desligado sem endereço público', () => {
    const { prisma, service } = montar();
    const semUrl = new PasswordResetService(
      prisma as unknown as PrismaService,
      (service as unknown as { mail: MailService }).mail,
      {} as SessionsService,
      {} as LoginAttemptsService,
      new MemoryCacheStore(),
      'rl',
      { ...features, publicUrl: null },
    );
    expect(semUrl.enabled).toBe(false);
  });

  it('manda o link para a conta e guarda só o hash do token', async () => {
    const { prisma, sendMail, service } = montar();
    const user = await prisma.user.create({ data: { email: 'Ana@b.com' } });
    await service.request('ana@b.com');
    await service.idle();

    expect(sendMail).toHaveBeenCalledTimes(1);
    const msg = sendMail.mock.calls[0][0] as { to: string; text: string };
    // Vai para o endereço gravado na conta, não para o digitado.
    expect(msg.to).toBe('Ana@b.com');
    expect(msg.text).toContain('https://o.ex/app/redefinir-senha#token=');
    const token = tokenDoEmail(sendMail);
    const [registro] = prisma.tabelas.passwordResetToken;
    expect(registro.userId).toBe(user.id);
    expect(registro.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(registro)).not.toContain(token);
    const validade = (registro.expiresAt as Date).getTime() - Date.now();
    expect(validade).toBeGreaterThan(29 * 60_000);
    expect(validade).toBeLessThanOrEqual(30 * 60_000);
  });

  it('e-mail sem conta: responde igual e não manda nada', async () => {
    const { prisma, sendMail, service } = montar();
    await expect(service.request('ninguem@b.com')).resolves.toBeUndefined();
    await service.idle();
    expect(sendMail).not.toHaveBeenCalled();
    expect(prisma.tabelas.passwordResetToken).toHaveLength(0);
  });

  it('e-mail ambíguo (duas contas em caixas diferentes): não manda', async () => {
    const { prisma, sendMail, service } = montar();
    await prisma.user.create({ data: { email: 'Ana@b.com' } });
    await prisma.user.create({ data: { email: 'ANA@b.com' } });
    await service.request('ana@b.com');
    await service.idle();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('falha do SMTP fica no log, sem derrubar o pedido', async () => {
    const { prisma, sendMail, service } = montar();
    await prisma.user.create({ data: { email: 'a@b.com' } });
    sendMail.mockRejectedValueOnce(new Error('conexão recusada'));
    await expect(service.request('a@b.com')).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('o quarto pedido em uma hora para o mesmo e-mail é 429, com ou sem conta', async () => {
    const { service } = montar();
    for (let i = 0; i < 3; i++) await service.request('x@y.com');
    const erro = await service.request('X@y.com ').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(TooManyAttemptsException);
    expect((erro as TooManyAttemptsException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect((erro as TooManyAttemptsException).retryAfterSec).toBeGreaterThan(
      3500,
    );
    // Outro e-mail tem o próprio limite.
    await expect(service.request('z@y.com')).resolves.toBeUndefined();
  });

  it('pedir de novo invalida o link anterior', async () => {
    const { prisma, sendMail, service } = montar();
    await prisma.user.create({ data: { email: 'a@b.com', passwordHash: 'h' } });
    await service.request('a@b.com');
    await service.idle();
    const primeiro = tokenDoEmail(sendMail);
    await service.request('a@b.com');
    await service.idle();
    expect(prisma.tabelas.passwordResetToken).toHaveLength(1);
    await expect(
      service.reset(primeiro, 'senha-nova-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reset(tokenDoEmail(sendMail), 'senha-nova-1'),
    ).resolves.toBeDefined();
  });

  it('redefine: senha nova, sessões encerradas, e-mail confirmado e login devolvido', async () => {
    const { prisma, sendMail, service, jwt } = montar();
    await prisma.user.create({
      data: { email: 'a@b.com', passwordHash: await argon2.hash('antiga-123') },
    });
    await service.request('a@b.com');
    await service.idle();

    const res = await service.reset(tokenDoEmail(sendMail), 'senha-nova-1');
    const user = prisma.tabelas.user[0];
    expect(
      await argon2.verify(user.passwordHash as string, 'senha-nova-1'),
    ).toBe(true);
    expect(user.tokenVersion).toBe(1);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(jwt.decode(res.accessToken)).toMatchObject({ sub: user.id, ver: 1 });
    expect(prisma.tabelas.passwordResetToken).toHaveLength(0);
  });

  it('o link vale uma vez só', async () => {
    const { prisma, sendMail, service } = montar();
    await prisma.user.create({ data: { email: 'a@b.com' } });
    await service.request('a@b.com');
    await service.idle();
    const token = tokenDoEmail(sendMail);
    await service.reset(token, 'senha-nova-1');
    await expect(service.reset(token, 'outra-senha-2')).rejects.toThrow(
      /expirou ou já foi usado/,
    );
  });

  it('link vencido (mais de 30 min) não vale', async () => {
    const { prisma, sendMail, service } = montar();
    await prisma.user.create({ data: { email: 'a@b.com' } });
    await service.request('a@b.com');
    await service.idle();
    const agora = Date.now();
    service.now = () => agora + 31 * 60_000;
    await expect(
      service.reset(tokenDoEmail(sendMail), 'senha-nova-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('token inventado não vale', async () => {
    const { service } = montar();
    await expect(
      service.reset('token-inventado-com-tamanho-suficiente', 'senha-nova-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a redefinição solta o bloqueio de senhas erradas da conta', async () => {
    const { prisma, sendMail, service, attempts } = montar();
    await prisma.user.create({ data: { email: 'a@b.com' } });
    for (let i = 0; i < 4; i++) await attempts.recordFailure('a@b.com');
    await expect(attempts.recordFailure('a@b.com')).rejects.toBeInstanceOf(
      TooManyAttemptsException,
    );
    await service.request('a@b.com');
    await service.idle();
    await service.reset(tokenDoEmail(sendMail), 'senha-nova-1');
    await expect(attempts.assertAllowed('a@b.com')).resolves.toBeUndefined();
  });

  it('mantém a data de confirmação que a conta já tinha', async () => {
    const { prisma, sendMail, service } = montar();
    const antes = new Date('2026-01-01T00:00:00Z');
    await prisma.user.create({
      data: { email: 'a@b.com', emailVerifiedAt: antes },
    });
    await service.request('a@b.com');
    await service.idle();
    await service.reset(tokenDoEmail(sendMail), 'senha-nova-1');
    expect(prisma.tabelas.user[0].emailVerifiedAt).toEqual(antes);
  });
});
