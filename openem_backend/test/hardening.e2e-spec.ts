import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { parseTrustProxy } from './../src/common/trust-proxy';

// Hardening (issue #49): validação de posse do simulationId, rate limiting
// do auth e transação/idempotência do finish(). Os limites de throttle são
// maiores que os do controller para não flakar por conta de outros specs.
// Também guarda as correções do pentest:
// - rate limiting pelo IP real atrás de proxy (TRUST_PROXY)
// - simulado corrigido só pelas próprias questões
// - minigames fora da API
// - um voto por aluno em deck público
// - teto no texto da redação
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

    const q = start.body.questions[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth(tokenA))
      .send({ questionId: q.id, chosenId: null, simulationId: start.body.id })
      .expect(201);
    expect(res.body).toHaveProperty('isCorrect');
  });

  it('POST /answers recusa questão que não faz parte do simulado (400)', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth(tokenA))
      .send({ templateId: 'seed-template-math' })
      .expect(201);
    const doSimulado = new Set(
      start.body.questions.map((q: { id: string }) => q.id),
    );

    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=50')
      .set(auth(tokenA))
      .expect(200);
    const intrusa = list.body.items.find(
      (q: { id: string }) => !doSimulado.has(q.id),
    );
    expect(intrusa).toBeDefined();

    const res = await request(app.getHttpServer())
      .post('/api/v1/answers')
      .set(auth(tokenA))
      .send({ questionId: intrusa.id, simulationId: start.body.id })
      .expect(400);
    expect(res.body.message).toMatch(/não faz parte do simulado/);
  });

  it('finish() corrige só as questões do simulado: intrusa não conta, faltante fica em branco', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/simulations')
      .set(auth(tokenA))
      .send({ templateId: 'seed-template-math' })
      .expect(201);
    const questoes: { id: string }[] = start.body.questions;
    expect(questoes.length).toBeGreaterThan(1);
    const doSimulado = new Set(questoes.map((q) => q.id));

    // Gabarito de questões de fora do simulado (ele é público pela API).
    const list = await request(app.getHttpServer())
      .get('/api/v1/questions?limit=50')
      .set(auth(tokenA))
      .expect(200);
    const intrusas = list.body.items
      .filter((q: { id: string }) => !doSimulado.has(q.id))
      .slice(0, 5);
    expect(intrusas.length).toBeGreaterThan(0);
    const answers = [
      // Só a primeira questão do simulado, e certa.
      {
        questionId: questoes[0].id,
        chosenId: await correctAlternativeId(questoes[0].id),
      },
    ];
    for (const q of intrusas) {
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
    expect(finish.body.total).toBe(questoes.length);
    expect(finish.body.correct).toBe(1);
    expect(
      finish.body.details.map((d: { questionId: string }) => d.questionId),
    ).toEqual(questoes.map((q) => q.id));

    // Uma resposta gravada por questão do simulado, nenhuma para as intrusas.
    const sim = await request(app.getHttpServer())
      .get(`/api/v1/simulations/${start.body.id}`)
      .set(auth(tokenA))
      .expect(200);
    expect(sim.body.answersCount).toBe(questoes.length);
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

  describe('rate limiting atrás de proxy (TRUST_PROXY)', () => {
    // Instância dedicada por teste: o storage do throttler é in-memory por app.
    async function appDedicada(trustProxy?: string) {
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const dedicada =
        moduleFixture.createNestApplication<NestExpressApplication>();
      dedicada.enableShutdownHooks();
      const valor = parseTrustProxy(trustProxy);
      if (valor !== undefined) dedicada.set('trust proxy', valor);
      dedicada.setGlobalPrefix('api/v1', {
        exclude: [
          { path: '', method: RequestMethod.GET },
          { path: 'health', method: RequestMethod.GET },
        ],
      });
      await dedicada.init();
      return dedicada;
    }

    /** Esgota o limite de login (10/min) a partir de um IP. */
    async function esgotaLogin(dedicada: NestExpressApplication, ip: string) {
      for (let i = 0; i < 10; i++) {
        await request(dedicada.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: 'nao-existe@exemplo.com', password: 'x' })
          .expect(401);
      }
    }

    it('com o proxy confiável, o atacante não bloqueia o login dos outros', async () => {
      const dedicada = await appDedicada('1');
      try {
        await esgotaLogin(dedicada, '203.0.113.10');
        // O próprio atacante fica bloqueado...
        await request(dedicada.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '203.0.113.10')
          .send({ email: 'nao-existe@exemplo.com', password: 'x' })
          .expect(429);
        // ...e o aluno, em outro IP, entra normalmente.
        const aluno = await request(dedicada.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '198.51.100.20')
          .send({ email: emailA, password: 'senhaForte123' })
          .expect(200);
        expect(aluno.body.accessToken).toBeDefined();
      } finally {
        await dedicada.close();
      }
    });

    it('vale o endereço que o proxy acrescenta, não o que o cliente escreve', async () => {
      const dedicada = await appDedicada('1');
      try {
        // O nginx acrescenta o IP real ao fim da lista; o início é do cliente.
        await esgotaLogin(dedicada, '1.1.1.1, 203.0.113.10');
        await request(dedicada.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '9.9.9.9, 203.0.113.10')
          .send({ email: 'nao-existe@exemplo.com', password: 'x' })
          .expect(429);
      } finally {
        await dedicada.close();
      }
    });

    it('sem TRUST_PROXY, X-Forwarded-For forjado não escapa do limite', async () => {
      const dedicada = await appDedicada(undefined);
      try {
        await esgotaLogin(dedicada, '203.0.113.10');
        await request(dedicada.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '198.51.100.20')
          .send({ email: 'nao-existe@exemplo.com', password: 'x' })
          .expect(429);
      } finally {
        await dedicada.close();
      }
    });
  });

  describe('voto em deck de flashcards', () => {
    async function criaDeck(token: string, isPublic: boolean) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/flashcards/decks')
        .set(auth(token))
        .send({
          title: `Deck ${isPublic ? 'público' : 'privado'}`,
          description: 'e2e',
          subject: 'Matemática e suas Tecnologias',
          isPublic,
        })
        .expect(201);
      return res.body.id as string;
    }

    function vota(token: string, deckId: string, vote: string) {
      return request(app.getHttpServer())
        .post(`/api/v1/flashcards/decks/${deckId}/vote`)
        .set(auth(token))
        .send({ vote });
    }

    it('conta um voto por aluno, e trocar de sentido move o voto', async () => {
      const deckId = await criaDeck(tokenB, true);

      for (let i = 0; i < 5; i++) {
        await vota(tokenA, deckId, 'down').expect(201);
      }
      const repetido = await vota(tokenA, deckId, 'down').expect(201);
      expect(repetido.body).toMatchObject({
        upvotes: 0,
        downvotes: 1,
        myVote: 'down',
      });

      const trocado = await vota(tokenA, deckId, 'up').expect(201);
      expect(trocado.body).toMatchObject({ upvotes: 1, downvotes: 0 });

      // O voto de outro aluno soma por conta própria.
      const outro = await vota(tokenB, deckId, 'up').expect(201);
      expect(outro.body).toMatchObject({ upvotes: 2, downvotes: 0 });
    });

    it('deck privado não recebe voto (403)', async () => {
      const deckId = await criaDeck(tokenB, false);
      await vota(tokenA, deckId, 'down').expect(403);
    });

    it('deck inexistente responde 404, e não 500', async () => {
      await vota(tokenA, 'nao-existe', 'up').expect(404);
    });

    it('voto fora de up/down é recusado pela validação', async () => {
      const deckId = await criaDeck(tokenB, true);
      await vota(tokenA, deckId, 'banana').expect(400);
    });
  });

  it('as rotas de minigame saíram da API', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/games/scores')
      .set(auth(tokenA))
      .send({ gameKey: 'calculo-mental', score: 100000, level: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/games')
      .set(auth(tokenA))
      .expect(404);
  });

  it('redação acima do teto de caracteres é recusada (400)', async () => {
    const prompts = await request(app.getHttpServer())
      .get('/api/v1/essays/prompts')
      .set(auth(tokenA))
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/essays/submissions')
      .set(auth(tokenA))
      .send({ promptId: prompts.body[0].id, content: 'a'.repeat(8001) })
      .expect(400);
  });
});
