import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SEED_QUESTIONS_URL } from './seed-questions';
import { testNickname } from './nickname';

describe('Fase 1 — fluxo MVP (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });

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
        nickname: testNickname(),
        email: `p1_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function correctAlternativeId(questionId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/questions/${questionId}`)
      .set(auth())
      .expect(200);
    const correct = res.body.alternatives.find(
      (a: { id: string; isCorrect: boolean }) => a.isCorrect,
    );
    return correct.id;
  }

  it('lista as áreas do conhecimento', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    expect(res.body[0]).toHaveProperty('topics');
  });

  it('busca questões com paginação e não revela o gabarito na listagem', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=50')
      .set(auth())
      .expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.items[0].alternatives[0]).not.toHaveProperty('isCorrect');
  });

  it('filtra questões por nível de dificuldade', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/questions?difficulty=1')
      .set(auth())
      .expect(200);
    for (const q of res.body.items) {
      expect(q.difficulty).toBe(1);
    }
  });

  it('registra uma tentativa correta e uma incorreta', async () => {
    const list = await request(app.getHttpServer())
      .get(`${SEED_QUESTIONS_URL}&limit=1`)
      .set(auth())
      .expect(200);
    const question = list.body.items[0];
    const correctId = await correctAlternativeId(question.id);

    const ok = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId: question.id, chosenId: correctId, timeSpentSec: 12 })
      .expect(201);
    expect(ok.body.isCorrect).toBe(true);
    expect(ok.body.correctAlternativeId).toBe(correctId);
    expect(ok.body.explanation).toBeTruthy();

    const wrongId = question.alternatives.find(
      (a: { id: string }) => a.id !== correctId,
    ).id;
    const bad = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId: question.id, chosenId: wrongId })
      .expect(201);
    expect(bad.body.isCorrect).toBe(false);
  });

  it('lista os templates de simulado disponíveis', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/simulations/templates')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const t = res.body.find(
      (x: { id: string }) => x.id === 'seed-template-math',
    );
    expect(t).toMatchObject({ scope: 'AREA' });
    expect(t.questionCount).toBeGreaterThan(0);
    expect(t.subject).toHaveProperty('name');
  });

  it('inicia simulado personalizado com filtros e contagem (issue #40)', async () => {
    // Matéria com questões no seed (Matemática).
    const subs = await request(app.getHttpServer())
      .get('/api/v1/subjects')
      .set(auth())
      .expect(200);
    const matematica = subs.body.find((s: { name: string }) =>
      s.name.includes('Matem'),
    );

    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({
        templateId: 'seed-template-custom',
        subjectId: matematica.id,
        questionCount: 3,
        pareto: true,
      })
      .expect(201);
    expect(start.body.questions.length).toBeLessThanOrEqual(3);
    // Todas as questões são da matéria pedida.
    for (const q of start.body.questions) {
      expect(q.topic.subject.id).toBe(matematica.id);
    }
    // Tempo proporcional: >= 3 min/questão, nunca abaixo de 5.
    expect(start.body.timeLimitMin).toBeGreaterThanOrEqual(5);
  });

  it('rejeita simulado personalizado com matéria inexistente (issue #40)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({
        templateId: 'seed-template-custom',
        subjectId: 'nao-existe',
      })
      .expect(400);
  });

  it('inicia e finaliza um simulado, corrigindo tudo certo = 100%', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth())
      .send({ templateId: 'seed-template-math' })
      .expect(201);
    expect(start.body.questions.length).toBeGreaterThan(0);
    // Questões do simulado não trazem o gabarito.
    expect(start.body.questions[0].alternatives[0]).not.toHaveProperty(
      'isCorrect',
    );

    const answers = [];
    for (const q of start.body.questions) {
      answers.push({
        questionId: q.id,
        chosenId: await correctAlternativeId(q.id),
      });
    }

    const finish = await request(app.getHttpServer())
      .post(`/api/v1/simulations/${start.body.id}/finish`)
      .set(auth())
      .send({ answers })
      .expect(201);
    expect(finish.body.total).toBe(answers.length);
    expect(finish.body.correct).toBe(answers.length);
    expect(finish.body.percentage).toBe(100);
    // Os detalhes alimentam o gabarito comentado no frontend.
    expect(finish.body.details.length).toBe(answers.length);
    expect(finish.body.details[0]).toHaveProperty('explanation');
    expect(finish.body.details[0]).toHaveProperty('chosenId');
    expect(finish.body.details[0].correctAlternativeId).toBe(
      finish.body.details[0].chosenId,
    );

    // Finalizar de novo deve falhar.
    await request(app.getHttpServer())
      .post(`/api/v1/simulations/${start.body.id}/finish`)
      .set(auth())
      .send({ answers })
      .expect(400);
  });

  it('expõe o desempenho agregado por área e assunto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/performance')
      .set(auth())
      .expect(200);
    expect(res.body.overall.total).toBeGreaterThan(0);
    expect(res.body.bySubject.length).toBeGreaterThan(0);
    expect(res.body.bySubject[0]).toHaveProperty('accuracy');
    // Série temporal para o gráfico de evolução.
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(res.body.timeline.length).toBeGreaterThan(0);
    expect(res.body.timeline[0]).toHaveProperty('date');
    expect(res.body.timeline[0]).toHaveProperty('accuracy');
  });

  it('retorna a fila de revisão (array) e 404 para item inexistente', async () => {
    const queue = await request(app.getHttpServer())
      .get('/api/v1/review/queue')
      .set(auth())
      .expect(200);
    expect(Array.isArray(queue.body)).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/review/nao-existe')
      .set(auth())
      .send({ quality: 4 })
      .expect(404);
  });

  it('bloqueia acesso sem token', async () => {
    await request(app.getHttpServer()).get('/api/v1/subjects').expect(401);
  });
});
