import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Hardening (issue #49): validação de posse do simulationId, rate limiting
// do auth e transação/idempotência do finish(). Os limites de throttle são
// maiores que os do controller para não flakar por conta de outros specs.
describe('Hardening (e2e)', () => {
  let app: INestApplication<App>;
  let tokenA: string;
  let tokenB: string;
  let emailA: string;
  let emailB: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Sem isso o ThrottlerStorageService não limpa seus timers no close()
    // e o worker do Jest é forçado a sair (leak warning).
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

    emailA = `hard_a_${Date.now()}@exemplo.com`;
    emailB = `hard_b_${Date.now()}@exemplo.com`;
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailA, password: 'senhaForte123' })
      .expect(201);
    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailB, password: 'senhaForte123' })
      .expect(201);
    tokenA = regA.body.accessToken;
    tokenB = regB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function firstQuestion(): Promise<{
    id: string;
    alternatives: { id: string }[];
  }> {
    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=1')
      .set(auth(tokenA))
      .expect(200);
    return list.body.items[0];
  }

  async function correctAlternativeId(questionId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/questions/${questionId}`)
      .set(auth(tokenA))
      .expect(200);
    const correct = res.body.alternatives.find(
      (a: { isCorrect: boolean }) => a.isCorrect,
    );
    return correct.id;
  }

  it('POST /answers rejeita simulationId inexistente com 404', async () => {
    const q = await firstQuestion();
    await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth(tokenA))
      .send({ questionId: q.id, chosenId: null, simulationId: 'nao-existe' })
      .expect(404);
  });

  it('POST /answers rejeita simulado de outro usuário com 403', async () => {
    // Usuário B inicia um simulado; usuário A tenta gravar resposta nele.
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth(tokenB))
      .send({ templateId: 'seed-template-math' })
      .expect(201);

    const q = await firstQuestion();
    await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth(tokenA))
      .send({ questionId: q.id, chosenId: null, simulationId: start.body.id })
      .expect(403);
  });

  it('POST /answers aceita simulationId próprio (fluxo normal)', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth(tokenA))
      .send({ templateId: 'seed-template-math' })
      .expect(201);

    const q = await firstQuestion();
    const res = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth(tokenA))
      .send({ questionId: q.id, chosenId: null, simulationId: start.body.id })
      .expect(201);
    expect(res.body).toHaveProperty('isCorrect');
  });

  it('finish() é atômico: segunda finalização não duplica respostas', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth(tokenA))
      .send({ templateId: 'seed-template-math' })
      .expect(201);

    const answers = [];
    for (const q of start.body.questions) {
      answers.push({
        questionId: q.id,
        chosenId: await correctAlternativeId(q.id),
      });
    }

    const finish = await request(app.getHttpServer())
      .post(`/api/v1/simulations/${start.body.id}/finish`)
      .set(auth(tokenA))
      .send({ answers })
      .expect(201);
    expect(finish.body.correct).toBe(answers.length);

    // Reenvio (falha de rede/retry do cliente) deve falhar sem duplicar estado.
    await request(app.getHttpServer())
      .post(`/api/v1/simulations/${start.body.id}/finish`)
      .set(auth(tokenA))
      .send({ answers })
      .expect(400);

    // O número de respostas do simulado permanece o da 1ª finalização.
    const sim = await request(app.getHttpServer())
      .get(`/api/v1/simulations/${start.body.id}`)
      .set(auth(tokenA))
      .expect(200);
    expect(sim.body.answersCount).toBe(answers.length);
  });

  it('POST /auth/login respeita rate limiting após muitas tentativas', async () => {
    // Instância dedicada: o storage do throttler é in-memory por app, então
    // este burst não vaza para as demais suítes/instâncias. O limite vem do
    // @Throttle do controller (10 logins/min).
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const throttleApp = moduleFixture.createNestApplication<App>();
    throttleApp.enableShutdownHooks();
    throttleApp.setGlobalPrefix('api/v1', {
      exclude: [
        { path: '', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
      ],
    });
    await throttleApp.init();
    try {
      let saw429 = false;
      for (let i = 0; i < 12; i++) {
        const res = await request(throttleApp.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'nao-existe@exemplo.com', password: 'x' });
        if (res.status === 429) {
          saw429 = true;
          break;
        }
        expect([200, 401]).toContain(res.status);
      }
      expect(saw429).toBe(true);
    } finally {
      await throttleApp.close();
    }
  });

  it('GET /health permanece acessível mesmo com throttle', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
