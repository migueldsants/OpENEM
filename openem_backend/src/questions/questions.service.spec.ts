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

describe('QuestionsService — código e língua estrangeira', () => {
  function servico() {
    const prisma = {
      question: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn(),
      },
      examYear: { findMany: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    return { prisma, service: new QuestionsService(prisma as any) };
  }

  it('busca por código normalizando o que o aluno digita', async () => {
    const { prisma, service } = servico();
    await service.findMany({ code: 'enem 2023 7', page: 1, limit: 10 } as any);
    expect(prisma.question.findMany.mock.calls[0][0].where.code).toEqual({
      startsWith: 'ENEM-2023-007',
    });
  });

  it('a língua traz as questões comuns mais as da língua escolhida', async () => {
    const { prisma, service } = servico();
    await service.findMany({ language: 'ingles', page: 1, limit: 10 } as any);
    expect(prisma.question.findMany.mock.calls[0][0].where.OR).toEqual([
      { language: null },
      { language: 'ingles' },
    ]);
  });

  it('ordena pela prova mais recente e pela ordem do caderno', async () => {
    const { prisma, service } = servico();
    await service.findMany({ page: 1, limit: 10 } as any);
    expect(prisma.question.findMany.mock.calls[0][0].orderBy).toEqual([
      { examYear: { year: 'desc' } },
      { code: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('facets conta por área, assunto e prova, ignorando os vazios', async () => {
    const { prisma, service } = servico();
    prisma.question.count.mockResolvedValue(10);
    prisma.question.groupBy
      .mockResolvedValueOnce([
        { subjectAreaId: 'a1', _count: { _all: 7 } },
        { subjectAreaId: null, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { topicId: 't1', _count: { _all: 2 } },
        { topicId: null, _count: { _all: 8 } },
      ])
      .mockResolvedValueOnce([{ examYearId: 'ey1', _count: { _all: 10 } }]);
    prisma.examYear.findMany.mockResolvedValue([{ id: 'ey1', slug: '2023' }]);

    const res = await service.facets('ingles');

    expect(res).toEqual({
      total: 10,
      areas: [{ id: 'a1', count: 7 }],
      topics: [{ id: 't1', count: 2 }],
      exams: [{ slug: '2023', count: 10 }],
    });
    // O filtro de idioma vale para as contagens também.
    expect(prisma.question.count.mock.calls[0][0].where.OR).toEqual([
      { language: null },
      { language: 'ingles' },
    ]);
  });
});
