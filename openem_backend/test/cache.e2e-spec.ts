import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { RedisCacheStore } from './../src/cache/cache-store';
import { CACHE_STORE, CacheService } from './../src/cache/cache.service';
import { invalidateCatalogCache } from './../src/cache/catalog-invalidation';
import { PrismaService } from './../src/prisma/prisma.service';
import { testNickname } from './nickname';

/**
 * Cache de catálogo (issue #86). No CI roda com o Redis do job (REDIS_URL);
 * sem ele, com o cache em memória. Os dois caminhos têm de servir o catálogo
 * do cache até a invalidação e nunca dar 5xx quando o Redis cai.
 */

async function criarApp(
  override?: (b: ReturnType<typeof Test.createTestingModule>) => void,
): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  override?.(builder);
  const moduleFixture: TestingModule = await builder.compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
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
  return app;
}

async function registrar(app: INestApplication<App>, prefixo: string) {
  const reg = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      nickname: testNickname(),
      email: `${prefixo}_${Date.now()}@exemplo.com`,
      password: 'senhaForte123',
      acceptTerms: true,
    })
    .expect(201);
  return { Authorization: `Bearer ${reg.body.accessToken as string}` };
}

type Materia = { name: string; topics: { name: string }[] };

describe('Cache de catálogo (e2e)', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };
  const comRedis = !!process.env.REDIS_URL?.trim();

  beforeAll(async () => {
    app = await criarApp();
    auth = await registrar(app, 'cache');
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health diz se o Redis está em uso', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.redis).toBe(comRedis ? 'up' : 'disabled');
  });

  it('o catálogo sai do cache até a invalidação', async () => {
    const prisma = app.get(PrismaService);
    const nome = `Assunto do teste de cache ${Date.now()}`;
    const temAssunto = (body: Materia[]) =>
      body.some((m) => m.topics.some((t) => t.name === nome));

    const antes = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth)
      .expect(200);
    const materia = await prisma.subject.findFirstOrThrow({
      where: { name: (antes.body as Materia[])[0].name },
    });
    const topico = await prisma.topic.create({
      data: { name: nome, subjectId: materia.id },
    });

    try {
      // Gravado direto no banco, sem invalidar: o cache ainda não sabe.
      const velho = await request(app.getHttpServer())
        .get('/api/v1/subjects')
        .set(auth)
        .expect(200);
      expect(temAssunto(velho.body as Materia[])).toBe(false);

      // Com Redis, o caminho dos scripts (seed, import); sem ele, o da API.
      if (comRedis) await invalidateCatalogCache(process.env, () => {});
      else await app.get(CacheService).bump('catalog');

      const novo = await request(app.getHttpServer())
        .get('/api/v1/subjects')
        .set(auth)
        .expect(200);
      expect(temAssunto(novo.body as Materia[])).toBe(true);
    } finally {
      await prisma.topic.delete({ where: { id: topico.id } });
      await app.get(CacheService).bump('catalog');
    }
  });
});

describe('Cache com o Redis fora do ar (e2e)', () => {
  let app: INestApplication<App>;
  let auth: { Authorization: string };
  let store: RedisCacheStore;

  beforeAll(async () => {
    // Porta sem nada escutando: todo comando do cache falha.
    store = RedisCacheStore.fromUrl('redis://127.0.0.1:1');
    app = await criarApp((b) => {
      b.overrideProvider(CACHE_STORE).useValue(store);
    });
    auth = await registrar(app, 'cache_down');
  });

  afterAll(async () => {
    await app.close();
  });

  it('o catálogo continua respondendo, lido do banco', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/questions/exams')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/questions/facets')
      .set(auth)
      .expect(200);
  });

  it('/health segue ok e mostra o Redis fora', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', redis: 'down' });
  });
});
