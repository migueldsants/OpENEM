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

// Issue #19 (social): likes em posts do fÃ³rum, perfil pÃºblico (sem PII) e
// ranking de XP (global e por liga). Cobre os 3 endpoints novos + toggle.
describe('Fase 3 â€” social: likes, perfil pÃºblico e ranking (issue #19, e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let otherToken: string;
  let userId: string;
  let threadId: string;
  let postId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const otherAuth = () => ({ Authorization: `Bearer ${otherToken}` });

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
        email: `p3soc_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(auth())
      .expect(200);
    userId = me.body.id;
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set(auth())
      .send({ displayName: 'Autor Social' })
      .expect(200);

    const otherReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `p3soc_other_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    otherToken = otherReg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria um tÃ³pico e uma resposta para exercitar likes', async () => {
    const thread = await request(app.getHttpServer())
      .post('/api/v1/community/threads')
      .set(auth())
      .send({ title: 'TÃ³pico social #19', body: 'corpo do tÃ³pico' })
      .expect(201);
    threadId = thread.body.id;

    const reply = await request(app.getHttpServer())
      .post(`/api/v1/community/threads/${threadId}/posts`)
      .set(otherAuth())
      .send({ body: 'resposta para curtir' })
      .expect(201);
    // Responder devolve só a resposta criada, não o tópico.
    postId = reply.body.id;
    expect(reply.body.body).toBe('resposta para curtir');
    expect(reply.body.likes).toBe(0);
    expect(reply.body.liked).toBe(false);
    expect(reply.body).not.toHaveProperty('posts');
  });

  it('POST .../like curte a resposta (toggle on)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/community/threads/${threadId}/posts/${postId}/like`)
      .set(auth())
      .expect(201);
    expect(res.body.liked).toBe(true);
    expect(res.body.likes).toBe(1);

    // getThread reflete o like do usuÃ¡rio corrente
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/community/threads/${threadId}`)
      .set(auth())
      .expect(200);
    expect(detail.body.posts[0].likes).toBe(1);
    expect(detail.body.posts[0].liked).toBe(true);
  });

  it('POST .../like descurte ao repetir (toggle off)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/community/threads/${threadId}/posts/${postId}/like`)
      .set(auth())
      .expect(201);
    expect(res.body.liked).toBe(false);
    expect(res.body.likes).toBe(0);
  });

  it('POST .../like 404 para post inexistente', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/community/threads/${threadId}/posts/inexistente/like`)
      .set(auth())
      .expect(404);
  });

  it('tópico com 500 respostas: o detalhe traz uma página e o resto vem por cursor', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/community/threads')
      .set(auth())
      .send({ title: 'Tópico com muitas respostas', body: 'corpo' })
      .expect(201);
    const id = created.body.id;
    // Direto no banco: pela API, a escrita no fórum tem limite por minuto.
    // Dez respostas por instante, para o desempate pelo id entrar em jogo.
    const base = Date.now() - 60_000;
    await app.get(PrismaService).forumPost.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        threadId: id,
        userId,
        body: `resposta ${i}`,
        createdAt: new Date(base + Math.floor(i / 10)),
      })),
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/community/threads/${id}`)
      .set(auth())
      .expect(200);
    expect(detail.body.replies).toBe(500);
    expect(detail.body.posts).toHaveLength(20);
    expect(typeof detail.body.nextCursor).toBe('string');

    type Post = { id: string; body: string };
    const seen: Post[] = [...detail.body.posts];
    let cursor: string | null = detail.body.nextCursor;
    while (cursor) {
      const page = await request(app.getHttpServer())
        .get(`/api/v1/community/threads/${id}/posts`)
        .query({ cursor, limit: 50 })
        .set(auth())
        .expect(200);
      expect(page.body.posts.length).toBeLessThanOrEqual(50);
      seen.push(...(page.body.posts as Post[]));
      cursor = page.body.nextCursor;
    }
    // Todas, uma vez cada, e em ordem de criação (o instante nunca volta).
    expect(new Set(seen.map((p) => p.id)).size).toBe(500);
    const instants = seen.map((p) =>
      Math.floor(Number(p.body.split(' ')[1]) / 10),
    );
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });

  it('GET .../posts valida limite, cursor e tópico', async () => {
    const server = app.getHttpServer();
    await request(server)
      .get(`/api/v1/community/threads/${threadId}/posts?limit=51`)
      .set(auth())
      .expect(400);
    await request(server)
      .get(`/api/v1/community/threads/${threadId}/posts?cursor=lixo`)
      .set(auth())
      .expect(400);
    await request(server)
      .get('/api/v1/community/threads/inexistente/posts')
      .set(auth())
      .expect(404);
  });

  it('GET /users/:id/profile expÃµe perfil pÃºblico sem e-mail (PII)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}/profile`)
      .set(auth())
      .expect(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.displayName).toBe('Autor Social');
    expect(res.body).toHaveProperty('xp');
    expect(res.body).toHaveProperty('level');
    expect(res.body).toHaveProperty('league');
    expect(res.body).toHaveProperty('currentStreak');
    expect(res.body).toHaveProperty('featuredAchievements');
    // NUNCA expÃµe e-mail ou passwordHash
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('GET /users/:id/profile 404 para usuÃ¡rio inexistente', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users/nao-existe/profile')
      .set(auth())
      .expect(404);
  });

  it('GET /gamification/leaderboard (global) retorna entradas com xp e level', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gamification/leaderboard?limit=10')
      .set(auth())
      .expect(200);
    expect(res.body.scope).toBe('global');
    expect(Array.isArray(res.body.entries)).toBe(true);
    if (res.body.entries.length > 0) {
      const e = res.body.entries[0];
      expect(e).toHaveProperty('displayName');
      expect(e).toHaveProperty('xp');
      expect(e).toHaveProperty('level');
    }
  });

  it('GET /gamification/leaderboard?scope=league inclui o solicitante', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/gamification/leaderboard?scope=league&limit=10')
      .set(auth())
      .expect(200);
    expect(res.body.scope).toBe('league');
    expect(res.body).toHaveProperty('league');
    expect(Array.isArray(res.body.entries)).toBe(true);
    // O solicitante deve aparecer (mesmo fora do top).
    expect(res.body.entries.some((e: any) => e.userId === userId)).toBe(true);
  });
});
