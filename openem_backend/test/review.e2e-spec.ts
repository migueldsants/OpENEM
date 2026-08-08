import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Review — próxima revisão agendada (issue #20, e2e)', () => {
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
        email: `review20_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
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

  it('GET /review/next sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/review/next').expect(401);
  });

  it('retorna null quando não há revisão agendada', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/review/next')
      .set(auth())
      .expect(200);
    // NestJS serializa null como `null` (ou corpo vazio); aceita ambos.
    expect([null, 'null', '']).toContain(res.text);
  });

  it('após responder uma questão correta, retorna a próxima revisão agendada', async () => {
    // Usuário novo ainda não tem revisão — confirma null antes de responder.
    const before = await request(app.getHttpServer())
      .get('/api/v1/review/next')
      .set(auth())
      .expect(200);
    expect([null, 'null', '']).toContain(before.text);

    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=1')
      .set(auth())
      .expect(200);
    const question = list.body.items[0];
    const correctId = await correctAlternativeId(question.id);

    await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth())
      .send({ questionId: question.id, chosenId: correctId, timeSpentSec: 10 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/api/v1/review/next')
      .set(auth())
      .expect(200);
    expect(res.body).not.toBeNull();
    expect(res.body.id).toBeDefined();
    expect(res.body.topic).toBeDefined();
    expect(res.body.topic.subject).toBeDefined();
    // dueAt no futuro (a revisão foi recém-agendada).
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(
      Date.now() - 1000,
    );
  });
});
