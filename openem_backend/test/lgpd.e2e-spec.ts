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
import { TERMS_VERSION } from './../src/common/terms';
import { PrismaService } from './../src/prisma/prisma.service';
import { SEED_QUESTIONS_URL } from './seed-questions';
import { testNickname } from './nickname';

// Direitos do titular (LGPD, art. 18) e o que o cadastro grava: aceite dos
// termos, exportação de todos os dados, exclusão da conta com a senha atual
// e, no fórum, apagar o que é seu e denunciar o que é dos outros.
describe('LGPD: aceite, exportação, exclusão e fórum (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'senhaForte123';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const http = () => request(app.getHttpServer());

  async function register(prefix: string) {
    const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@exemplo.com`;
    const reg = await http()
      .post('/api/v1/auth/register')
      .send({ nickname: testNickname(), email, password, acceptTerms: true })
      .expect(201);
    return {
      email,
      token: reg.body.accessToken as string,
      id: reg.body.user.id as string,
    };
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('aceite no cadastro', () => {
    it('sem acceptTerms, ou com false, não cria a conta', async () => {
      const email = `sem_aceite_${Date.now()}@exemplo.com`;
      const res = await http()
        .post('/api/v1/auth/register')
        .send({ nickname: testNickname(), email, password })
        .expect(400);
      expect(String(res.body.message)).toMatch(/Termos de Uso/);
      await http()
        .post('/api/v1/auth/register')
        .send({ nickname: testNickname(), email, password, acceptTerms: false })
        .expect(400);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it('com o aceite, grava a data e a versão dos termos', async () => {
      const antes = Date.now();
      const { email } = await register('aceite');
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.termsVersion).toBe(TERMS_VERSION);
      expect(user.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(
        antes - 1000,
      );
    });
  });

  describe('exportação e exclusão', () => {
    let aluno: { email: string; token: string; id: string };
    let outro: { email: string; token: string; id: string };
    let temaDoOutro: string;
    let topicoDoAluno: string;
    let respostaDoOutro: string;

    beforeAll(async () => {
      aluno = await register('titular');
      outro = await register('titular_outro');
      const t = auth(aluno.token);

      await http()
        .put('/api/v1/users/me/profile')
        .set(t)
        .send({ displayName: 'Titular' })
        .expect(200);

      // Uma resposta e um favorito.
      const lista = await http()
        .get(`${SEED_QUESTIONS_URL}&limit=1`)
        .set(t)
        .expect(200);
      const questao = lista.body.items[0];
      await http()
        .post('/api/v1/answers')
        .set(t)
        .send({
          questionId: questao.id,
          chosenId: questao.alternatives[0].id,
        })
        .expect(201);
      await http()
        .post('/api/v1/favorites')
        .set(t)
        .send({ questionId: questao.id })
        .expect(201);

      // Simulado personalizado salvo e um simulado feito com ele: o FK
      // simulado → modelo é RESTRICT, e a cascata tem de apagar os dois.
      const modelo = await http()
        .post('/api/v1/simulations/templates')
        .set(t)
        .send({ name: 'Meu recorte', questionCount: 3 })
        .expect(201);
      await http()
        .post('/api/v1/simulations')
        .set(t)
        .send({ templateId: modelo.body.id })
        .expect(201);

      // Tópico do aluno com a resposta de outro aluno.
      const topico = await http()
        .post('/api/v1/community/threads')
        .set(t)
        .send({ title: 'Tópico do titular', body: 'corpo' })
        .expect(201);
      topicoDoAluno = topico.body.id;
      const resposta = await http()
        .post(`/api/v1/community/threads/${topicoDoAluno}/posts`)
        .set(auth(outro.token))
        .send({ body: 'resposta do outro' })
        .expect(201);
      respostaDoOutro = resposta.body.id;

      // O aluno curte o tema publicado de outro aluno.
      const cores = (hex: string) =>
        Object.fromEntries(THEME_TOKEN_KEYS.map((k) => [k, hex]));
      const tema = await http()
        .post('/api/v1/themes')
        .set(auth(outro.token))
        .send({
          name: `Tema ${Date.now()}`,
          light: cores('#f5f1f6'),
          dark: cores('#15111c'),
        })
        .expect(201);
      temaDoOutro = tema.body.id;
      await http()
        .patch(`/api/v1/themes/${temaDoOutro}`)
        .set(auth(outro.token))
        .send({ isPublic: true })
        .expect(200);
      await http()
        .post(`/api/v1/themes/${temaDoOutro}/like`)
        .set(t)
        .expect(201);
    });

    it('exportação exige login', async () => {
      await http().get('/api/v1/users/me/export').expect(401);
    });

    it('baixa um JSON com os dados do aluno, sem o hash da senha', async () => {
      const res = await http()
        .get('/api/v1/users/me/export')
        .set(auth(aluno.token))
        .expect(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="openem-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).not.toMatch(/passwordHash|\$argon2/);

      const dados = res.body;
      expect(dados.format).toBe('openem-export');
      expect(dados.account).toMatchObject({
        id: aluno.id,
        email: aluno.email,
        termsVersion: TERMS_VERSION,
      });
      expect(dados.profile.displayName).toBe('Titular');
      expect(dados.answers).toHaveLength(1);
      expect(dados.favorites).toHaveLength(1);
      expect(dados.simulationTemplates).toHaveLength(1);
      expect(dados.simulations).toHaveLength(1);
      expect(dados.simulations[0].questions.length).toBeGreaterThan(0);
      expect(dados.forumThreads.map((t: { id: string }) => t.id)).toEqual([
        topicoDoAluno,
      ]);
      expect(dados.themeLikes).toHaveLength(1);
      expect(dados.gamification).toBeDefined();
      // A resposta do outro aluno no tópico não é dado deste aluno.
      expect(dados.forumPosts).toEqual([]);
      expect(res.text).not.toContain(outro.email);
    });

    it('sem senha é 400 e com a senha errada é 403; a conta continua', async () => {
      await http()
        .delete('/api/v1/users/me')
        .set(auth(aluno.token))
        .send({})
        .expect(400);
      const errada = await http()
        .delete('/api/v1/users/me')
        .set(auth(aluno.token))
        .send({ password: 'senhaErrada123' })
        .expect(403);
      expect(errada.body.message).toBe('Senha incorreta');
      await http().get('/api/v1/users/me').set(auth(aluno.token)).expect(200);
    });

    it('com a senha certa, apaga tudo e responde 204', async () => {
      const curtidasAntes = (
        await prisma.userTheme.findUniqueOrThrow({
          where: { id: temaDoOutro },
        })
      ).likes;

      await http()
        .delete('/api/v1/users/me')
        .set(auth(aluno.token))
        .send({ password })
        .expect(204);

      expect(await prisma.user.findUnique({ where: { id: aluno.id } })).toBe(
        null,
      );
      const restos = await Promise.all([
        prisma.profile.count({ where: { userId: aluno.id } }),
        prisma.answer.count({ where: { userId: aluno.id } }),
        prisma.favorite.count({ where: { userId: aluno.id } }),
        prisma.simulation.count({ where: { userId: aluno.id } }),
        prisma.simulationTemplate.count({ where: { ownerId: aluno.id } }),
        prisma.forumThread.count({ where: { userId: aluno.id } }),
        prisma.userThemeLike.count({ where: { userId: aluno.id } }),
        prisma.gamificationStat.count({ where: { userId: aluno.id } }),
      ]);
      expect(restos).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      // O tópico levou a resposta do outro aluno junto.
      expect(
        await prisma.forumPost.findUnique({ where: { id: respostaDoOutro } }),
      ).toBeNull();
      // A curtida saiu do total do tema do outro aluno.
      const tema = await prisma.userTheme.findUniqueOrThrow({
        where: { id: temaDoOutro },
      });
      expect(tema.likes).toBe(curtidasAntes - 1);
      // O outro aluno segue com a conta.
      await http().get('/api/v1/users/me').set(auth(outro.token)).expect(200);
    });

    it('o token da conta excluída deixa de valer', async () => {
      await http().get('/api/v1/users/me').set(auth(aluno.token)).expect(401);
      await http()
        .get('/api/v1/users/me/export')
        .set(auth(aluno.token))
        .expect(401);
    });

    it('o e-mail fica livre para um cadastro novo', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send({
          nickname: testNickname(),
          email: aluno.email,
          password,
          acceptTerms: true,
        })
        .expect(201);
    });
  });

  describe('limites', () => {
    it('a exportação aceita 5 pedidos em 10 minutos; o sexto é 429', async () => {
      const { token } = await register('limite_export');
      for (let i = 0; i < 5; i++) {
        await http()
          .get('/api/v1/users/me/export')
          .set(auth(token))
          .expect(200);
      }
      const res = await http()
        .get('/api/v1/users/me/export')
        .set(auth(token))
        .expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('a quinta senha errada na exclusão bloqueia a conta, também no login', async () => {
      const { email, token } = await register('limite_exclusao');
      for (let i = 0; i < 4; i++) {
        await http()
          .delete('/api/v1/users/me')
          .set(auth(token))
          .send({ password: 'senhaErrada123' })
          .expect(403);
      }
      const bloqueio = await http()
        .delete('/api/v1/users/me')
        .set(auth(token))
        .send({ password: 'senhaErrada123' })
        .expect(429);
      expect(Number(bloqueio.headers['retry-after'])).toBeGreaterThan(0);
      // Bloqueada, nem a senha certa apaga, e o login vê o mesmo bloqueio.
      await http()
        .delete('/api/v1/users/me')
        .set(auth(token))
        .send({ password })
        .expect(429);
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(429);
    });
  });

  describe('fórum: apagar o que é seu e denunciar', () => {
    let autor: { token: string };
    let leitor: { token: string };
    let topico: string;
    let respostaDoLeitor: string;

    beforeAll(async () => {
      autor = await register('forum_autor');
      leitor = await register('forum_leitor');
      const t = await http()
        .post('/api/v1/community/threads')
        .set(auth(autor.token))
        .send({ title: 'Dúvida de física', body: 'corpo' })
        .expect(201);
      topico = t.body.id;
      const r = await http()
        .post(`/api/v1/community/threads/${topico}/posts`)
        .set(auth(leitor.token))
        .send({ body: 'resposta do leitor' })
        .expect(201);
      respostaDoLeitor = r.body.id;
    });

    it('não apaga o tópico nem a resposta de outro aluno (404)', async () => {
      await http()
        .delete(`/api/v1/community/threads/${topico}`)
        .set(auth(leitor.token))
        .expect(404);
      await http()
        .delete(`/api/v1/community/threads/${topico}/posts/${respostaDoLeitor}`)
        .set(auth(autor.token))
        .expect(404);
      await http()
        .get(`/api/v1/community/threads/${topico}`)
        .set(auth(autor.token))
        .expect(200);
    });

    it('denuncia o tópico e a resposta de outro aluno, com o motivo', async () => {
      await http()
        .post(`/api/v1/community/threads/${topico}/report`)
        .set(auth(leitor.token))
        .send({ reason: 'Spam' })
        .expect(201, { reported: true });
      await http()
        .post(
          `/api/v1/community/threads/${topico}/posts/${respostaDoLeitor}/report`,
        )
        .set(auth(autor.token))
        .send({ reason: 'Ofensa a outro aluno' })
        .expect(201);
      const denuncias = await prisma.forumReport.findMany({
        where: { threadId: topico },
        orderBy: { createdAt: 'asc' },
      });
      expect(denuncias.map((d) => [d.postId, d.reason])).toEqual([
        [null, 'Spam'],
        [respostaDoLeitor, 'Ofensa a outro aluno'],
      ]);
    });

    it('recusa denúncia sem motivo e a do próprio texto', async () => {
      await http()
        .post(`/api/v1/community/threads/${topico}/report`)
        .set(auth(leitor.token))
        .send({ reason: '' })
        .expect(400);
      await http()
        .post(`/api/v1/community/threads/${topico}/report`)
        .set(auth(autor.token))
        .send({ reason: 'Meu próprio tópico' })
        .expect(400);
    });

    it('cada um apaga o seu: a resposta e depois o tópico, com as denúncias', async () => {
      await http()
        .delete(`/api/v1/community/threads/${topico}/posts/${respostaDoLeitor}`)
        .set(auth(leitor.token))
        .expect(200, { removed: true });
      await http()
        .delete(`/api/v1/community/threads/${topico}`)
        .set(auth(autor.token))
        .expect(200, { removed: true });
      await http()
        .get(`/api/v1/community/threads/${topico}`)
        .set(auth(autor.token))
        .expect(404);
      expect(
        await prisma.forumReport.count({ where: { threadId: topico } }),
      ).toBe(0);
    });
  });
});
