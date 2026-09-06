import { NotFoundException } from '@nestjs/common';
import { FormulasService } from './formulas.service';

const FORMULA = {
  id: 'f1',
  title: 'Bhaskara',
  latex: 'x = \\frac{-b}{2a}',
  description: 'raízes',
  subjectId: 'subj-mat',
  topicId: 'topic-funcoes',
  isBuiltIn: true,
  subject: { name: 'Matemática' },
  topic: { name: 'Funções' },
};

function makeService() {
  const prisma = {
    userFormula: {
      findMany: jest.fn().mockResolvedValue([{ formulaId: 'f1' }]),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    formula: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    subject: { findUnique: jest.fn().mockResolvedValue({ id: 'subj-mat' }) },
    topic: { findUnique: jest.fn().mockResolvedValue({ id: 'topic-x' }) },
  } as any;
  const service = new FormulasService(prisma);
  return { service, prisma };
}

describe('FormulasService (issue #38)', () => {
  it('lista fórmulas com o estado de favorito do usuário', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([FORMULA]);

    const res = await service.list('u1', {});
    expect(res[0]).toMatchObject({
      id: 'f1',
      title: 'Bhaskara',
      subjectName: 'Matemática',
      topicName: 'Funções',
      favorited: true, // f1 está nos favoritos do mock
    });
  });

  it('onlyFavorites filtra pelos ids favoritados', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([]);

    await service.list('u1', { onlyFavorites: true });
    expect(prisma.formula.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['f1'] } }),
      }),
    );
  });

  it('busca por texto cobre título, descrição e LaTeX', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([]);

    await service.list('u1', { q: 'bhaskara' });
    const where = prisma.formula.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { title: { contains: 'bhaskara' } },
      { description: { contains: 'bhaskara' } },
      { latex: { contains: 'bhaskara' } },
    ]);
  });

  it('ordena por matéria, assunto e título', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([]);
    await service.list('u1', {});
    expect(prisma.formula.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { subject: { name: 'asc' } },
          { topic: { name: 'asc' } },
          { title: 'asc' },
        ],
      }),
    );
  });

  it('get() retorna 404 para fórmula inexistente', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findUnique.mockResolvedValue(null);
    await expect(service.get('u1', 'nao-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('get() reflete o estado atual de favorito', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findUnique.mockResolvedValue(FORMULA);
    prisma.userFormula.findUnique.mockResolvedValueOnce({ id: 'uf1' });

    const res = await service.get('u1', 'f1');
    expect(res.favorited).toBe(true);

    prisma.userFormula.findUnique.mockResolvedValueOnce(null);
    const res2 = await service.get('u1', 'f1');
    expect(res2.favorited).toBe(false);
  });

  it('create() grava fórmula personalizada (isBuiltIn=false)', async () => {
    const { service, prisma } = makeService();
    prisma.formula.create.mockResolvedValue({
      ...FORMULA,
      isBuiltIn: false,
    });

    const res = await service.create('u1', {
      title: 'Minha fórmula',
      latex: 'a+b',
      subjectId: 'subj-mat',
    });
    expect(prisma.formula.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isBuiltIn: false }),
      }),
    );
    expect(res.isBuiltIn).toBe(false);
    expect(res.favorited).toBe(false);
  });

  it('create() valida matéria e assunto inexistente (404)', async () => {
    const { service, prisma } = makeService();
    prisma.subject.findUnique.mockResolvedValue(null);
    await expect(
      service.create('u1', {
        title: 'X',
        latex: 'x',
        subjectId: 'nao-existe',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.subject.findUnique.mockResolvedValue({ id: 'subj-mat' });
    prisma.topic.findUnique.mockResolvedValue(null);
    await expect(
      service.create('u1', {
        title: 'X',
        latex: 'x',
        subjectId: 'subj-mat',
        topicId: 'nao-existe',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('toggleFavorite()', () => {
    it('favorita quando ainda não é favorita', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue({ id: 'f2' });
      prisma.userFormula.findUnique.mockResolvedValue(null);

      const res = await service.toggleFavorite('u1', 'f2');
      expect(res).toEqual({ favorited: true });
      expect(prisma.userFormula.create).toHaveBeenCalledWith({
        data: { userId: 'u1', formulaId: 'f2' },
      });
    });

    it('desfavorita quando já é favorita', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue({ id: 'f1' });
      prisma.userFormula.findUnique.mockResolvedValue({ id: 'uf1' });

      const res = await service.toggleFavorite('u1', 'f1');
      expect(res).toEqual({ favorited: false });
      expect(prisma.userFormula.delete).toHaveBeenCalledWith({
        where: { id: 'uf1' },
      });
    });

    it('404 para fórmula inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue(null);
      await expect(service.toggleFavorite('u1', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
