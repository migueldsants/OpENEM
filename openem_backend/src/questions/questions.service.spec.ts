import { NotFoundException } from '@nestjs/common';
import { QuestionsService } from './questions.service';

function makePrisma() {
  return {
    question: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('QuestionsService', () => {
  describe('findMany()', () => {
    it('monta paginação e meta, sem revelar gabarito', async () => {
      const prisma = makePrisma() as any;
      const items = [
        {
          id: 'q1',
          statement: 's',
          difficulty: 1,
          topic: { id: 't1', name: 'T', subject: { id: 's1', name: 'S' } },
          examYear: { year: 2023 },
          alternatives: [{ id: 'a1', text: 'alt' }],
        },
      ];
      prisma.$transaction.mockResolvedValue([1, items]);
      const service = new QuestionsService(prisma);

      const res = await service.findMany({ page: 2, limit: 10 } as never);

      expect(res.meta).toEqual({ total: 1, page: 2, limit: 10, pages: 1 });
      expect(res.items[0].alternatives[0]).not.toHaveProperty('isCorrect');
      // count/findMany executam antes do $transaction — inspecionamos direto.
      const findManyArg = prisma.question.findMany.mock.calls[0][0];
      expect(findManyArg.skip).toBe(10);
      expect(findManyArg.take).toBe(10);
    });

    it('aplica filtros de difficulty/topicId/subjectId/year', async () => {
      const prisma = makePrisma() as any;
      prisma.$transaction.mockResolvedValue([0, []]);
      const service = new QuestionsService(prisma);

      await service.findMany({
        difficulty: 3,
        topicId: 't1',
        subjectId: 's1',
        year: 2024,
      } as never);

      const where = prisma.question.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        difficulty: 3,
        topicId: 't1',
        topic: { subjectId: 's1' },
        examYear: { year: 2024 },
      });
      expect(prisma.question.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findOne()', () => {
    it('retorna a questão com gabarito e explicação', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        explanation: 'porque',
        alternatives: [{ id: 'a1', text: 'x', isCorrect: true }],
      });
      const service = new QuestionsService(prisma);

      const res = await service.findOne('q1');
      expect(res.alternatives[0].isCorrect).toBe(true);
    });

    it('retorna 404 para questão inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.question.findUnique.mockResolvedValue(null);
      const service = new QuestionsService(prisma);

      await expect(service.findOne('nao-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
