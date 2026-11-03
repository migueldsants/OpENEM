import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { testNickname } from './nickname';

describe('Auth & Health (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e_${Date.now()}@exemplo.com`;
  const password = 'senhaForte123';
  const nickname = testNickname();
  let token: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('up');
  });

  it('POST /api/v1/auth/register → cria conta e retorna token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: `@${nickname.toUpperCase()}`,
        email,
        password,
        displayName: 'E2E',
        acceptTerms: true,
      })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
    token = res.body.accessToken;
  });

  it('POST /api/v1/auth/register duplicado → 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ nickname: testNickname(), email, password, acceptTerms: true })
      .expect(409);
  });

  it('POST /api/v1/auth/register inválido → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: 'nao-eh-email',
        password: '123',
        acceptTerms: true,
      })
      .expect(400);
  });

  it('POST /api/v1/auth/register sem apelido ou com apelido ofensivo → 400', async () => {
    const outro = `e2e_apelido_${Date.now()}@exemplo.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: outro, password, acceptTerms: true })
      .expect(400);
    for (const ruim of ['h1tl3r', 'odeio_catolicos', 'caralho', 'admin']) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ nickname: ruim, email: outro, password, acceptTerms: true })
        .expect(400);
      expect(String(res.body.message)).toMatch(/apelido/i);
    }
  });

  it('POST /api/v1/auth/register com apelido em uso → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname,
        email: `e2e_dup_${Date.now()}@exemplo.com`,
        password,
        acceptTerms: true,
      })
      .expect(409);
    expect(String(res.body.message)).toMatch(/apelido já está em uso/);
  });

  it('o apelido sai normalizado em /users/me e só muda para um válido', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.profile.nickname).toBe(nickname);
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: null })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'nazista' })
      .expect(400);
  });

  it('POST /api/v1/auth/login → retorna token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    token = res.body.accessToken;
  });

  it('POST /api/v1/auth/login senha errada → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'senha-errada' })
      .expect(401);
  });

  it('GET /api/v1/users/me sem token → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET /api/v1/users/me com token → perfil', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body.profile).toBeDefined();
  });

  it('PUT /api/v1/users/me/profile → atualiza perfil', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ goal: 'PROUNI', minutesPerDay: 90 })
      .expect(200);
    expect(res.body.profile.goal).toBe('PROUNI');
    expect(res.body.profile.minutesPerDay).toBe(90);
  });
});
