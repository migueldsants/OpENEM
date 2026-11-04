import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { THEME_TOKEN_KEYS } from './../src/common/theme-tokens';
import { testNickname } from './nickname';

// Tela Temas: temas do aluno (claro + escuro), publicação opcional na
// comunidade e curtidas (uma por aluno, toggle). As cores vão para o
// navegador de outros alunos, então só #rrggbb passa.
describe('Temas: meus temas, comunidade e curtidas (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const autora = testNickname();
  let otherToken: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const tokens = (hex: string) =>
    Object.fromEntries(THEME_TOKEN_KEYS.map((k) => [k, hex]));
  const theme = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    light: tokens('#F5F1F6'),
    dark: tokens('#15111c'),
    ...extra,
  });

  async function register(prefix: string) {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `${prefix}_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    return reg.body.accessToken as string;
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

    token = await register('temas');
    otherToken = await register('temas_outro');
    await request(app.getHttpServer())
      .put('/api/v1/users/me/profile')
      .set(auth(token))
      .send({ nickname: autora })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige login', async () => {
    await request(app.getHttpServer()).get('/api/v1/themes/mine').expect(401);
  });

  it('cria privado, normaliza as cores e lista em "meus temas"', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('  Rosa Noite  '))
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Rosa Noite',
      isPublic: false,
      likes: 0,
      mine: true,
    });
    expect(res.body.light.bg).toBe('#f5f1f6');

    const mine = await request(app.getHttpServer())
      .get('/api/v1/themes/mine')
      .set(auth(token))
      .expect(200);
    expect(mine.body.map((t: { name: string }) => t.name)).toContain(
      'Rosa Noite',
    );

    // Privado não aparece na comunidade.
    const pub = await request(app.getHttpServer())
      .get('/api/v1/themes/community')
      .set(auth(otherToken))
      .expect(200);
    expect(pub.body.find((t: { id: string }) => t.id === res.body.id)).toBe(
      undefined,
    );
  });

  it.each([
    ['url()', 'url(https://evil.example/x.png)'],
    ['var()', 'var(--x)'],
    ['nome de cor', 'red'],
    ['hex curto', '#fff'],
  ])('recusa cor %s com 400', async (_n, value) => {
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Invasor', { dark: { ...tokens('#000000'), bg: value } }))
      .expect(400);
  });

  it('recusa lado incompleto, nome curto e campo desconhecido', async () => {
    const semMuted = tokens('#000000');
    delete semMuted.muted;
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Faltando', { light: semMuted }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('X'))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Com extra', { ownerId: 'outro' }))
      .expect(400);
  });

  it('nome repetido do mesmo aluno é 409; de outro aluno pode', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Duplicado'))
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Duplicado'))
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(otherToken))
      .send(theme('Duplicado'))
      .expect(201);
  });

  it('publica, curte uma vez por aluno (toggle) e ordena por curtidas', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Neon Publicado'))
      .expect(201);
    const id = created.body.id as string;

    // Privado: nem o link direto deixa curtir.
    await request(app.getHttpServer())
      .post(`/api/v1/themes/${id}/like`)
      .set(auth(otherToken))
      .expect(404);

    const pub = await request(app.getHttpServer())
      .patch(`/api/v1/themes/${id}`)
      .set(auth(token))
      .send({ isPublic: true })
      .expect(200);
    expect(pub.body.isPublic).toBe(true);
    expect(pub.body.publishedAt).toBeTruthy();

    // O dono não curte o próprio tema.
    await request(app.getHttpServer())
      .post(`/api/v1/themes/${id}/like`)
      .set(auth(token))
      .expect(400);

    const like = await request(app.getHttpServer())
      .post(`/api/v1/themes/${id}/like`)
      .set(auth(otherToken))
      .expect(201);
    expect(like.body).toEqual({ liked: true, likes: 1 });

    const list = await request(app.getHttpServer())
      .get('/api/v1/themes/community?sort=popular')
      .set(auth(otherToken))
      .expect(200);
    const item = list.body.find((t: { id: string }) => t.id === id);
    expect(item).toMatchObject({
      liked: true,
      likes: 1,
      mine: false,
      author: autora,
    });
    expect(JSON.stringify(list.body)).not.toContain('@exemplo.com');

    const unlike = await request(app.getHttpServer())
      .post(`/api/v1/themes/${id}/like`)
      .set(auth(otherToken))
      .expect(201);
    expect(unlike.body).toEqual({ liked: false, likes: 0 });

    // Despublicado some da comunidade.
    await request(app.getHttpServer())
      .patch(`/api/v1/themes/${id}`)
      .set(auth(token))
      .send({ isPublic: false })
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/api/v1/themes/community?sort=recent')
      .set(auth(otherToken))
      .expect(200);
    expect(after.body.find((t: { id: string }) => t.id === id)).toBe(undefined);
  });

  it('tema de outro aluno é 404 para editar e apagar', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/themes')
      .set(auth(token))
      .send(theme('Só Meu', { isPublic: true }))
      .expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/themes/${id}`)
      .set(auth(otherToken))
      .send({ name: 'Roubado' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/themes/${id}`)
      .set(auth(otherToken))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/themes/${id}`)
      .set(auth(token))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/themes/${id}`)
      .set(auth(token))
      .expect(404);
  });

  it('valida a query da comunidade', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/themes/community?sort=aleatorio')
      .set(auth(token))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/themes/community?take=500')
      .set(auth(token))
      .expect(400);
  });
});
