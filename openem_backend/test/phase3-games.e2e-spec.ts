import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fase 3 — Games (issue #18, e2e)', () => {
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
        email: `games18_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /games lista o catálogo com Cálculo Mental', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/games')
      .set(auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('key', 'calculo-mental');
    expect(res.body[0]).toHaveProperty('levels');
  });

  it('POST /games/scores registra pontuação e concede XP', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/games/scores')
      .set(auth())
      .send({
        gameKey: 'calculo-mental',
        score: 40,
        level: 3,
        durationSec: 30,
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.score).toBe(40);
    const g = res.body.gamification;
    expect(g).toBeDefined();
    expect(g.xpGained).toBeGreaterThan(0);
  });

  it('POST /games/scores com chave inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/games/scores')
      .set(auth())
      .send({ gameKey: 'nao-existe', score: 1, level: 1, durationSec: 1 })
      .expect(404);
  });

  it('GET /games/:key/leaderboard retorna o ranking do jogo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/games/calculo-mental/leaderboard')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('displayName');
      expect(res.body[0]).toHaveProperty('bestScore');
    }
  });

  it('GET /games/leaderboard retorna o ranking geral por XP', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/games/leaderboard')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('bestScore');
    }
  });
});
