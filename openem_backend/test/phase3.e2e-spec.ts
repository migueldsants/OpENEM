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

describe('Fase 3 — gamificação (e2e)', () => {
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
        email: `p3_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
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

  it('responder uma questão dá XP (com bônus diário), nível e a conquista inicial', async () => {
    const list = await request(app.getHttpServer())
      .get(`${SEED_QUESTIONS_URL}&limit=1`)
      .set(auth())
      .expect(200);
    const questionId = list.body.items[0].id;
    const chosenId = await correctAlternativeId(questionId);

    const ans = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId, chosenId })
      .expect(201);

    const g = ans.body.gamification;
    expect(g).toBeDefined();
    expect(g.xpGained).toBeGreaterThan(0);
    // 1ª atividade do dia: XP = base × combo (1×) + bônus diário.
    expect(g.breakdown.base).toBe(10);
    expect(g.breakdown.comboMultiplier).toBe(1);
    expect(g.breakdown.dailyBonus).toBeGreaterThan(0);
    expect(g.xp).toBe(g.xpGained);
    expect(g.level).toBeGreaterThanOrEqual(1);
    expect(g.league.key).toBe('BRONZE');
    expect(g.currentStreak).toBe(1);
    expect(g.newAchievements.map((a: { code: string }) => a.code)).toContain(
      'FIRST_ANSWER',
    );
  });

  it('GET /gamification/me reflete XP, nível e liga acumulados', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/gamification/me')
      .set(auth())
      .expect(200);
    expect(me.body.enabled).toBe(true);
    expect(me.body.xp).toBeGreaterThan(0);
    expect(me.body.level).toBeGreaterThanOrEqual(1);
    expect(me.body.league.key).toBe('BRONZE');
    expect(me.body.progress.forNext).toBeGreaterThan(0);
    expect(me.body.progress.pct).toBeGreaterThanOrEqual(0);
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

    // As de redação (sem tela no app) saem do catálogo de quem não as tem, e o
    // total do resumo é o tamanho da lista.
    const codes = res.body.map((a: { code: string }) => a.code);
    expect(codes).not.toContain('FIRST_ESSAY');
    expect(codes).not.toContain('HIGH_SCORE_ESSAY');
    const me = await request(app.getHttpServer())
      .get('/api/v1/gamification/me')
      .set(auth())
      .expect(200);
    expect(me.body.achievementsTotal).toBe(res.body.length);
  });

  it('o toggle gamificationEnabled silencia a gamificação', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set(auth())
      .send({ gamificationEnabled: false })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`${SEED_QUESTIONS_URL}&limit=1`)
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

    // Conquistas e ranking também respeitam o toggle.
    for (const path of ['achievements', 'leaderboard']) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/gamification/${path}`)
        .set(auth())
        .expect(200);
      expect(res.body).toEqual({ enabled: false });
    }
  });
});
