import { RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { SEED_QUESTIONS_URL } from './seed-questions';

/**
 * Rate limiting distribuído (issue #87). As apps de teste só dividem os
 * contadores quando recebem o mesmo THROTTLE_KEY_PREFIX; sem isso, cada uma
 * tem os seus (ver rateKeyPrefix).
 */

async function criarApp(
  env: Record<string, string> = {},
): Promise<NestExpressApplication> {
  const antes = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, env);
  try {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.enableShutdownHooks();
    // Como o nginx: um proxy confiável, para o teste escolher o IP.
    app.set('trust proxy', 1);
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

async function registrar(
  app: NestExpressApplication,
  prefixo: string,
  ip = '198.51.100.1',
): Promise<{ email: string; token: string }> {
  const email = `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@exemplo.com`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .set('X-Forwarded-For', ip)
    .send({ email, password: 'senhaForte123' })
    .expect(201);
  return { email, token: res.body.accessToken as string };
}

async function umaQuestao(app: NestExpressApplication, token: string) {
  const res = await request(app.getHttpServer())
    .get(SEED_QUESTIONS_URL)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.items[0].id as string;
}

/** Comentário da questão: 10 pedidos por minuto, por aluno. */
function pedirComentario(
  app: NestExpressApplication,
  token: string,
  questionId: string,
  ip = '198.51.100.1',
) {
  return request(app.getHttpServer())
    .post(`/api/v1/questions/${questionId}/explanation`)
    .set('Authorization', `Bearer ${token}`)
    .set('X-Forwarded-For', ip);
}

describe('Rate limiting (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await criarApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('o 429 vem em português, com Retry-After', async () => {
    const { token } = await registrar(app, 'rl_429');
    const q = await umaQuestao(app, token);
    for (let i = 0; i < 10; i++) {
      await pedirComentario(app, token, q).expect(200);
    }
    const res = await pedirComentario(app, token, q).expect(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(res.body.message).toMatch(/^Muitas tentativas\. Tente de novo em/);
  });

  it('dois alunos atrás do mesmo IP não bloqueiam um ao outro', async () => {
    const mesmoIp = '203.0.113.50';
    const a = await registrar(app, 'rl_nat_a', mesmoIp);
    const b = await registrar(app, 'rl_nat_b', mesmoIp);
    const q = await umaQuestao(app, a.token);
    for (let i = 0; i < 10; i++) {
      await pedirComentario(app, a.token, q, mesmoIp).expect(200);
    }
    await pedirComentario(app, a.token, q, mesmoIp).expect(429);
    // B, na mesma rede, tem o próprio limite.
    await pedirComentario(app, b.token, q, mesmoIp).expect(200);
  });

  it('senhas erradas de IPs diferentes bloqueiam a conta; outra conta no mesmo IP entra', async () => {
    const alvo = await registrar(app, 'rl_alvo');
    const outra = await registrar(app, 'rl_outra');
    const login = (email: string, password: string, ip: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email, password });

    for (let i = 1; i <= 4; i++) {
      await login(alvo.email, 'senhaErrada99', `192.0.2.${i}`).expect(401);
    }
    // A quinta falha bloqueia, venha de onde vier.
    const bloqueio = await login(alvo.email, 'senhaErrada99', '192.0.2.5');
    expect(bloqueio.status).toBe(429);
    expect(Number(bloqueio.headers['retry-after'])).toBe(15 * 60);
    expect(bloqueio.body.message).toContain('15 min');
    // Nem a senha certa passa enquanto dura o bloqueio...
    await login(alvo.email, 'senhaForte123', '192.0.2.6').expect(429);
    // ...mas a outra conta, no mesmo IP do atacante, entra.
    await login(outra.email, 'senhaForte123', '192.0.2.5').expect(200);
  });

  it('e-mail sem conta bloqueia do mesmo jeito', async () => {
    const email = `rl_fantasma_${Date.now()}@exemplo.com`;
    for (let i = 1; i <= 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `192.0.2.${20 + i}`)
        .send({ email, password: 'qualquer1' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '192.0.2.30')
      .send({ email, password: 'qualquer1' })
      .expect(429);
  });
});

const comRedis = !!process.env.REDIS_URL?.trim();

(comRedis ? describe : describe.skip)(
  'Rate limiting com duas instâncias no mesmo Redis (e2e)',
  () => {
    let a: NestExpressApplication;
    let b: NestExpressApplication;

    beforeAll(async () => {
      // O mesmo prefixo: as duas instâncias dividem os contadores, como em
      // produção.
      const env = { THROTTLE_KEY_PREFIX: `e2e-duas-${Date.now()}` };
      a = await criarApp(env);
      b = await criarApp(env);
    });

    afterAll(async () => {
      await a.close();
      await b.close();
    });

    it('o limite é contado uma vez só', async () => {
      const { token } = await registrar(a, 'rl_duas');
      const q = await umaQuestao(a, token);
      // 10 por minuto no total, metade em cada instância.
      for (let i = 0; i < 5; i++) {
        await pedirComentario(a, token, q).expect(200);
        await pedirComentario(b, token, q).expect(200);
      }
      await pedirComentario(a, token, q).expect(429);
      await pedirComentario(b, token, q).expect(429);
    });
  },
);
