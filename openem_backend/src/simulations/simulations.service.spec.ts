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
    simulationTemplate: { findMany: jest.fn(), findUnique: jest.fn() },
    subject: { findMany: jest.fn(), count: jest.fn() },
    topic: { findMany: jest.fn().mockResolvedValue([]) },
    profile: { findUnique: jest.fn().mockResolvedValue(null) },
    question: { findMany: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) },
    simulation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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
    });

    describe('filtros personalizados (issue #40)', () => {
      const CUSTOM = { ...TEMPLATE, id: 'seed-template-custom', scope: 'FULL' };

      it('rejeita matéria/tópico inexistente com 400', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(0);

        await expect(
          service.start('u1', {
            templateId: 'seed-template-custom',
            subjectId: 'nao-existe',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.question.groupBy).not.toHaveBeenCalled();
      });

      it('filtra o pool por subjectId e usa questionCount do DTO', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(1);
        mockPool(prisma, [
          { topicId: 't1', ids: Array.from({ length: 12 }, (_, i) => `q${i}`) },
        ]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-c',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectId: 'subj-mat',
          questionCount: 5,
        });

        expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
          topic: { subjectId: 'subj-mat' },
        });
        // Só as vagas são lidas do banco — uma linha por vaga, nunca o pool.
        const leituras = prisma.question.findMany.mock.calls.slice(0, -1);
        expect(leituras).toHaveLength(5);
        expect(leituras.every((c: any[]) => c[0].take === 1)).toBe(true);
        // As 5 questões sorteadas são distintas.
        const ids = prisma.question.findMany.mock.calls.at(-1)[0].where.id.in;
        expect(new Set(ids).size).toBe(5);
      });

      it('topicId tem precedência sobre subjectId', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(1);
        mockPool(prisma, [{ topicId: 'topico-x', ids: ['q1'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-t',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectId: 'subj-mat',
          topicId: 'topico-x',
        });

        expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
          topicId: 'topico-x',
        });
      });

      it('subjectAreaId filtra pela área quando não há matéria/assunto', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: null, ids: ['q1', 'q2'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-a',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectAreaId: 'area-mat',
        });

        expect(prisma.question.groupBy.mock.calls[0][0].where).toEqual({
          subjectAreaId: 'area-mat',
        });
        // O estrato sem assunto classificado participa do sorteio.
        expect(
          prisma.question.findMany.mock.calls[0][0].where.topicId,
        ).toBeNull();
      });

      it('language recorta a língua estrangeira sem excluir o resto', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [{ topicId: 't1', ids: ['q1'] }]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-lang',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          language: 'ingles',
        });

        expect(prisma.question.groupBy.mock.calls[0][0].where.OR).toEqual([
          { language: null },
          { language: 'ingles' },
        ]);
      });

      it('pareto=true consulta o peso dos assuntos para ponderar o sorteio', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        mockPool(prisma, [
          { topicId: 'leve', ids: ['q-leve'], weight: 1 },
          { topicId: 'pesada', ids: ['q-pesada-1', 'q-pesada-2'], weight: 5 },
        ]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-p',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          pareto: true,
          questionCount: 2,
        });

        expect(prisma.topic.findMany).toHaveBeenCalled();
        // 2 vagas distribuídas entre os estratos, nunca mais que o disponível.
        const lidas = prisma.question.findMany.mock.calls
          .slice(0, -1)
          .reduce((acc: number, c: unknown[]) => {
            const args = c[0] as { take: number };
            return acc + args.take;
          }, 0);
        expect(lidas).toBe(2);
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
        prisma.subject.count.mockResolvedValue(1);
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
    });
  });

  describe('finish()', () => {
    function simulationRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'sim-1',
        userId: 'u1',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        finishedAt: null,
        template: { timeLimitMin: 30 },
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
      examYear: { slug: id, year, label: id, isReapplication: rea },
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

    expect(prisma.simulationTemplate.findMany.mock.calls[0][0].where).toEqual({
      archived: false,
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
