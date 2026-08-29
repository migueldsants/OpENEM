import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fase 3 â€” XP em todas as aÃ§Ãµes (issue #17, e2e)', () => {
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
        email: `xp17_${Date.now()}@exemplo.com`,
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
    return res.body.alternatives.find(
      (a: { id: string; isCorrect: boolean }) => a.isCorrect,
    ).id;
  }

  it('finalizar um simulado concede XP (gamification delta)', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({ templateId: 'seed-template-math' })
      .expect(201);

    const answers = [];
    for (const q of start.body.questions) {
      answers.push({
        questionId: q.id,
        chosenId: await correctAlternativeId(q.id),
      });
    }

    const finish = await request(app.getHttpServer())
      .post(`/api/v1/simulations/${start.body.id}/finish`)
      .set(auth())
      .send({ answers })
      .expect(201);
    const g = finish.body.gamification;
    expect(g).toBeDefined();
    expect(g.xpGained).toBeGreaterThan(0);
    expect(g.newAchievements.map((a: { code: string }) => a.code)).toContain(
      'FIRST_SIMULATION',
    );
  });

  it('enviar uma redaÃ§Ã£o concede XP e registra no histÃ³rico', async () => {
    const prompts = await request(app.getHttpServer())
      .get('/api/v1/essays/prompts')
      .set(auth())
      .expect(200);
    const sub = await request(app.getHttpServer())
      .post('/api/v1/essays/submissions')
      .set(auth())
      .send({
        promptId: prompts.body[0].id,
        content: 'RedaÃ§Ã£o de teste para XP.',
      })
      .expect(201);
    const g = sub.body.gamification;
    expect(g).toBeDefined();
    expect(g.xpGained).toBeGreaterThan(0);
    expect(g.newAchievements.map((a: { code: string }) => a.code)).toContain(
      'FIRST_ESSAY',
    );
  });

  it('marcar uma sessÃ£o do cronograma como concluÃ­da concede XP', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/study-plan/generate')
      .set(auth())
      .expect(201);
    const plan = await request(app.getHttpServer())
      .get('/api/v1/study-plan')
      .set(auth())
      .expect(200);
    const sessionId = plan.body.sessions[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/study-plan/sessions/${sessionId}`)
      .set(auth())
      .send({ done: true })
      .expect(200);
    const g = res.body.gamification;
    expect(g).toBeDefined();
    expect(g.xpGained).toBeGreaterThan(0);
    expect(g.newAchievements.map((a: { code: string }) => a.code)).toContain(
      'FIRST_SESSION',
    );

    // Desmarcar nÃ£o dÃ¡ XP novamente.
    const undo = await request(app.getHttpServer())
      .patch(`/api/v1/study-plan/sessions/${sessionId}`)
      .set(auth())
      .send({ done: false })
      .expect(200);
    expect(undo.body.gamification).toBeUndefined();
  });

  it('GET /gamification/history retorna logs e agregado por dia', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gamification/history')
      .set(auth())
      .expect(200);
    expect(res.body.enabled).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.byDay)).toBe(true);
    expect(res.body.byDay.length).toBeGreaterThan(0);
    const totalFromByDay = res.body.byDay.reduce(
      (acc: number, d: { xp: number }) => acc + d.xp,
      0,
    );
    expect(totalFromByDay).toBeGreaterThan(0);
  });
});
