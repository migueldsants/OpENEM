import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fase 2 — pós-MVP (e2e)', () => {
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
        email: `p2_${Date.now()}@exemplo.com`,
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

  it('favorita, lista e remove uma questão', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=1')
      .set(auth())
      .expect(200);
    const questionId = list.body.items[0].id;

    await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set(auth())
      .send({ questionId })
      .expect(201);
    // Idempotente: favoritar de novo não falha.
    await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set(auth())
      .send({ questionId })
      .expect(201);

    const favs = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .set(auth())
      .expect(200);
    expect(favs.body).toHaveLength(1);
    expect(favs.body[0].question.id).toBe(questionId);

    await request(app.getHttpServer())
      .delete(`/api/v1/favorites/${questionId}`)
      .set(auth())
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .set(auth())
      .expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('favoritar questão inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set(auth())
      .send({ questionId: 'nao-existe' })
      .expect(404);
  });

  it('gera o cronograma e marca uma sessão como concluída', async () => {
    const gen = await request(app.getHttpServer())
      .post('/api/v1/study-plan/generate')
      .set(auth())
      .expect(201);
    expect(gen.body.sessions.length).toBeGreaterThan(0);
    expect(gen.body).toHaveProperty('minutesPerDay');

    const plan = await request(app.getHttpServer())
      .get('/api/v1/study-plan')
      .set(auth())
      .expect(200);
    const sessionId = plan.body.sessions[0].id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/study-plan/sessions/${sessionId}`)
      .set(auth())
      .send({ done: true })
      .expect(200);
    expect(updated.body.done).toBe(true);
  });

  it('envia uma redação, corrige por rubrica e lê a nota', async () => {
    const prompts = await request(app.getHttpServer())
      .get('/api/v1/essays/prompts')
      .set(auth())
      .expect(200);
    expect(prompts.body.length).toBeGreaterThan(0);
    const promptId = prompts.body[0].id;

    const sub = await request(app.getHttpServer())
      .post('/api/v1/essays/submissions')
      .set(auth())
      .send({ promptId, content: 'Texto dissertativo-argumentativo de teste.' })
      .expect(201);
    const submissionId = sub.body.id;

    const evalRes = await request(app.getHttpServer())
      .post(`/api/v1/essays/submissions/${submissionId}/evaluation`)
      .set(auth())
      .send({ c1: 200, c2: 160, c3: 120, c4: 200, c5: 80 })
      .expect(201);
    expect(evalRes.body.total).toBe(760);

    // Dupla avaliação é bloqueada.
    await request(app.getHttpServer())
      .post(`/api/v1/essays/submissions/${submissionId}/evaluation`)
      .set(auth())
      .send({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 })
      .expect(409);

    // Competência fora da escala é rejeitada.
    const sub2 = await request(app.getHttpServer())
      .post('/api/v1/essays/submissions')
      .set(auth())
      .send({ promptId, content: 'Outro texto.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/essays/submissions/${sub2.body.id}/evaluation`)
      .set(auth())
      .send({ c1: 50, c2: 0, c3: 0, c4: 0, c5: 0 })
      .expect(400);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/essays/submissions/${submissionId}`)
      .set(auth())
      .expect(200);
    expect(detail.body.evaluation.total).toBe(760);
  });

  it('finaliza um simulado de questões calibradas e calcula a nota TRI', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({ templateId: 'seed-template-full' })
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
    expect(typeof finish.body.triScore).toBe('number');
    expect(finish.body.triScore).toBeGreaterThanOrEqual(0);
    expect(finish.body.triScore).toBeLessThanOrEqual(1000);
    // Acertar tudo deve render uma nota acima da média (500).
    expect(finish.body.triScore).toBeGreaterThan(500);
  });

  it('ativa o modo sem distrações no perfil', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set(auth())
      .send({ focusMode: true })
      .expect(200);
    expect(res.body.profile.focusMode).toBe(true);
  });
});
