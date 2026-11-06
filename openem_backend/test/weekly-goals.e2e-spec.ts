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
import { testNickname } from './nickname';

describe('Metas semanais (issue #44, e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `goals_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /weekly-goals começa vazio', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/weekly-goals')
      .set(auth())
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /weekly-goals sem nenhum alvo retorna 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(auth())
      .send({ subjectId: 'x' })
      .expect(400);
  });

  it('POST cria meta de questões com progresso calculado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(auth())
      .send({ targetQuestions: 20 })
      .expect(201);
    expect(res.body).toMatchObject({
      targetQuestions: 20,
      targetMinutes: 0,
      questionsDone: 0,
      minutesDone: 0,
      completed: false,
    });
    expect(res.body.weekStart).toBeDefined();
  });

  it('POST cria meta de minutos e a lista traz ambas com escopos', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(auth())
      .send({ targetMinutes: 120 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/weekly-goals')
      .set(auth())
      .expect(200);
    expect(list.body).toHaveLength(2);
  });

  it('PATCH atualiza o alvo de uma meta própria', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(auth())
      .send({ targetQuestions: 5 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/weekly-goals/${created.body.id}`)
      .set(auth())
      .send({ targetQuestions: 50 })
      .expect(200);
    expect(res.body.targetQuestions).toBe(50);
  });

  it('PATCH/DELETE de meta de outro usuário retorna 404', async () => {
    // Segundo usuário dono da meta.
    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `other_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    const goal = await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .send({ targetQuestions: 3 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/weekly-goals/${goal.body.id}`)
      .set(auth())
      .send({ targetQuestions: 99 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/weekly-goals/${goal.body.id}`)
      .set(auth())
      .expect(404);
  });

  it('DELETE remove meta própria', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(auth())
      .send({ targetMinutes: 60 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/weekly-goals/${created.body.id}`)
      .set(auth())
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/weekly-goals')
      .set(auth())
      .expect(200);
    expect(
      list.body.some((g: { id: string }) => g.id === created.body.id),
    ).toBe(false);
  });

  it('meta de minutos soma o Pomodoro e os blocos concluídos do cronograma', async () => {
    // Aluno novo: nenhum tempo de outros testes entra na conta.
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        nickname: testNickname(),
        email: `wg_minutos_${Date.now()}@exemplo.com`,
        password: 'senhaForte123',
        acceptTerms: true,
      })
      .expect(201);
    const mine = { Authorization: `Bearer ${reg.body.accessToken}` };

    const goal = await request(app.getHttpServer())
      .post('/api/v1/weekly-goals')
      .set(mine)
      .send({ targetMinutes: 60 })
      .expect(201);
    expect(goal.body.minutesDone).toBe(0);

    const focus = await request(app.getHttpServer())
      .post('/api/v1/pomodoro/sessions/start')
      .set(mine)
      .send({ durationSec: 25 * 60 })
      .expect(201);
    await prisma.focusSession.update({
      where: { id: focus.body.id },
      data: { startedAt: new Date(Date.now() - 25 * 60_000) },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/pomodoro/sessions/${focus.body.id}/complete`)
      .set(mine)
      .expect(201);

    // Bloco de hoje (dayIndex 0 de um plano criado agora), marcado como feito.
    const block = await request(app.getHttpServer())
      .post('/api/v1/study-plan/sessions')
      .set(mine)
      .send({ label: 'Revisar simulado', dayIndex: 0, minutes: 45 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/study-plan/sessions/${block.body.id}`)
      .set(mine)
      .send({ done: true })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/weekly-goals')
      .set(mine)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ minutesDone: 70, completed: true });
  });

  it('sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/weekly-goals').expect(401);
  });
});
