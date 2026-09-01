import { NotFoundException } from '@nestjs/common';
import { QuestionNotesService } from './question-notes.service';

// Mock mínimo do PrismaService — só o que o QuestionNotesService usa.
function makePrismaMock() {
  return {
    question: { findUnique: jest.fn() },
    questionNote: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  return { service: new QuestionNotesService(prisma), prisma };
}

describe('QuestionNotesService', () => {
  describe('upsert()', () => {
    it('cria ou atualiza a nota do usuário para a questão', async () => {
      const { service, prisma } = makeService();
      prisma.question.findUnique.mockResolvedValue({ id: 'q-1' });
      prisma.questionNote.upsert.mockResolvedValue({ id: 'n-1' });

      await service.upsert('u-1', 'q-1', 'Revisar fórmula da área');

      expect(prisma.questionNote.upsert).toHaveBeenCalledWith({
        where: { userId_questionId: { userId: 'u-1', questionId: 'q-1' } },
        create: {
          userId: 'u-1',
          questionId: 'q-1',
          content: 'Revisar fórmula da área',
        },
        update: { content: 'Revisar fórmula da área' },
      });
    });

    it('lança NotFoundException quando a questão não existe', async () => {
      const { service, prisma } = makeService();
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(service.upsert('u-1', 'q-x', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.questionNote.upsert).not.toHaveBeenCalled();
    });
  });

  describe('get()', () => {
    it('busca a nota pela chave composta userId+questionId', async () => {
      const { service, prisma } = makeService();
      prisma.questionNote.findUnique.mockResolvedValue({ id: 'n-1' });

      const result = await service.get('u-1', 'q-1');

      expect(prisma.questionNote.findUnique).toHaveBeenCalledWith({
        where: { userId_questionId: { userId: 'u-1', questionId: 'q-1' } },
      });
      expect(result?.id).toBe('n-1');
    });

    it('retorna null quando não há nota', async () => {
      const { service, prisma } = makeService();
      prisma.questionNote.findUnique.mockResolvedValue(null);
      expect(await service.get('u-1', 'q-1')).toBeNull();
    });
  });

  describe('forQuestions()', () => {
    it('retorna [] sem consultar o banco quando a lista está vazia', async () => {
      const { service, prisma } = makeService();
      const result = await service.forQuestions('u-1', []);
      expect(result).toEqual([]);
      expect(prisma.questionNote.findMany).not.toHaveBeenCalled();
    });

    it('filtra por questionIds para o usuário', async () => {
      const { service, prisma } = makeService();
      prisma.questionNote.findMany.mockResolvedValue([{ questionId: 'q-1' }]);

      const result = await service.forQuestions('u-1', ['q-1', 'q-2']);

      expect(prisma.questionNote.findMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', questionId: { in: ['q-1', 'q-2'] } },
        select: { questionId: true, content: true, updatedAt: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('remove()', () => {
    it('remove com deleteMany (idempotente) e retorna removed: true', async () => {
      const { service, prisma } = makeService();

      const result = await service.remove('u-1', 'q-1');

      expect(prisma.questionNote.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', questionId: 'q-1' },
      });
      expect(result).toEqual({ removed: true });
    });
  });
});
