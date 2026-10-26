import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { memoryCache } from '../cache/testing';
import { authFeatures } from '../common/auth-config';
import type { PrismaService } from '../prisma/prisma.service';
import { fakeAuthPrisma } from './fake-auth-prisma';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOidcClient } from './google-oidc.client';
import { SessionsService } from './sessions.service';
import { fakeGoogle } from './testing';

const secret = 'segredo-de-teste-comprido';
const clientId = 'cliente.apps.googleusercontent.com';

function montar(env: Record<string, string> = {}) {
  const prisma = fakeAuthPrisma();
  const google = fakeGoogle();
  const jwt = new JwtService({ secret });
  const sessions = new SessionsService(
    prisma as unknown as PrismaService,
    jwt,
    memoryCache(),
  );
  const service = new GoogleAuthService(
    prisma as unknown as PrismaService,
    new GoogleOidcClient(google.fetch),
    sessions,
    authFeatures({
      SITE_URL: 'https://o.ex',
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: 'segredo-do-cliente',
      ...env,
    }),
    new ConfigService({ JWT_SECRET: secret }),
  );
  return { prisma, google, jwt, service };
}

type Ctx = ReturnType<typeof montar>;

/** Ida ao Google; o falso devolve estas claims (com o nonce certo) na troca. */
function ida(ctx: Ctx, claims: Record<string, unknown> = {}) {
  const { url, cookie } = ctx.service.start();
  const p = new URL(url).searchParams;
  ctx.google.expectedChallenge = p.get('code_challenge');
  const agora = Math.floor(Date.now() / 1000);
  ctx.google.nextClaims = {
    iss: 'https://accounts.google.com',
    aud: clientId,
    sub: 'google-123',
    email: 'aluna@gmail.com',
    email_verified: true,
    nonce: p.get('nonce'),
    iat: agora,
    exp: agora + 3600,
    ...claims,
  };
  return { state: p.get('state')!, cookie };
}

/** Fragmento da volta ao app: `{ code }` ou `{ erro }`. */
function fragmento(destino: string): Record<string, string> {
  const url = new URL(destino);
  expect(`${url.origin}${url.pathname}`).toBe('https://o.ex/app/entrar/google');
  return Object.fromEntries(new URLSearchParams(url.hash.slice(1)));
}

async function entrar(ctx: Ctx, claims: Record<string, unknown> = {}) {
  const { state, cookie } = ida(ctx, claims);
  return fragmento(
    await ctx.service.callback({ code: 'codigo-do-google', state }, cookie),
  );
}

describe('GoogleAuthService', () => {
  it('desligado sem as variáveis: 404 na ida e na volta', async () => {
    const ctx = montar({ GOOGLE_CLIENT_SECRET: '' });
    expect(ctx.service.enabled).toBe(false);
    expect(() => ctx.service.start()).toThrow(NotFoundException);
    await expect(ctx.service.callback({}, null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a ida monta o endereço do Google e um cookie seguro em https', () => {
    const ctx = montar();
    expect(ctx.service.enabled).toBe(true);
    const a = ctx.service.start();
    const b = ctx.service.start();
    expect(a.secure).toBe(true);
    const p = new URL(a.url).searchParams;
    expect(p.get('redirect_uri')).toBe(
      'https://o.ex/api/v1/auth/google/callback',
    );
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(new URL(b.url).searchParams.get('state')).not.toBe(p.get('state'));
    expect(a.cookie).not.toContain(p.get('state'));
    expect(
      montar({ SITE_URL: 'http://escola.local' }).service.start().secure,
    ).toBe(false);
  });

  it('conta nova: cria sem senha, com o e-mail confirmado, e o código vira login', async () => {
    const ctx = montar();
    const volta = await entrar(ctx, { email: 'Aluna@Gmail.com' });
    expect(volta.code).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // A troca mandou o segredo do PKCE e o do cliente.
    const pedido = ctx.google.tokenRequests[0];
    expect(pedido.get('code')).toBe('codigo-do-google');
    expect(pedido.get('client_secret')).toBe('segredo-do-cliente');

    const [user] = ctx.prisma.tabelas.user;
    expect(user).toMatchObject({
      email: 'aluna@gmail.com',
      passwordHash: null,
      googleSub: 'google-123',
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    // O banco guarda o hash do código, não o código.
    expect(JSON.stringify(ctx.prisma.tabelas.loginCode)).not.toContain(
      volta.code,
    );

    const res = await ctx.service.exchange(volta.code);
    expect(res.passwordDisabled).toBe(false);
    expect(res.user).toEqual({ id: user.id, email: 'aluna@gmail.com' });
    expect(ctx.jwt.decode(res.accessToken)).toMatchObject({
      sub: user.id,
      ver: 0,
    });
  });

  it('o código vale uma vez e por pouco tempo', async () => {
    const ctx = montar();
    const { code } = await entrar(ctx);
    await ctx.service.exchange(code);
    await expect(ctx.service.exchange(code)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const outro = (await entrar(ctx)).code;
    const agora = Date.now();
    ctx.service.now = () => agora + 3 * 60_000;
    await expect(ctx.service.exchange(outro)).rejects.toThrow(/expirou/);
    await expect(
      ctx.service.exchange('codigo-inventado-com-tamanho-ok'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('segundo login acha a conta pelo sub, mesmo com o e-mail trocado no Google', async () => {
    const ctx = montar();
    await entrar(ctx);
    const volta = await entrar(ctx, { email: 'outro@gmail.com' });
    expect(volta.code).toBeDefined();
    expect(ctx.prisma.tabelas.user).toHaveLength(1);
  });

  it('vincula a conta de e-mail confirmado sem mexer na senha', async () => {
    const ctx = montar();
    await ctx.prisma.user.create({
      data: {
        email: 'aluna@gmail.com',
        passwordHash: 'hash',
        emailVerifiedAt: new Date('2026-01-01'),
      },
    });
    const { code } = await entrar(ctx);
    expect(ctx.prisma.tabelas.user[0]).toMatchObject({
      passwordHash: 'hash',
      googleSub: 'google-123',
      tokenVersion: 0,
    });
    expect((await ctx.service.exchange(code)).passwordDisabled).toBe(false);
  });

  it('conta com senha e e-mail nunca confirmado: a senha sai e as sessões caem', async () => {
    const ctx = montar();
    // Alguém cadastrou o e-mail da aluna antes dela (sem confirmar nada).
    await ctx.prisma.user.create({
      data: { email: 'Aluna@gmail.com', passwordHash: 'senha-do-intruso' },
    });
    const { code } = await entrar(ctx);
    const [user] = ctx.prisma.tabelas.user;
    expect(user).toMatchObject({
      passwordHash: null,
      googleSub: 'google-123',
      tokenVersion: 1,
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    const res = await ctx.service.exchange(code);
    expect(res.passwordDisabled).toBe(true);
    expect(ctx.jwt.decode(res.accessToken)).toMatchObject({ ver: 1 });
  });

  it('e-mail já ligado a outra conta Google ou a duas contas daqui: conta', async () => {
    const ctx = montar();
    await ctx.prisma.user.create({
      data: { email: 'aluna@gmail.com', googleSub: 'outra-conta-google' },
    });
    expect(await entrar(ctx)).toEqual({ erro: 'conta' });

    const dupla = montar();
    await dupla.prisma.user.create({ data: { email: 'Aluna@gmail.com' } });
    await dupla.prisma.user.create({ data: { email: 'ALUNA@gmail.com' } });
    expect(await entrar(dupla)).toEqual({ erro: 'conta' });
  });

  it('e-mail não confirmado pelo Google não entra nem cria conta', async () => {
    const ctx = montar();
    expect(await entrar(ctx, { email_verified: false })).toEqual({
      erro: 'email',
    });
    expect(ctx.prisma.tabelas.user).toHaveLength(0);
  });

  it('volta sem o cookie, com state trocado ou vencida: sessão', async () => {
    const ctx = montar();
    const { state, cookie } = ida(ctx);
    const sem = await ctx.service.callback({ code: 'c', state }, null);
    expect(fragmento(sem)).toEqual({ erro: 'sessao' });
    const trocado = await ctx.service.callback(
      { code: 'c', state: 'outro' },
      cookie,
    );
    expect(fragmento(trocado)).toEqual({ erro: 'sessao' });
    const semState = await ctx.service.callback({ code: 'c' }, cookie);
    expect(fragmento(semState)).toEqual({ erro: 'sessao' });
    const agora = Date.now();
    ctx.service.now = () => agora + 11 * 60_000;
    const vencida = await ctx.service.callback({ code: 'c', state }, cookie);
    expect(fragmento(vencida)).toEqual({ erro: 'sessao' });
    // Nada disso chegou a trocar código no Google.
    expect(ctx.google.tokenRequests).toHaveLength(0);
  });

  it('o aluno desistiu na tela do Google: cancelado; outro erro: falha', async () => {
    const ctx = montar();
    const a = ida(ctx);
    expect(
      fragmento(
        await ctx.service.callback(
          { error: 'access_denied', state: a.state },
          a.cookie,
        ),
      ),
    ).toEqual({ erro: 'cancelado' });
    const b = ida(ctx);
    expect(
      fragmento(
        await ctx.service.callback(
          { error: 'server_error', state: b.state },
          b.cookie,
        ),
      ),
    ).toEqual({ erro: 'falha' });
    const c = ida(ctx);
    expect(
      fragmento(await ctx.service.callback({ state: c.state }, c.cookie)),
    ).toEqual({ erro: 'falha' });
  });

  it('troca recusada, nonce trocado ou token de outro cliente', async () => {
    const ctx = montar();
    const a = ida(ctx);
    ctx.google.nextClaims = null;
    expect(
      fragmento(
        await ctx.service.callback({ code: 'c', state: a.state }, a.cookie),
      ),
    ).toEqual({ erro: 'falha' });
    expect(await entrar(ctx, { nonce: 'outro' })).toEqual({ erro: 'sessao' });
    expect(await entrar(ctx, { aud: 'outro-cliente' })).toEqual({
      erro: 'falha',
    });
  });

  it('PKCE: a troca leva o verificador do cookie desta ida', async () => {
    const ctx = montar();
    const a = ida(ctx);
    // A volta chega com o cookie de outra ida (outro verificador e state).
    const b = ida(ctx);
    ctx.google.expectedChallenge = new URL(
      ctx.service.start().url,
    ).searchParams.get('code_challenge');
    expect(
      fragmento(
        await ctx.service.callback({ code: 'c', state: b.state }, b.cookie),
      ),
    ).toEqual({ erro: 'falha' });
    expect(a.state).not.toBe(b.state);
  });

  it('erro inesperado vira falha', async () => {
    const ctx = montar();
    jest
      .spyOn(ctx.prisma.user, 'findUnique')
      .mockRejectedValueOnce(new Error('banco fora do ar'));
    expect(await entrar(ctx)).toEqual({ erro: 'falha' });
  });

  it('duas voltas da mesma conta nova ao mesmo tempo: a segunda usa a criada', async () => {
    const ctx = montar();
    const criar = ctx.prisma.user.create.bind(ctx.prisma.user);
    jest.spyOn(ctx.prisma.user, 'create').mockImplementationOnce(async (a) => {
      // A outra volta cria a conta antes desta.
      await criar(a);
      return criar(a);
    });
    const volta = await entrar(ctx);
    expect(volta.code).toBeDefined();
    expect(ctx.prisma.tabelas.user).toHaveLength(1);
  });

  it('e-mail tomado por outra conta no meio da criação: conta', async () => {
    const ctx = montar();
    jest.spyOn(ctx.prisma.user, 'create').mockImplementationOnce(() => {
      throw Object.assign(new Error('Unique'), { code: 'P2002' });
    });
    expect(await entrar(ctx)).toEqual({ erro: 'conta' });
  });

  it('conta Google vinculada a outra conta no meio do vínculo: conta', async () => {
    const ctx = montar();
    await ctx.prisma.user.create({
      data: { email: 'aluna@gmail.com', emailVerifiedAt: new Date() },
    });
    jest.spyOn(ctx.prisma.user, 'update').mockImplementationOnce(() => {
      throw Object.assign(new Error('Unique'), { code: 'P2002' });
    });
    expect(await entrar(ctx)).toEqual({ erro: 'conta' });
  });
});
