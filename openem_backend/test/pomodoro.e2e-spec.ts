import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { testNickname } from './nickname';

describe('Modo Foco / Pomodoro (issue #41, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let userId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const otherAuth = () => ({ Authorization: `Bearer ${otherToken}` });

  function startSession(durationSec: number, subjectId?: string) {
    return request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions/start')
      .set(auth())
      .send({ durationSec, ...(subjectId ? { subjectId } : {}) });
  }

  function completeSession(id: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/pomodoro/sessions/${id}/complete`)
      .set(auth());
  }

  /** Abre uma sessão e recua o startedAt no banco para simular o tempo real. */
  async function startInPast(durationSec: number, subjectId?: string) {
    const res = await startSession(durationSec, subjectId).expect(201);
    await prisma.focusSession.update({
      where: { id: res.body.id },
      data: {
        startedAt: new Date(Date.now() - durationSec * 1000 - 60_000),
      },
    });
    return res.body as { id: string };
  }

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
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `focus_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
    userId = reg.body.user.id;

    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `focus_outro_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    otherToken = other.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /pomodoro/sessions/start abre a sessão no servidor', async () => {
    const res = await startSession(1500).expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.durationSec).toBe(1500);
    expect(res.body.subjectName).toBeNull();
    expect(new Date(res.body.startedAt).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
    const row = await prisma.focusSession.findUnique({
      where: { id: res.body.id },
      select: { userId: true, completedAt: true },
    });
    expect(row).toEqual({ userId, completedAt: null });
  });

  it('POST /complete antes do tempo real retorna 400', async () => {
    const started = await startSession(600).expect(201);
    await completeSession(started.body.id).expect(400);
  });

  it('POST /complete conclui uma sessão de 25 min e credita XP', async () => {
    const started = await startInPast(1500);
    const res = await completeSession(started.id).expect(201);
    expect(res.body.durationSec).toBe(1500);
    expect(res.body.subjectName).toBeNull();
    expect(res.body.completedAt).toBeDefined();
    expect(res.body.gamification).toBeDefined();

    await completeSession(started.id).expect(400);
  });

  it('só o dono conclui a sessão', async () => {
    const started = await startInPast(300);
    await request(app.getHttpServer())
      .post(`/api/v1/pomodoro/sessions/${started.id}/complete`)
      .set(otherAuth())
      .expect(404);
  });

  it('POST /start com matéria registra o nome da matéria', async () => {
    const subjects = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const mat = subjects.body.find((s: { name: string }) =>
      s.name.includes('Matem'),
    );

    const started = await startInPast(600, mat.id);
    const res = await completeSession(started.id).expect(201);
    expect(res.body.subjectName).toContain('Matem');
  });

  it('POST /start com matéria inexistente retorna 404', async () => {
    await startSession(600, 'nao-existe').expect(404);
  });

  it('POST /start com duração fora da faixa retorna 400', async () => {
    await startSession(10).expect(400);
    await startSession(999999).expect(400);
  });

  it('começar outra sessão descarta a anterior', async () => {
    const primeira = await startSession(600).expect(201);
    await startSession(600).expect(201);
    await completeSession(primeira.body.id).expect(404);
  });

  it('GET /pomodoro/history traz só sessões concluídas', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/history')
      .set(auth())
      .expect(200);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(2);
    expect(res.body.totalMinutes).toBeGreaterThanOrEqual(35);
    expect(
      res.body.sessions.every(
        (s: { completedAt?: string }) => typeof s.completedAt === 'string',
      ),
    ).toBe(true);
  });

  it('GET /pomodoro/by-subject agrega minutos por matéria', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/by-subject')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
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

  it('a rota antiga de registrar duração não existe mais', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions')
      .set(auth())
      .send({
        durationSec: 1500,
        startedAt: new Date(Date.now() - 25 * 60_000).toISOString(),
      })
      .expect(404);
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions/start')
      .send({ durationSec: 1500 })
      .expect(401);
  });

  it('a sessão aberta não entra no histórico', async () => {
    await startSession(600).expect(201);
    const res = await request(app.getHttpServer())
      .get('/api/v1/pomodoro/history')
      .set(auth())
      .expect(200);
    expect(
      res.body.sessions.every(
        (s: { completedAt?: string }) => typeof s.completedAt === 'string',
      ),
    ).toBe(true);
  });
});
