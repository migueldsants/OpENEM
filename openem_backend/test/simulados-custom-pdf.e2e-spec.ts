import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Simulado personalizado por tema e caderno em PDF.
 *
 * O banco de teste é o do seed (poucas questões de demonstração), então o que
 * se verifica aqui é o contrato: o recorte responde, o simulado inicia com o
 * que existe e o PDF sai como PDF de verdade.
 */
describe('Simulados personalizados e PDF (e2e)', () => {
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
        email: `sim_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Uma área do conhecimento qualquer, pela listagem de matérias. */
  async function umaArea(): Promise<{ id: string; name: string }> {
    const subjects = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const comArea = (
      subjects.body as { subjectArea: { id: string; name: string } | null }[]
    ).find((s) => s.subjectArea);
    if (!comArea?.subjectArea) throw new Error('seed sem área do conhecimento');
    return comArea.subjectArea;
  }

  it('a lista de simulados traz as provas por área do catálogo', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/simulations/templates')
      .set(auth())
      .expect(200);
    const porArea = (res.body as { scope: string }[]).filter(
      (t) => t.scope === 'AREA',
    );
    expect(porArea.length).toBeGreaterThan(0);
  });

  it('preview conta as questões do recorte antes de começar', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/simulations/preview')
      .set(auth())
      .send({ questionCount: 5 })
      .expect(201);
    expect(typeof res.body.available).toBe('number');
    expect(res.body.timeLimitMin).toBeGreaterThan(0);
    expect(typeof res.body.description).toBe('string');
  });

  it('recorte sem questão nenhuma não inicia, e explica por quê', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({ topicIds: ['topico-que-nao-existe'] })
      .expect(400);
    expect(String(res.body.message)).toMatch(/Nenhuma questão combina/);
  });

  it('inicia um simulado só com filtros, sem template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({ questionCount: 3 })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.questions.length).toBeGreaterThan(0);
    // Durante a prova o gabarito não vai junto.
    expect(res.body.questions[0].alternatives[0]).not.toHaveProperty(
      'isCorrect',
    );
  });

  it('salva, lista e apaga um simulado personalizado', async () => {
    const area = await umaArea();
    const criado = await request(app.getHttpServer())
      .post('/api/v1/simulations/templates')
      .set(auth())
      .send({
        name: 'Meu simulado de teste',
        subjectAreaIds: [area.id],
        questionCount: 5,
      })
      .expect(201);
    expect(criado.body.owned).toBe(true);
    expect(criado.body.filters.subjectAreaIds).toEqual([area.id]);

    const lista = await request(app.getHttpServer())
      .get('/api/v1/simulations/templates')
      .set(auth())
      .expect(200);
    expect(
      (lista.body as { id: string }[]).some((t) => t.id === criado.body.id),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/simulations/templates/${criado.body.id}`)
      .set(auth())
      .expect(200);

    const depois = await request(app.getHttpServer())
      .get('/api/v1/simulations/templates')
      .set(auth())
      .expect(200);
    expect(
      (depois.body as { id: string }[]).some((t) => t.id === criado.body.id),
    ).toBe(false);
  });

  it('não deixa apagar simulado de outro aluno', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/v1/simulations/templates')
      .set(auth())
      .send({ name: 'Só meu', questionCount: 5 })
      .expect(201);

    const outro = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `sim_outro_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/simulations/templates/${criado.body.id}`)
      .set({ Authorization: `Bearer ${outro.body.accessToken}` })
      .expect(403);
  });

  it('lista os temas de cor do caderno', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/simulations/pdf-themes')
      .set(auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThan(3);
    expect(res.body[0]).toHaveProperty('brand');
  });

  it('gera o caderno em PDF com o tema escolhido', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/simulations/pdf')
      .set(auth())
      .send({
        questionCount: 3,
        title: 'Meu caderno de teste',
        theme: 'forest',
        explanations: true,
      })
      .expect(201);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(
      'openem-meu-caderno-de-teste.pdf',
    );
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('recusa cor de marca que não é hexadecimal', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/simulations/pdf')
      .set(auth())
      .send({ questionCount: 3, brandColor: 'azul-claro' })
      .expect(400);
  });

  it('PDF exige autenticação', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/simulations/pdf')
      .send({ questionCount: 3 })
      .expect(401);
  });
});
