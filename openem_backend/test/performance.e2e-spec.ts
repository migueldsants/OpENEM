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
import { testNickname } from './nickname';

describe('Performance — filtro de período (issue #20, e2e)', () => {
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
        nickname: testNickname(),
        email: `perf20_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /performance sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/performance').expect(401);
  });

  it('GET /performance?period=7d responde 200 com a estrutura esperada', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance?period=7d')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveProperty('overall');
    expect(res.body).toHaveProperty('bySubject');
    expect(res.body).toHaveProperty('timeline');
    expect(Array.isArray(res.body.timeline)).toBe(true);
  });

  it('GET /performance?period=all responde 200', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/performance?period=all')
      .set(auth())
      .expect(200);
  });

  it('GET /performance?period=invalido retorna 400 (ValidationPipe)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/performance?period=invalido')
      .set(auth())
      .expect(400);
  });

  it('GET /performance sem period usa 30d como padrão', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance')
      .set(auth())
      .expect(200);
    expect(res.body.overall).toBeDefined();
  });

  it('GET /performance/heatmap devolve a taxonomia completa (issue #43)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance/heatmap')
      .set(auth())
      .expect(200);
    // 4 áreas canônicas da seed (Redação vive dentro de Linguagens).
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    const area = res.body[0];
    expect(area).toHaveProperty('subjects');
    expect(area.subjects[0]).toHaveProperty('topics');
    // Cada tópico carrega o desempenho do usuário (0 sem respostas).
    const topic = area.subjects[0].topics[0];
    expect(topic).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      weight: expect.any(Number),
      total: expect.any(Number),
      correct: expect.any(Number),
      accuracy: expect.any(Number),
    });
    // Usuário novo: nenhum tópico respondido.
    expect(topic.total).toBe(0);
    expect(topic.accuracy).toBe(0);
  });

  it('GET /performance/heatmap sem token retorna 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/performance/heatmap')
      .expect(401);
  });

  it('GET /performance/weeks sem token retorna 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/performance/weeks')
      .expect(401);
  });

  it('GET /performance/weeks fora de 1..12 retorna 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/performance/weeks?weeks=13')
      .set(auth())
      .expect(400);
  });

  it('GET /performance/weeks conta a resposta de hoje na semana atual (issue #90)', async () => {
    const list = await request(app.getHttpServer())
      .get(SEED_QUESTIONS_URL)
      .set(auth())
      .expect(200);
    const question = list.body.items[0];
    await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId: question.id, chosenId: question.alternatives[0].id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/performance/weeks?weeks=3')
      .set(auth())
      .expect(200);
    expect(res.body.weeks).toHaveLength(3);
    const [atual] = res.body.weeks;
    expect(atual.days).toHaveLength(7);
    expect(atual.answers).toBe(1);
    expect(
      atual.days.find((d: { date: string }) => d.date === res.body.today),
    ).toMatchObject({ answers: 1, studied: true });
    expect(res.body.streak).toBe(1);
    expect(Array.isArray(res.body.priorities)).toBe(true);
    expect(res.body.goalMinutesPerDay).toEqual(expect.any(Number));
  });
});
