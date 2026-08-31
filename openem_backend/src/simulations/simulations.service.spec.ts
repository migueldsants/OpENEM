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
    question: { findMany: jest.fn() },
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
      prisma.question.findMany.mockResolvedValue([]);
      await expect(
        service.start('u1', { templateId: 'seed-template-math' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cria o simulado com questões sem gabarito', async () => {
      const { service, prisma } = makeService();
      prisma.simulationTemplate.findUnique.mockResolvedValue(TEMPLATE);
      prisma.question.findMany
        .mockResolvedValueOnce([{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]) // pool
        .mockResolvedValueOnce([
          {
            id: 'q1',
            statement: 's1',
            difficulty: 2,
            topic: { id: 't1', name: 'T1', subject: { id: 's1', name: 'S1' } },
            alternatives: [{ id: 'a1', text: 'alt' }],
          },
        ]); // selecionadas
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
        expect(prisma.question.findMany).not.toHaveBeenCalled();
      });

      it('filtra o pool por subjectId e usa questionCount do DTO', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(1);
        prisma.question.findMany
          .mockResolvedValueOnce(
            Array.from({ length: 12 }, (_, i) => ({
              id: `q${i}`,
              topic: { weight: 1 },
            })),
          ) // pool
          .mockResolvedValueOnce([]); // selecionadas
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-c',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectId: 'subj-mat',
          questionCount: 5,
        });

        const poolArg = prisma.question.findMany.mock.calls[0][0];
        expect(poolArg.where).toEqual({ topic: { subjectId: 'subj-mat' } });
        // Busca das selecionadas: 5 ids do pool embaralhado.
        const detailArg = prisma.question.findMany.mock.calls[1][0];
        expect(detailArg.where.id.in).toHaveLength(5);
      });

      it('topicId tem precedência sobre subjectId', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(1);
        prisma.question.findMany
          .mockResolvedValueOnce([{ id: 'q1', topic: { weight: 2 } }])
          .mockResolvedValueOnce([]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-t',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          subjectId: 'subj-mat',
          topicId: 'topico-x',
        });

        expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({
          topicId: 'topico-x',
        });
      });

      it('pareto=true ordena o pool por peso do tópico (desc)', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.question.findMany
          .mockResolvedValueOnce([
            { id: 'leve', topic: { weight: 1 } },
            { id: 'pesada', topic: { weight: 5 } },
            { id: 'media', topic: { weight: 3 } },
          ])
          .mockResolvedValueOnce([]);
        prisma.simulation.create.mockResolvedValue({
          id: 'sim-p',
          startedAt: new Date(),
        });

        await service.start('u1', {
          templateId: 'seed-template-custom',
          pareto: true,
          questionCount: 2,
        });

        // As 2 selecionadas são as de maior peso (pesada, media).
        const detailArg = prisma.question.findMany.mock.calls[1][0];
        expect(detailArg.where.id.in).toEqual(
          expect.arrayContaining(['pesada', 'media']),
        );
        expect(detailArg.where.id.in).not.toContain('leve');
      });

      it('timeLimitMin proporcional ao questionCount custom', async () => {
        const { service, prisma } = makeService();
        prisma.simulationTemplate.findUnique.mockResolvedValue(CUSTOM);
        prisma.subject.count.mockResolvedValue(1);
        prisma.question.findMany
          .mockResolvedValueOnce(
            Array.from({ length: 10 }, (_, i) => ({
              id: `q${i}`,
              topic: { weight: 1 },
            })),
          )
          .mockResolvedValueOnce(
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
