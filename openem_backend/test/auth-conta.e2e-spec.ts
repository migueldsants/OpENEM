import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GOOGLE_FETCH } from './../src/auth/auth.tokens';
import { PasswordResetService } from './../src/auth/password-reset.service';
import { fakeGoogle, type FakeGoogle } from './../src/auth/testing';
import { MAIL_TRANSPORT } from './../src/mail/mail.service';

/**
 * Recuperação de senha, troca de senha, revogação de sessão e login com
 * Google (e2e). Duas instâncias: uma com SMTP e Google ligados (transporte de
 * e-mail e Google falsos) e outra sem nenhum dos dois.
 */

const CLIENT_ID = 'cliente-e2e.apps.googleusercontent.com';
const APP = 'http://localhost:5173';

interface Enviado {
  to: string;
  subject: string;
  text: string;
}

async function criarApp(
  env: Record<string, string | undefined>,
  overrides: (
    b: ReturnType<typeof Test.createTestingModule>,
  ) => void = () => {},
): Promise<INestApplication<App>> {
  const antes: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    antes[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    const builder = Test.createTestingModule({ imports: [AppModule] });
    overrides(builder);
    const app = (await builder.compile()).createNestApplication<
      INestApplication<App>
    >();
    app.enableShutdownHooks();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: '', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
      ],
    });
    await app.init();
    return app;
  } finally {
    for (const [k, v] of Object.entries(antes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('Conta: senha, sessões e Google (e2e)', () => {
  let app: INestApplication<App>;
  let semExtras: INestApplication<App>;
  let google: FakeGoogle;
  const enviados: Enviado[] = [];
  const sufixo = Date.now();

  beforeAll(async () => {
    // A instância sem extras nasce primeiro: o passport guarda a JwtStrategy
    // da última instância criada (registro global), e as rotas com login
    // deste teste são as da instância com SMTP e Google.
    semExtras = await criarApp({
      SMTP_URL: undefined,
      MAIL_FROM: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    google = fakeGoogle();
    app = await criarApp(
      {
        SMTP_URL: 'smtp://localhost:2525',
        MAIL_FROM: 'OpENEM <nao-responda@exemplo.com>',
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: 'segredo-do-cliente',
        SITE_URL: undefined,
      },
      (b) => {
        b.overrideProvider(MAIL_TRANSPORT).useValue({
          sendMail: (m: Enviado) => {
            enviados.push(m);
            return Promise.resolve({});
          },
        });
        b.overrideProvider(GOOGLE_FETCH).useValue(google.fetch);
      },
    );
  });

  afterAll(async () => {
    await app.close();
    await semExtras.close();
  });

  const http = () => request(app.getHttpServer());

  async function cadastrar(email: string, password: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password, acceptTerms: true })
      .expect(201);
    return res.body.accessToken as string;
  }

  async function entrar(email: string, password: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  const me = (token: string) =>
    http().get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);

  /** Pede o link e devolve o token do e-mail que chegou. */
  async function tokenDoLink(email: string): Promise<string> {
    const antes = enviados.length;
    await http()
      .post('/api/v1/auth/forgot-password')
      .send({ email })
      .expect(202);
    await app.get(PasswordResetService).idle();
    expect(enviados).toHaveLength(antes + 1);
    const m = /#token=([A-Za-z0-9_-]+)/.exec(enviados[antes].text);
    return m![1];
  }

  describe('GET /auth/options', () => {
    it('diz o que está ligado em cada servidor', async () => {
      await http()
        .get('/api/v1/auth/options')
        .expect(200, { passwordReset: true, google: true });
      await request(semExtras.getHttpServer())
        .get('/api/v1/auth/options')
        .expect(200, { passwordReset: false, google: false });
    });
  });

  describe('PUT /users/me/password', () => {
    const email = `troca_${sufixo}@exemplo.com`;
    let token: string;

    beforeAll(async () => {
      token = await cadastrar(email, 'senha-antiga-1');
    });

    it('/users/me diz que a conta tem senha', async () => {
      const res = await me(token).expect(200);
      expect(res.body).toMatchObject({
        hasPassword: true,
        googleLinked: false,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('senha atual errada: 400, e a sessão continua', async () => {
      await http()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'errada', newPassword: 'senha-nova-123' })
        .expect(400);
      await me(token).expect(200);
    });

    it('senha nova curta: 400', async () => {
      await http()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'senha-antiga-1', newPassword: 'curta' })
        .expect(400);
    });

    it('sem login: 401', async () => {
      await http()
        .put('/api/v1/users/me/password')
        .send({ currentPassword: 'a', newPassword: 'senha-nova-123' })
        .expect(401);
    });

    it('troca: o token antigo cai, o novo vale e só a senha nova entra', async () => {
      const outroAparelho = await entrar(email, 'senha-antiga-1');
      const res = await http()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'senha-antiga-1',
          newPassword: 'senha-nova-123',
        })
        .expect(200);
      expect(res.body.user.email).toBe(email);

      await me(token).expect(401);
      await me(outroAparelho).expect(401);
      await me(res.body.accessToken as string).expect(200);
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'senha-antiga-1' })
        .expect(401);
      await entrar(email, 'senha-nova-123');
    });
  });

  describe('POST /auth/logout-all', () => {
    it('derruba todos os tokens da conta, inclusive o de quem pediu', async () => {
      const email = `sair_${sufixo}@exemplo.com`;
      const a = await cadastrar(email, 'senha-forte-1');
      const b = await entrar(email, 'senha-forte-1');
      await http()
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${a}`)
        .expect(204);
      await me(a).expect(401);
      await me(b).expect(401);
      // Entrar de novo funciona.
      await me(await entrar(email, 'senha-forte-1')).expect(200);
    });

    it('sem login: 401', async () => {
      await http().post('/api/v1/auth/logout-all').expect(401);
    });
  });

  describe('Esqueci minha senha', () => {
    const email = `esqueci_${sufixo}@exemplo.com`;
    let antigo: string;

    beforeAll(async () => {
      antigo = await cadastrar(email, 'senha-esquecida-1');
    });

    it('sem SMTP: 503', async () => {
      await request(semExtras.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(503);
    });

    it('a resposta é a mesma com e sem conta', async () => {
      const antes = enviados.length;
      const sem = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: `ninguem_${sufixo}@exemplo.com` })
        .expect(202);
      await app.get(PasswordResetService).idle();
      expect(enviados).toHaveLength(antes);
      expect(sem.body.message).toMatch(/Se houver uma conta/);

      const com = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(202);
      expect(com.body).toEqual(sem.body);
      await app.get(PasswordResetService).idle();
      expect(enviados).toHaveLength(antes + 1);
      expect(enviados[antes].to).toBe(email);
      expect(enviados[antes].text).toContain(
        `${APP}/app/redefinir-senha#token=`,
      );
    });

    it('e-mail inválido: 400', async () => {
      await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nao-e-email' })
        .expect(400);
    });

    it('o link cria a senha nova, encerra as sessões e vale uma vez', async () => {
      const token = await tokenDoLink(email);
      const res = await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'senha-recuperada-1' })
        .expect(200);
      await me(res.body.accessToken as string).expect(200);
      await me(antigo).expect(401);
      await entrar(email, 'senha-recuperada-1');
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'outra-senha-22' })
        .expect(400);
    });

    it('token inventado ou senha curta: 400', async () => {
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token: 'x'.repeat(43), password: 'senha-nova-123' })
        .expect(400);
      await http()
        .post('/api/v1/auth/reset-password')
        .send({ token: 'x'.repeat(43), password: 'curta' })
        .expect(400);
    });

    it('o quarto pedido em uma hora para o mesmo e-mail é 429 com Retry-After', async () => {
      const alvo = `limite_${sufixo}@exemplo.com`;
      for (let i = 0; i < 3; i++) {
        await http()
          .post('/api/v1/auth/forgot-password')
          .send({ email: alvo })
          .expect(202);
      }
      const res = await http()
        .post('/api/v1/auth/forgot-password')
        .send({ email: alvo })
        .expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(3000);
    });
  });

  describe('Login com Google', () => {
    /** Ida ao Google: cookie da volta e o state; o falso devolve estas claims. */
    async function ida(claims: Record<string, unknown>) {
      const res = await http().get('/api/v1/auth/google').expect(302);
      const destino = new URL(res.headers.location);
      expect(destino.host).toBe('accounts.google.com');
      const p = destino.searchParams;
      google.expectedChallenge = p.get('code_challenge');
      const agora = Math.floor(Date.now() / 1000);
      google.nextClaims = {
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        email_verified: true,
        nonce: p.get('nonce'),
        iat: agora,
        exp: agora + 3600,
        ...claims,
      };
      const setCookie = ([] as string[]).concat(
        res.headers['set-cookie'] ?? [],
      );
      const cookie = setCookie.find((c) => c.startsWith('openem_google='))!;
      return { state: p.get('state')!, cookie, setCookie: cookie };
    }

    async function volta(
      state: string,
      cookie: string | null,
    ): Promise<{ code?: string; erro?: string; setCookie: string[] }> {
      const req = http().get('/api/v1/auth/google/callback').query({
        code: 'codigo-do-google',
        state,
        scope: 'openid email',
        authuser: '0',
      });
      if (cookie) req.set('Cookie', cookie.split(';')[0]);
      const res = await req.expect(302);
      const url = new URL(res.headers.location);
      expect(`${url.origin}${url.pathname}`).toBe(`${APP}/app/entrar/google`);
      return {
        ...Object.fromEntries(new URLSearchParams(url.hash.slice(1))),
        setCookie: ([] as string[]).concat(res.headers['set-cookie'] ?? []),
      };
    }

    it('desligado: 404', async () => {
      await request(semExtras.getHttpServer())
        .get('/api/v1/auth/google')
        .expect(404);
    });

    it('a ida manda ao Google com PKCE e um cookie HttpOnly só das rotas do Google', async () => {
      const { setCookie } = await ida({ sub: 'x', email: 'x@gmail.com' });
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\/api\/v1\/auth\/google/);
    });

    it('conta nova: entra sem senha, e o código vale uma vez', async () => {
      const email = `google_${sufixo}@gmail.com`;
      const { state, cookie } = await ida({ sub: `sub-${sufixo}`, email });
      const r = await volta(state, cookie);
      expect(r.code).toBeDefined();
      // O cookie da ida é apagado na volta.
      expect(r.setCookie.join()).toMatch(/openem_google=;/);

      const res = await http()
        .post('/api/v1/auth/google/exchange')
        .send({ code: r.code })
        .expect(200);
      expect(res.body.passwordDisabled).toBe(false);
      const perfil = await me(res.body.accessToken as string).expect(200);
      expect(perfil.body).toMatchObject({
        email,
        hasPassword: false,
        googleLinked: true,
      });

      await http()
        .post('/api/v1/auth/google/exchange')
        .send({ code: r.code })
        .expect(400);
      // Sem senha, login por senha não entra (e não diz por quê).
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'qualquer-coisa' })
        .expect(401);
      await http()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .send({ currentPassword: 'x', newPassword: 'senha-nova-123' })
        .expect(400);

      // O "Esqueci minha senha" cria a primeira senha da conta.
      const token = await tokenDoLink(email);
      const criada = await http()
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'primeira-senha-1' })
        .expect(200);
      const depois = await me(criada.body.accessToken as string).expect(200);
      expect(depois.body).toMatchObject({
        hasPassword: true,
        googleLinked: true,
      });
      await entrar(email, 'primeira-senha-1');
    });

    it('volta sem o cookie da ida: erro de sessão', async () => {
      const { state } = await ida({ sub: 'y', email: 'y@gmail.com' });
      expect((await volta(state, null)).erro).toBe('sessao');
    });

    it('e-mail não confirmado pelo Google: recusado', async () => {
      const { state, cookie } = await ida({
        sub: `naoconf-${sufixo}`,
        email: `naoconf_${sufixo}@gmail.com`,
        email_verified: false,
      });
      expect((await volta(state, cookie)).erro).toBe('email');
    });

    it('vincula a conta de senha do mesmo e-mail; senha nunca confirmada sai', async () => {
      const email = `vinculo_${sufixo}@gmail.com`;
      const antigo = await cadastrar(email, 'senha-sem-confirmar-1');
      const { state, cookie } = await ida({
        sub: `vinculo-${sufixo}`,
        // O Google manda o e-mail em minúsculas; a busca acha a conta igual.
        email: email.toUpperCase().replace('@GMAIL.COM', '@gmail.com'),
      });
      const r = await volta(state, cookie);
      const res = await http()
        .post('/api/v1/auth/google/exchange')
        .send({ code: r.code })
        .expect(200);
      expect(res.body.passwordDisabled).toBe(true);
      expect(res.body.user.email).toBe(email);
      await me(antigo).expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'senha-sem-confirmar-1' })
        .expect(401);
    });

    it('código inválido no exchange: 400', async () => {
      await http()
        .post('/api/v1/auth/google/exchange')
        .send({ code: 'c'.repeat(43) })
        .expect(400);
      await http()
        .post('/api/v1/auth/google/exchange')
        .send({ code: 'curto' })
        .expect(400);
    });
  });
});
