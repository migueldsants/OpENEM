import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Modo Foco / Pomodoro (issue #41, e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
        email: `focus_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /pomodoro/sessions registra sessão de 25 min com XP', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({
        durationSec: 1500,
        startedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      })
      .expect(201);
    expect(res.body.durationSec).toBe(1500);
    expect(res.body.subjectName).toBeNull();
    expect(res.body.gamification).toBeDefined();
  });

  it('POST com matéria registra o nome da matéria', async () => {
    const subjects = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const mat = subjects.body.find((s: { name: string }) =>
      s.name.includes('Matem'),
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({
        durationSec: 600,
        startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        subjectId: mat.id,
      })
      .expect(201);
    expect(res.body.subjectName).toContain('Matem');
  });

  it('POST com matéria inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({
        durationSec: 600,
        startedAt: new Date().toISOString(),
        subjectId: 'nao-existe',
      })
      .expect(404);
  });

  it('POST com duração absurda retorna 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({ durationSec: 10, startedAt: new Date().toISOString() })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({ durationSec: 999999, startedAt: new Date().toISOString() })
      .expect(400);
  });

  it('GET /pomodoro/history traz sessões e total de minutos', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/history')
      .set(auth())
      .expect(200);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(2);
    expect(res.body.totalMinutes).toBeGreaterThanOrEqual(35);
  });

  it('GET /pomodoro/by-subject agrega minutos por matéria', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/by-subject')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    // A sessão com matéria aparece rotulada com o nome dela.
    const withSubject = res.body.find((x: { subjectName: string }) =>
      x.subjectName?.includes('Matem'),
    );
    expect(withSubject).toBeDefined();
    expect(withSubject.minutes).toBeGreaterThanOrEqual(10);
  });

  it('GET /pomodoro/today soma os minutos de hoje', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/today')
      .set(auth())
      .expect(200);
    expect(res.body.minutes).toBeGreaterThanOrEqual(35);
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .send({ durationSec: 60, startedAt: new Date().toISOString() })
      .expect(401);
  });
});
