import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SimulationsService } from './simulations.service';

const TEMPLATE = {
  id: 'seed-template-math',
  name: 'Matemática',
  scope: 'AREA',
  questionCount: 2,
  timeLimitMin: 10,
  subjectId: 'subj-mat',
};

function makePrismaMock() {
  return {
    simulationTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    subjectArea: { findMany: jest.fn().mockResolvedValue([]) },
    examYear: { findMany: jest.fn().mockResolvedValue([]) },
    subject: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    },
    topic: { findMany: jest.fn().mockResolvedValue([]) },
    profile: { findUnique: jest.fn().mockResolvedValue(null) },
    question: {
      findMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    simulation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    answer: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  const review = { recordOutcome: jest.fn().mockResolvedValue(undefined) };
  const gamification = {
    recordActivity: jest.fn().mockResolvedValue(null),
  };
  const service = new SimulationsService(prisma, review, gamification);
  return { service, prisma, review, gamification };
}

/**
 * Prepara a amostragem: `groupBy` devolve os estratos (assunto -> tamanho) e
 * cada `question.findMany` seguinte devolve os ids daquele estrato. A última
 * chamada de findMany e sempre a busca das questoes selecionadas.
 */
function mockPool(
  prisma: any,
  estratos: { topicId: string | null; ids: string[]; weight?: number }[],
  selecionadas: unknown[] = [],
) {
  prisma.question.groupBy.mockResolvedValue(
    estratos.map((e) => ({
      topicId: e.topicId,
      _count: { _all: e.ids.length },
    })),
  );
  prisma.topic.findMany.mockResolvedValue(
    estratos
      .filter((e) => e.topicId !== null)
      .map((e) => ({ id: e.topicId, weight: e.weight ?? 3 })),
  );
  // Leitura por vaga (take: 1, só o id) devolve a linha na posição sorteada
  // do estrato; qualquer outra leitura é a busca das questões selecionadas.
  const porTopico = new Map(estratos.map((e) => [e.topicId, e.ids]));
  prisma.question.findMany.mockImplementation(
    (args: {
      take?: number;
      skip?: number;
      where: { topicId?: string | null };
    }) => {
      if (args.take === 1 && 'topicId' in args.where) {
        const id = porTopico.get(args.where.topicId ?? null)?.[args.skip ?? 0];
        return Promise.resolve(id ? [{ id }] : []);
      }
      return Promise.resolve(selecionadas);
    },
  );
}

describe('SimulationsService', () => {
  describe('listTemplates()', () => {
    it('enriquece templates com o nome da matéria', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findMany.mockResolvedValue([TEMPLATE]);
      prisma.subject.findMany.mockResolvedValue([
        { id: 'subj-mat', name: 'Matemática e suas Tecnologias' },
      ]);

      const res = await service.listTemplates();
      expect(res[0]).toMatchObject({
        id: 'seed-template-math',
        subject: { id: 'subj-mat', name: 'Matemática e suas Tecnologias' },
      });
    });
  });

  describe('start()', () => {
    it('retorna 404 para template inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findUnique.mockResolvedValue(null);
      await expect(
        service.start('u1', { templateId: 'nao-existe' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna 400 quando não há questões no pool', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findUnique.mockResolvedValue(TEMPLATE);
      prisma.question.groupBy.mockResolvedValue([]);
      await expect(
        service.start('u1', { templateId: 'seed-template-math' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Sem estratos, o banco de questões nem chega a ser lido.
      expect(prisma.question.findMany).not.toHaveBeenCalled();
    });

    it('cria o simulado com questões sem gabarito', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findUnique.mockResolvedValue(TEMPLATE);
      mockPool(
        prisma,
        [{ topicId: 't1', ids: ['q1', 'q2', 'q3'] }],
        [
          {
            id: 'q1',
            statement: 's1',
            difficulty: 2,
            topic: { id: 't1', name: 'T1', subject: { id: 's1', name: 'S1' } },
            alternatives: [{ id: 'a1', text: 'alt' }],
          },
        ],
      );
      prisma.simulation.create.mockResolvedValue({
        id: 'sim-1',
        startedAt: new Date(),
      });

      const res = await service.start('u1', {
        templateId: 'seed-template-math',
      });
      expect(res.id).toBe('sim-1');
      expect(res.questionCount).toBe(1);
      expect(res.questions[0].alternatives[0]).not.toHaveProperty('isCorrect');

      // A lista sorteada fica gravada, na ordem da prova: é ela que o finish()
      // corrige.
      const data = prisma.simulation.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        userId: 'u1',
        templateId: 'seed-template-math',
      });
      const gravadas = data.questions.createMany.data;
      expect(gravadas).toHaveLength(2);
      expect(gravadas.map((q: { position: number }) => q.position)).toEqual([
        0, 1,
      ]);
      for (const q of gravadas) {
        expect(['q1', 'q2', 'q3']).toContain(q.questionId);
      }
      expect(gravadas[0].questionId).not.toBe(gravadas[1].questionId);
    });

    it('não grava a mesma questão duas vezes se o sorteio repetir uma linha', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findUnique.mockResolvedValue(TEMPLATE);
      // As duas posições sorteadas devolvem a mesma linha (tabela mudou
      // durante o sorteio).
      mockPool(prisma, [{ topicId: 't1', ids: ['q1', 'q1'] }]);
      prisma.simulation.create.mockResolvedValue({
        id: 'sim-1',
        startedAt: new Date(),
      });

      await service.start('u1', { templateId: 'seed-template-math' });
      const data = prisma.simulation.create.mock.calls[0][0].data;
      expect(data.questions.createMany.data).toEqual([
        { questionId: 'q1', position: 0 },
      ]);
    });

    describe('simulado personalizado por tema', () => {
      const CUSTOM = {
        id: 'seed-template-custom',
        name: 'Personalizado',
        scope: 'CUSTOM',
        questionCount: 10,
        timeLimitMin: null,
        subjectId: null,
        subjectAreaId: null,
        ownerId: null,
        filters: null,
      };

      /** O `where` que chegou ao groupBy, achatado para facilitar a asserção. */
      function whereDoSorteio(prisma: any): Record<string, unknown> {
        const where = prisma.question.groupBy.mock.calls[0][0].where as Record<
          string,
          unknown
        >;
        return where;
      }

      it('400 quando nenhum tema tem questão, com mensagem que ajuda', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.question.groupBy.mockResolvedValue([]);

        await expect(
          service.start('u1', {
            templateId: 'seed-template-custom',
            subjectIds: ['nao-existe'],
          }),
        ).rejects.toThrow(/Nenhuma questão combina/);
      });

      it('filtra o pool por matéria e usa o questionCount do pedido', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [
          { topicId: 't1', ids: Array.from({ length: 12 }, (_, i) => `q${i}`) },
        ]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-c',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectIds: ['subj-mat'],
          questionCount: 5,
        });

        expect(whereDoSorteio(prisma).AND).toContainEqual({
          topic: { subjectId: { in: ['subj-mat'] } },
        });
        // Só as vagas são lidas do banco — uma linha por vaga, nunca o pool.
        const leituras = prisma.question.findMany.mock.calls.slice(0, -1);
        expect(leituras).toHaveLength(5);
        expect(leituras.every((c: any[]) => c[0].take === 1)).toBe(true);
        const ids = prisma.question.findMany.mock.calls.at(-1)[0].where.id.in;
        expect(new Set(ids).size).toBe(5);
      });

      it('área, matéria e assunto SOMAM em vez de se anularem', async () => {
        // Era o bug: pedir matéria + assunto cruzava os dois e devolvia vazio,
        // porque quase nenhuma questão oficial tem assunto classificado.
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: 'topico-x', ids: ['q1'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-t',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectAreaIds: ['area-mat'],
          subjectIds: ['subj-mat'],
          topicIds: ['topico-x'],
        });

        expect(whereDoSorteio(prisma).AND).toContainEqual({
          OR: [
            { subjectAreaId: { in: ['area-mat'] } },
            { topic: { subjectId: { in: ['subj-mat'] } } },
            { topicId: { in: ['topico-x'] } },
          ],
        });
      });

      it('a área alcança as questões oficiais ainda sem assunto', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: null, ids: ['q1', 'q2'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-a',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectAreaIds: ['area-mat'],
        });

        expect(whereDoSorteio(prisma).AND).toContainEqual({
          subjectAreaId: { in: ['area-mat'] },
        });
        // O estrato sem assunto classificado participa do sorteio.
        expect(
          prisma.question.findMany.mock.calls[0][0].where.topicId,
        ).toBeNull();
      });

      it('sem idioma no pedido, usa o do perfil do aluno', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.profile.findUnique.mockResolvedValue({
          foreignLanguage: 'espanhol',
        });
        mockPool(prisma, [{ topicId: 't1', ids: ['q1'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-lang',
          startedAt: new Date(),
        });

        await service.start('u1', { templateId: 'seed-template-custom' });

        // Único recorte: o where é o próprio OR do idioma.
        expect(whereDoSorteio(prisma)).toEqual({
          OR: [{ language: null }, { language: 'espanhol' }],
        });
      });

      it('o idioma do pedido vence o do perfil', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.profile.findUnique.mockResolvedValue({
          foreignLanguage: 'espanhol',
        });
        mockPool(prisma, [{ topicId: 't1', ids: ['q1'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-lang2',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          language: 'ingles',
        });

        expect(whereDoSorteio(prisma)).toEqual({
          OR: [{ language: null }, { language: 'ingles' }],
        });
      });

      it('pareto=true consulta o peso dos assuntos para ponderar o sorteio', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [
          { topicId: 'leve', ids: ['q-leve'], weight: 1 },
          {
            topicId: 'pesada',
            ids: ['q-pesada-1', 'q-pesada-2', 'q-pesada-3'],
            weight: 5,
          },
        ]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-p',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          pareto: true,
          questionCount: 3,
        });

        expect(prisma.topic.findMany).toHaveBeenCalled();
        const lidas = prisma.question.findMany.mock.calls
          .slice(0, -1)
          .reduce((acc: number, c: unknown[]) => {
            const args = c[0] as { take: number };
            return acc + args.take;
          }, 0);
        // 3 vagas distribuídas entre os estratos, nunca mais que o disponível.
        expect(lidas).toBe(3);
      });

      it('sem pareto NÃO consulta pesos (sorteio uniforme)', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: 't1', ids: ['q1', 'q2'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-u',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          questionCount: 2,
        });

        expect(prisma.topic.findMany).not.toHaveBeenCalled();
      });

      it('timeLimitMin proporcional ao questionCount custom', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(
          prisma,
          [
            {
              topicId: 't1',
              ids: Array.from({ length: 10 }, (_, i) => `q${i}`),
            },
          ],
          Array.from({ length: 10 }, (_, i) => ({
            id: `q${i}`,
            statement: 's',
            difficulty: 1,
            topic: { id: 't', name: 'T', subject: { id: 's', name: 'S' } },
            alternatives: [{ id: `a${i}`, text: 'x' }],
          })),
        );
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-l',
          startedAt: new Date(),
        });

        const res = await service.start('u1', {
          templateId: 'seed-template-custom',
          questionCount: 10,
        });
        // 10 questões * 3 min = 30 min.
        expect(res.timeLimitMin).toBe(30);
      });

      it('o tempo escolhido pelo aluno vence o cálculo automático', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: 't1', ids: ['q1', 'q2', 'q3'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-tl',
          startedAt: new Date(),
        });

        const res = await service.start('u1', {
          templateId: 'seed-template-custom',
          questionCount: 3,
          timeLimitMin: 45,
        });
        expect(res.timeLimitMin).toBe(45);
      });

      it('sem templateId, monta o simulado só com os filtros', async () => {
        const { service, prisma } = makeService();
        mockPool(prisma, [{ topicId: 't1', ids: ['q1'] }]);
        prisma.simulationTemplate.upsert.mockResolvedValue({
          id: 'seed-template-custom',
        });
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-sem-template',
          startedAt: new Date(),
        });

        const res = await service.start('u1', { topicIds: ['t1'] });

        expect(prisma.simulationTemplate.findUnique).not.toHaveBeenCalled();
        // O template genérico é criado sob demanda, sem depender do seed.
        expect(prisma.simulationTemplate.upsert).toHaveBeenCalled();
        expect(res.id).toBe('sim-sem-template');
      });

      it('saveAs guarda o recorte como simulado do aluno', async () => {
        const { service, prisma } = makeService();
        mockPool(prisma, [{ topicId: 't1', ids: ['q1'] }]);
        prisma.simulationTemplate.upsert.mockResolvedValue({
          id: 'seed-template-custom',
        });
        prisma.simulationTemplate.create.mockResolvedValue({
          id: 'tpl-salvo',
          name: 'Genética pesada',
          scope: 'CUSTOM',
          questionCount: 10,
          timeLimitMin: 30,
        });
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-save',
          startedAt: new Date(),
        });

        const res = await service.start('u1', {
          topicIds: ['t1'],
          saveAs: 'Genética pesada',
        });

        const gravado = prisma.simulationTemplate.create.mock.calls[0][0].data;
        expect(gravado.ownerId).toBe('u1');
        expect(gravado.scope).toBe('CUSTOM');
        expect(JSON.parse(gravado.filters)).toMatchObject({
          topicIds: ['t1'],
        });
        expect(res.savedTemplateId).toBe('tpl-salvo');
      });
    });

    describe('preview()', () => {
      it('conta as questões do recorte antes de começar', async () => {
        const { service, prisma } = makeService();
        prisma.question.count
          .mockResolvedValueOnce(142)
          .mockResolvedValueOnce(37);
        prisma.topic.findMany.mockResolvedValue([{ name: 'Funções' }]);

        const res = await service.preview('u1', {
          topicIds: ['t1'],
          questionCount: 20,
        });

        expect(res.available).toBe(142);
        expect(res.classified).toBe(37);
        expect(res.questionCount).toBe(20);
        expect(res.timeLimitMin).toBe(60);
        expect(res.description).toContain('Funções');
      });

      it('não promete mais questões do que existem', async () => {
        const { service, prisma } = makeService();
        prisma.question.count.mockResolvedValue(4);

        const res = await service.preview('u1', {
          topicIds: ['t1'],
          questionCount: 30,
        });
        expect(res.questionCount).toBe(4);
      });
    });

    describe('templates salvos', () => {
      it('o dono apaga o seu simulado salvo', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue({
          id: 'tpl-1',
          ownerId: 'u1',
        });
        prisma.simulation.count.mockResolvedValue(0);

        const res = await service.deleteTemplate('u1', 'tpl-1');
        expect(prisma.simulationTemplate.delete).toHaveBeenCalled();
        expect(res.archived).toBe(false);
      });

      it('simulado já feito é arquivado, não apagado — o histórico fica', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue({
          id: 'tpl-1',
          ownerId: 'u1',
        });
        prisma.simulation.count.mockResolvedValue(3);

        const res = await service.deleteTemplate('u1', 'tpl-1');
        expect(prisma.simulationTemplate.delete).not.toHaveBeenCalled();
        expect(res.archived).toBe(true);
      });

      it('ninguém apaga o simulado de outro aluno', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue({
          id: 'tpl-1',
          ownerId: 'outro',
        });
        await expect(
          service.deleteTemplate('u1', 'tpl-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('nem inicia o simulado salvo de outro aluno', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue({
          id: 'tpl-1',
          ownerId: 'outro',
          scope: 'CUSTOM',
          filters: '{}',
        });
        await expect(
          service.start('u1', { templateId: 'tpl-1' }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });
  });

  describe('finish()', () => {
    // Sem `questions`: simulado anterior à lista gravada, corrigido pelo que
    // foi entregue. O caso com a lista tem testes próprios abaixo.
    function simulationRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'sim-1',
        userId: 'u1',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        finishedAt: null,
        template: { timeLimitMin: 30 },
        questions: [],
        ...overrides,
      };
    }

    it('retorna 404 para simulado inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.simulation.findUnique.mockResolvedValue(null);
      await expect(
        service.finish('u1', 'nao-existe', { answers: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna 403 para simulado de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.simulation.findUnique.mockResolvedValue(
        simulationRow({ userId: 'outro' }),
      );
      await expect(
        service.finish('u1', 'sim-1', { answers: [] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('retorna 400 quando já finalizado (reenvio)', async () => {
      const { service, prisma } = makeService();
      prisma.simulation.findUnique.mockResolvedValue(
        simulationRow({ finishedAt: new Date() }),
      );
      await expect(
        service.finish('u1', 'sim-1', { answers: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deduplica respostas da mesma questão e persiste tudo em transação', async () => {
      const { service, prisma, review, gamification } = makeService();
      prisma.simulation.findUnique.mockResolvedValue(simulationRow());

      const questions = [
        {
          id: 'q1',
          topicId: 't1',
          explanation: 'e1',
          discrimination: 1,
          irtDifficulty: 0,
          guessing: 0.2,
          alternatives: [
            { id: 'a1', isCorrect: false },
            { id: 'a2', isCorrect: true },
          ],
        },
        {
          id: 'q2',
          topicId: 't2',
          explanation: 'e2',
          discrimination: 1,
          irtDifficulty: 1,
          guessing: 0.2,
          alternatives: [{ id: 'b1', isCorrect: true }],
        },
      ];
      prisma.question.findMany.mockResolvedValue(questions);

      // A transação: o service repassa o callback com um client simulado.
      const tx = {
        simulation: {
          findUnique: jest.fn().mockResolvedValue({ finishedAt: null }),
          update: jest.fn().mockResolvedValue({}),
        },
        answer: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((fn: (t: unknown) => unknown) =>
        fn(tx),
      );

      const res = await service.finish('u1', 'sim-1', {
        answers: [
          { questionId: 'q1', chosenId: 'a1', timeSpentSec: 10 }, // 1ª tentativa (errada)
          { questionId: 'q1', chosenId: 'a2', timeSpentSec: 30 }, // mudou de ideia — última vence
          { questionId: 'q2', chosenId: 'b1' },
          { questionId: 'nao-existe', chosenId: 'x' }, // inexistente — ignorada
        ],
      });

      expect(res.total).toBe(2);
      expect(res.correct).toBe(2);
      expect(res.percentage).toBe(100);
      expect(res.triScore).not.toBeNull();
      expect(tx.answer.create).toHaveBeenCalledTimes(2);
      // A resposta persistida de q1 é a última (a2, correta).
      expect(tx.answer.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          questionId: 'q1',
          chosenId: 'a2',
          isCorrect: true,
        }),
      });
      expect(tx.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-1' },
        data: expect.objectContaining({ rawScore: 2 }),
      });
      expect(review.recordOutcome).toHaveBeenCalledTimes(2);
      expect(gamification.recordActivity).toHaveBeenCalledWith(
        'u1',
        'SIMULATION',
        expect.any(Number),
        '2 acerto(s) em 2 questões',
        expect.any(Date),
        { simulationsCount: 1 },
      );
    });

    describe('com a lista de questões gravada', () => {
      const Q1 = {
        id: 'q1',
        topicId: 't1',
        explanation: 'e1',
        discrimination: null,
        irtDifficulty: null,
        guessing: null,
        alternatives: [
          { id: 'a1', isCorrect: false },
          { id: 'a2', isCorrect: true },
        ],
      };
      const Q2 = {
        ...Q1,
        id: 'q2',
        topicId: 't2',
        explanation: 'e2',
        alternatives: [{ id: 'b1', isCorrect: true }],
      };

      function arrange() {
        const ctx = makeService();
        ctx.prisma.simulation.findUnique.mockResolvedValue(
          simulationRow({
            questions: [{ questionId: 'q1' }, { questionId: 'q2' }],
          }),
        );
        ctx.prisma.question.findMany.mockResolvedValue([Q1, Q2]);
        const tx = {
          simulation: {
            findUnique: jest.fn().mockResolvedValue({ finishedAt: null }),
            update: jest.fn().mockResolvedValue({}),
          },
          answer: { create: jest.fn().mockResolvedValue({}) },
        };
        ctx.prisma.$transaction.mockImplementation(
          (fn: (t: unknown) => unknown) => fn(tx),
        );
        return { ...ctx, tx };
      }

      it('lê a lista na ordem da prova', async () => {
        const { service, prisma } = arrange();
        await service.finish('u1', 'sim-1', { answers: [] });
        expect(prisma.simulation.findUnique).toHaveBeenCalledWith({
          where: { id: 'sim-1' },
          include: {
            template: { select: { timeLimitMin: true } },
            questions: {
              select: { questionId: true },
              orderBy: { position: 'asc' },
            },
          },
        });
      });

      it('ignora questão de fora do simulado, mesmo com a resposta certa', async () => {
        const { service, prisma, tx, gamification } = arrange();

        const res = await service.finish('u1', 'sim-1', {
          answers: [
            { questionId: 'q1', chosenId: 'a2' },
            { questionId: 'intrusa', chosenId: 'certa' },
            { questionId: 'q2', chosenId: 'b1' },
          ],
        });

        expect(prisma.question.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: { in: ['q1', 'q2'] } } }),
        );
        expect(res.total).toBe(2);
        expect(res.correct).toBe(2);
        expect(res.details.map((d) => d.questionId)).toEqual(['q1', 'q2']);
        expect(tx.answer.create).toHaveBeenCalledTimes(2);
        expect(tx.simulation.update).toHaveBeenCalledWith({
          where: { id: 'sim-1' },
          data: expect.objectContaining({ rawScore: 2 }),
        });
        expect(gamification.recordActivity).toHaveBeenCalledWith(
          'u1',
          'SIMULATION',
          expect.any(Number),
          '2 acerto(s) em 2 questões',
          expect.any(Date),
          { simulationsCount: 1 },
        );
      });

      it('questão não entregue conta como em branco no total', async () => {
        const { service, tx } = arrange();

        const res = await service.finish('u1', 'sim-1', {
          answers: [{ questionId: 'q1', chosenId: 'a2' }],
        });

        expect(res.total).toBe(2);
        expect(res.correct).toBe(1);
        expect(res.percentage).toBe(50);
        expect(res.details[1]).toMatchObject({
          questionId: 'q2',
          isCorrect: false,
          chosenId: null,
          correctAlternativeId: 'b1',
        });
        expect(tx.answer.create).toHaveBeenNthCalledWith(2, {
          data: expect.objectContaining({
            questionId: 'q2',
            chosenId: undefined,
            isCorrect: false,
            simulationId: 'sim-1',
          }),
        });
      });
    });

    it('segunda finalização concorrente dentro da transação é rejeitada', async () => {
      const { service, prisma } = makeService();
      prisma.simulation.findUnique.mockResolvedValue(simulationRow());
      prisma.question.findMany.mockResolvedValue([]);

      const tx = {
        simulation: {
          // Outro request finalizou entre a leitura inicial e a transação.
          findUnique: jest.fn().mockResolvedValue({ finishedAt: new Date() }),
          update: jest.fn(),
        },
        answer: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: unknown) => unknown) =>
        fn(tx),
      );

      await expect(
        service.finish('u1', 'sim-1', { answers: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.answer.create).not.toHaveBeenCalled();
    });
  });
});

describe('SimulationsService — provas oficiais do ENEM', () => {
  const PROVA = {
    id: 'enem-2023-dia2',
    name: 'ENEM 2023 · 2º dia',
    scope: 'EXAM',
    subjectId: null,
    questionCount: 90,
    timeLimitMin: 300,
    examYearId: 'ey-2023',
    day: 2,
    archived: false,
  };

  function prepararProva(prisma: any, ids: string[]) {
    prisma.simulationTemplate.findUnique.mockResolvedValue(PROVA);
    prisma.simulation.create.mockResolvedValue({
      id: 'sim-prova',
      startedAt: new Date(),
    });
    prisma.question.findMany.mockImplementation(
      (args: { where: { id?: { in: string[] } } }) => {
        if (args.where.id?.in) {
          // O banco devolve fora de ordem: a prova tem que reordenar.
          return Promise.resolve(
            [...args.where.id.in].reverse().map((id) => ({ id })),
          );
        }
        return Promise.resolve(ids.map((id) => ({ id })));
      },
    );
  }

  it('traz o dia inteiro na ordem do caderno, sem sortear', async () => {
    const { service, prisma } = makeService();
    prepararProva(prisma, ['q91', 'q92', 'q93']);

    const res = await service.start('u1', { templateId: 'enem-2023-dia2' });

    // Nada de amostragem estratificada na prova oficial.
    expect(prisma.question.groupBy).not.toHaveBeenCalled();
    const busca = prisma.question.findMany.mock.calls[0][0];
    expect(busca.where.examYearId).toBe('ey-2023');
    expect(busca.where.number).toEqual({ gte: 91, lte: 180 });
    expect(busca.orderBy).toEqual({ number: 'asc' });
    expect(res.questions.map((q: { id: string }) => q.id)).toEqual([
      'q91',
      'q92',
      'q93',
    ]);
  });

  it('usa o tempo oficial do dia, não o proporcional', async () => {
    const { service, prisma } = makeService();
    prepararProva(prisma, ['q91', 'q92']);

    const res = await service.start('u1', { templateId: 'enem-2023-dia2' });

    expect(res.timeLimitMin).toBe(300);
  });

  it('segue a língua estrangeira do perfil do aluno', async () => {
    const { service, prisma } = makeService();
    prepararProva(prisma, ['q1']);
    prisma.profile.findUnique.mockResolvedValue({
      foreignLanguage: 'espanhol',
    });

    await service.start('u1', { templateId: 'enem-2023-dia2' });

    expect(prisma.question.findMany.mock.calls[0][0].where.OR).toEqual([
      { language: null },
      { language: 'espanhol' },
    ]);
  });

  it('sem perfil, cai no inglês', async () => {
    const { service, prisma } = makeService();
    prepararProva(prisma, ['q1']);

    await service.start('u1', { templateId: 'enem-2023-dia2' });

    expect(prisma.question.findMany.mock.calls[0][0].where.OR[1]).toEqual({
      language: 'ingles',
    });
  });

  it('a lista esconde os arquivados e ordena as provas da mais recente', async () => {
    const { service, prisma } = makeService();
    const prova = (id: string, year: number, day: number, rea = false) => ({
      id,
      name: id,
      scope: 'EXAM',
      subjectId: null,
      questionCount: 90,
      timeLimitMin: 300,
      day,
      examYear: {
        slug: id,
        year,
        label: id,
        isReapplication: rea,
        kind: rea ? 'REAPLICACAO' : 'REGULAR',
      },
    });
    prisma.simulationTemplate.findMany.mockResolvedValue([
      prova('2019-d1', 2019, 1),
      prova('2023r-d1', 2023, 1, true),
      prova('2023-d2', 2023, 2),
      prova('2023-d1', 2023, 1),
      {
        ...TEMPLATE,
        id: 'custom',
        scope: 'FULL',
        subjectId: null,
        examYear: null,
        day: null,
      },
    ]);
    prisma.subject.findMany.mockResolvedValue([]);

    const res = await service.listTemplates();

    // Catálogo (ownerId nulo) mais os simulados salvos por quem pediu.
    expect(prisma.simulationTemplate.findMany.mock.calls[0][0].where).toEqual({
      archived: false,
      OR: [{ ownerId: null }],
    });
    expect(res.map((t: { id: string }) => t.id)).toEqual([
      'custom',
      '2023-d1',
      '2023-d2',
      '2023r-d1',
      '2019-d1',
    ]);
    // 2023: 1º dia é Linguagens + Humanas.
    const d1 = res.find((t: { id: string }) => t.id === '2023-d1')!;
    expect(d1.areas).toEqual([
      'Linguagens, Códigos e suas Tecnologias',
      'Ciências Humanas e suas Tecnologias',
    ]);
  });
});
