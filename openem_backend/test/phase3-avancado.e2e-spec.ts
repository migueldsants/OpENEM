import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SEED_QUESTIONS_URL } from './seed-questions';

describe('Fase 3 — avançado (desafio, recomendação, comunidade) (e2e)', () => {
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

  it('expõe o desafio diário com meta, progresso e recompensa', async () => {
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

  it('não resgata o desafio diário quando incompleto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/gamification/daily-challenge/claim')
      .set(auth())
      .expect(201);
    expect(res.body.claimed).toBe(false);
    expect(res.body.xpAwarded).toBe(0);
  });

  it('o resgate entra no histórico de XP, que fecha com o XP total', async () => {
    const challenge = await request(app.getHttpServer())
      .get('/api/v1/gamification/daily-challenge')
      .set(auth())
      .expect(200);
    const list = await request(app.getHttpServer())
      .get(`${SEED_QUESTIONS_URL}&limit=1`)
      .set(auth())
      .expect(200);
    const question = await request(app.getHttpServer())
      .get(`/api/v1/questions/${list.body.items[0].id}`)
      .set(auth())
      .expect(200);
    for (let i = challenge.body.progress; i < challenge.body.goal; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/answers')
        .set(auth())
        .send({
          questionId: question.body.id,
          chosenId: question.body.alternatives[0].id,
        })
        .expect(201);
    }

    const claim = await request(app.getHttpServer())
      .post('/api/v1/gamification/daily-challenge/claim')
      .set(auth())
      .expect(201);
    expect(claim.body.claimed).toBe(true);
    expect(claim.body.xpAwarded).toBe(challenge.body.xpReward);

    const again = await request(app.getHttpServer())
      .post('/api/v1/gamification/daily-challenge/claim')
      .set(auth())
      .expect(201);
    expect(again.body).toMatchObject({ xpAwarded: 0, reason: 'ja_resgatado' });

    const [history, me] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/v1/gamification/history?days=7')
        .set(auth())
        .expect(200),
      request(app.getHttpServer())
        .get('/api/v1/gamification/me')
        .set(auth())
        .expect(200),
    ]);
    const daily = history.body.logs.filter(
      (l: { action: string }) => l.action === 'DAILY_CHALLENGE',
    );
    expect(daily).toHaveLength(1);
    expect(daily[0].xpGained).toBe(challenge.body.xpReward);
    // Aluno novo: todo o XP dele cabe na janela, então as barras somam o total.
    const sum = history.body.byDay.reduce(
      (s: number, d: { xp: number }) => s + d.xp,
      0,
    );
    expect(sum).toBe(me.body.xp);
  });

  it('recomenda questões sem revelar o gabarito', async () => {
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

  it('cria um tópico no fórum, lista, detalha e responde', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/community/threads')
      .set(auth())
      .send({ title: 'Dúvida sobre funções', body: 'Como resolver isto?' })
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
    expect(reply.body.body).toBe('Tente fatorar primeiro.');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/community/threads/${threadId}`)
      .set(auth())
      .expect(200);
    expect(detail.body.replies).toBe(1);
    expect(detail.body.posts.map((p: { id: string }) => p.id)).toEqual([
      reply.body.id,
    ]);
    expect(detail.body.nextCursor).toBeNull();
  });

  it('indica disponibilidade da correção por IA', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/essays/ai-available')
      .set(auth())
      .expect(200);
    expect(typeof res.body.available).toBe('boolean');
  });
});
