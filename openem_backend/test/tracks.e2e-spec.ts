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
import { TRACKS } from './../src/tracks/tracks-catalog';
import { testNickname } from './nickname';
import { SEED_QUESTIONS_URL } from './seed-questions';

describe('Matérias e trilhas (discussão #122, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function register(prefix: string): Promise<string> {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@exemplo.com`,
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
    prisma = app.get(PrismaService);
    tokenA = await register('trilhas_a');
    tokenB = await register('trilhas_b');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige login', async () => {
    await request(app.getHttpServer()).get('/api/v1/tracks').expect(401);
  });

  it('aluno novo vê todas as matérias com trilha e por onde começar', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tracks')
      .set(auth(tokenA))
      .expect(200);
    expect(
      res.body.subjects.map((s: { name: string }) => s.name).sort(),
    ).toEqual(TRACKS.map((t) => t.subject).sort());
    expect(res.body.overall).toMatchObject({
      mastery: 0,
      answered: 0,
      enough: false,
    });
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.language).toBe('ingles');
  });

  it('as respostas do aluno entram no domínio só dele', async () => {
    const list = await request(app.getHttpServer())
      .get(`${SEED_QUESTIONS_URL}&limit=50`)
      .set(auth(tokenA))
      .expect(200);
    const question = list.body.items.find(
      (q: { topic: unknown }) => q.topic !== null,
    );
    expect(question).toBeDefined();
    const correct = await prisma.alternative.findFirst({
      where: { questionId: question.id, isCorrect: true },
      select: { id: true },
    });
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/answers')
        .set(auth(tokenA))
        .send({ questionId: question.id, chosenId: correct!.id })
        .expect(201);
    }

    const subjectId = question.topic.subject.id as string;
    const trilhaA = await request(app.getHttpServer())
      .get(`/api/v1/tracks/${subjectId}`)
      .set(auth(tokenA))
      .expect(200);
    const topicos = [
      ...trilhaA.body.stages.flatMap((s: { topics: unknown[] }) => s.topics),
      ...trilhaA.body.extras.topics,
    ] as { id: string; answered: number; state: string; accuracy: number }[];
    const doAluno = topicos.find((t) => t.id === question.topic.id);
    expect(doAluno).toMatchObject({
      answered: 3,
      state: 'praticando',
      accuracy: 100,
    });

    const trilhaB = await request(app.getHttpServer())
      .get(`/api/v1/tracks/${subjectId}`)
      .set(auth(tokenB))
      .expect(200);
    expect(trilhaB.body.answered).toBe(0);
  });

  it('matéria sem trilha é 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/tracks/nao-existe')
      .set(auth(tokenA))
      .expect(404);
  });
});
