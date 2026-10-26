import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Videoteca (issue #37, e2e)', () => {
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
        email: `videos_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let videoId: string;

  it('POST /videos salva por ID puro com fallback de título', async () => {
    // O oEmbed pode não ter rede no CI; o fallback garante o save.
    const res = await request(app.getHttpServer())
      .post('/api/v1/videos')
      .set(auth())
      .send({ url: 'dQw4w9WgXcQ' })
      .expect(201);
    expect(res.body.youtubeId).toBe('dQw4w9WgXcQ');
    expect(res.body.title).toBeTruthy();
    videoId = res.body.id;
  });

  it('POST com link inválido retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/videos')
      .set(auth())
      .send({ url: 'https://vimeo.com/123' })
      .expect(404);
  });

  it('POST com matéria inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/videos')
      .set(auth())
      .send({ url: 'dQw4w9WgXcQ', subjectId: 'nao-existe' })
      .expect(404);
  });

  it('POST /videos/:id/notes adiciona nota com timestamp; GET ordena', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/videos/${videoId}/notes`)
      .set(auth())
      .send({ timestampSec: 120, content: 'Explicação da função' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/videos/${videoId}/notes`)
      .set(auth())
      .send({ timestampSec: 30, content: 'Intro' })
      .expect(201);

    const notes = await request(app.getHttpServer())
      .get(`/api/v1/videos/${videoId}/notes`)
      .set(auth())
      .expect(200);
    expect(
      notes.body.map((n: { timestampSec: number }) => n.timestampSec),
    ).toEqual([30, 120]);
  });

  it('POST /videos/:id/watched alterna assistido', async () => {
    const on = await request(app.getHttpServer())
      .post(`/api/v1/videos/${videoId}/watched`)
      .set(auth())
      .expect(201);
    expect(on.body.watched).toBe(true);

    const off = await request(app.getHttpServer())
      .post(`/api/v1/videos/${videoId}/watched`)
      .set(auth())
      .expect(201);
    expect(off.body.watched).toBe(false);
  });

  it('PATCH re-classifica a matéria', async () => {
    const subjects = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const mat = subjects.body.find((s: { name: string }) =>
      s.name.includes('Matem'),
    );

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/videos/${videoId}`)
      .set(auth())
      .send({ subjectId: mat.id })
      .expect(200);
    expect(res.body.subjectName).toContain('Matem');

    // Limpa o escopo.
    const clean = await request(app.getHttpServer())
      .patch(`/api/v1/videos/${videoId}`)
      .set(auth())
      .send({ subjectId: null })
      .expect(200);
    expect(clean.body.subjectName).toBeNull();
  });

  it('DELETE notes/:noteId remove nota própria', async () => {
    const note = await request(app.getHttpServer())
      .post(`/api/v1/videos/${videoId}/notes`)
      .set(auth())
      .send({ timestampSec: 5, content: 'temporária' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/videos/notes/${note.body.id}`)
      .set(auth())
      .expect(200);
  });

  it('DELETE /videos/:id remove o vídeo; outro usuário não vê', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `other_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);

    // Outro usuário não acessa o vídeo alheio (notas 404).
    await request(app.getHttpServer())
      .get(`/api/v1/videos/${videoId}/notes`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/videos/${videoId}`)
      .set(auth())
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/videos')
      .set(auth())
      .expect(200);
    expect(list.body.some((v: { id: string }) => v.id === videoId)).toBe(false);
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/videos').expect(401);
  });
});
