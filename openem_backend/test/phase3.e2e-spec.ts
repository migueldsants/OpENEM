import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fase 3 — gamificação (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
        email: `p3_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function correctAlternativeId(questionId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/questions/${questionId}`)
      .set(auth())
      .expect(200);
    const correct = res.body.alternatives.find(
      (a: { id: string; isCorrect: boolean }) => a.isCorrect,
    );
    return correct.id;
  }

  it('responder uma questão dá pontos, sequência e a conquista inicial', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=1')
      .set(auth())
      .expect(200);
    const questionId = list.body.items[0].id;
    const chosenId = await correctAlternativeId(questionId);

    const ans = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId, chosenId })
      .expect(201);

    expect(ans.body.gamification).toBeDefined();
    expect(ans.body.gamification.pointsGained).toBeGreaterThan(0);
    expect(ans.body.gamification.currentStreak).toBe(1);
    expect(
      ans.body.gamification.newAchievements.map(
        (a: { code: string }) => a.code,
      ),
    ).toContain('FIRST_ANSWER');
  });

  it('GET /gamification/me reflete o estado acumulado', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/gamification/me')
      .set(auth())
      .expect(200);
    expect(me.body.enabled).toBe(true);
    expect(me.body.points).toBeGreaterThan(0);
    expect(me.body.currentStreak).toBe(1);
    expect(me.body.answersCount).toBeGreaterThanOrEqual(1);
    expect(me.body.achievementsTotal).toBeGreaterThan(0);
  });

  it('GET /gamification/achievements lista o catálogo com status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gamification/achievements')
      .set(auth())
      .expect(200);
    const first = res.body.find(
      (a: { code: string }) => a.code === 'FIRST_ANSWER',
    );
    expect(first.unlocked).toBe(true);
    expect(first.unlockedAt).not.toBeNull();
    expect(res.body.some((a: { unlocked: boolean }) => !a.unlocked)).toBe(true);
  });

  it('o toggle gamificationEnabled silencia a gamificação', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set(auth())
      .send({ gamificationEnabled: false })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=1')
      .set(auth())
      .expect(200);
    const questionId = list.body.items[0].id;
    const chosenId = await correctAlternativeId(questionId);

    const ans = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId, chosenId })
      .expect(201);
    expect(ans.body.gamification).toBeUndefined();

    const me = await request(app.getHttpServer())
      .get('/api/v1/gamification/me')
      .set(auth())
      .expect(200);
    expect(me.body.enabled).toBe(false);
  });
});
