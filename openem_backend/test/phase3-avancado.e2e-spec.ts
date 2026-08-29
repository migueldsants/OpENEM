import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fase 3 â€” avanÃ§ado (desafio, recomendaÃ§Ã£o, comunidade) (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Hooks de shutdown: limpa os timers do ThrottlerStorage no close().
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

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `p3adv_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('expÃµe o desafio diÃ¡rio com meta, progresso e recompensa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gamification/daily-challenge')
      .set(auth())
      .expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.goal).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('progress');
    expect(res.body).toHaveProperty('xpReward');
    expect(res.body.completed).toBe(false);
  });

  it('nÃ£o resgata o desafio diÃ¡rio quando incompleto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/gamification/daily-challenge/claim')
      .set(auth())
      .expect(201);
    expect(res.body.claimed).toBe(false);
    expect(res.body.xpAwarded).toBe(0);
  });

  it('recomenda questÃµes sem revelar o gabarito', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/recommendation/next?limit=3')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('reason');
    expect(res.body[0].question.alternatives[0]).not.toHaveProperty(
      'isCorrect',
    );
  });

  it('cria um tÃ³pico no fÃ³rum, lista, detalha e responde', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/community/threads')
      .set(auth())
      .send({ title: 'DÃºvida sobre funÃ§Ãµes', body: 'Como resolver isto?' })
      .expect(201);
    expect(created.body).toHaveProperty('id');
    expect(created.body.author).toHaveProperty('name');
    const threadId = created.body.id;

    const list = await request(app.getHttpServer())
      .get('/api/v1/community/threads')
      .set(auth())
      .expect(200);
    expect(list.body.some((t: { id: string }) => t.id === threadId)).toBe(true);

    const reply = await request(app.getHttpServer())
      .post(`/api/v1/community/threads/${threadId}/posts`)
      .set(auth())
      .send({ body: 'Tente fatorar primeiro.' })
      .expect(201);
    expect(reply.body.posts.length).toBe(1);
    expect(reply.body.posts[0].body).toBe('Tente fatorar primeiro.');
  });

  it('indica disponibilidade da correÃ§Ã£o por IA', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/essays/ai-available')
      .set(auth())
      .expect(200);
    expect(typeof res.body.available).toBe('boolean');
  });
});
