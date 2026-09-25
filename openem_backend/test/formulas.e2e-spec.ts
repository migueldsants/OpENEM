import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Fórmulas / cheat sheet (issue #38, e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let bhaskaraId: string;

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
        email: `formulas_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /formulas lista as fórmulas do seed (46 builtIn)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/formulas')
      .set(auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(40);
    const bhaskara = res.body.find((f: { title: string }) =>
      f.title.includes('Bhaskara'),
    );
    expect(bhaskara).toMatchObject({
      isBuiltIn: true,
      favorited: false,
      subjectName: expect.any(String),
    });
    bhaskaraId = bhaskara.id;
  });

  it('GET /formulas?q= busca por texto (título)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/formulas?q=bhaskara')
      .set(auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].title).toContain('2º grau');
  });

  it('POST /formulas/:id/favorite alterna o estado de favorito', async () => {
    const fav = await request(app.getHttpServer())
      .post(`/api/v1/formulas/${bhaskaraId}/favorite`)
      .set(auth())
      .expect(201);
    expect(fav.body).toEqual({ favorited: true });

    const unfav = await request(app.getHttpServer())
      .post(`/api/v1/formulas/${bhaskaraId}/favorite`)
      .set(auth())
      .expect(201);
    expect(unfav.body).toEqual({ favorited: false });
  });

  it('GET /formulas?onlyFavorites=true reflete os favoritos', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/formulas/${bhaskaraId}/favorite`)
      .set(auth())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/formulas?onlyFavorites=true')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].favorited).toBe(true);
    expect(res.body[0].id).toBe(bhaskaraId);
  });

  it('POST /formulas cria fórmula personalizada', async () => {
    const subjects = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const mat = subjects.body.find((s: { name: string }) =>
      s.name.includes('Matem'),
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/formulas')
      .set(auth())
      .send({
        title: 'Minha fórmula de teste',
        latex: 'E = mc^2',
        subjectId: mat.id,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      title: 'Minha fórmula de teste',
      isBuiltIn: false,
      favorited: false,
    });
  });

  it('POST /formulas com matéria inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/formulas')
      .set(auth())
      .send({ title: 'X', latex: 'x', subjectId: 'nao-existe' })
      .expect(404);
  });

  it('favoritar fórmula inexistente retorna 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/formulas/nao-existe/favorite')
      .set(auth())
      .expect(404);
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/formulas').expect(401);
  });

  describe('POST /formulas/pdf (caderno de fórmulas)', () => {
    /** Resposta binária: o supertest não junta o corpo sem um parser. */
    const binario = (
      res: NodeJS.ReadableStream,
      cb: (err: Error | null, body: Buffer) => void,
    ) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    };

    it('gera o PDF das fórmulas escolhidas, com nome de arquivo', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/formulas/pdf')
        .set(auth())
        .send({ formulaIds: [bhaskaraId], title: 'Minha cola', cover: false })
        .buffer(true)
        .parse(binario)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain(
        'filename="minha-cola.pdf"',
      );
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    }, 30_000);

    it('seleção vazia é recusada com mensagem, e não vira PDF em branco', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/formulas/pdf')
        .set(auth())
        .send({ formulaIds: [] })
        .expect(400);
      expect(res.body.message).toMatch(/Nenhuma fórmula/);
    });

    it('cor inválida é recusada pela validação', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/formulas/pdf')
        .set(auth())
        .send({ brandColor: 'vermelho' })
        .expect(400);
    });

    it('sem token retorna 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/formulas/pdf')
        .send({})
        .expect(401);
    });
  });
});
