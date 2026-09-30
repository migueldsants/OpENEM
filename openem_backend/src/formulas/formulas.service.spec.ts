import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FormulasService } from './formulas.service';

const FORMULA = {
  id: 'f1',
  title: 'Bhaskara',
  latex: 'x = \\frac{-b}{2a}',
  description: 'raízes',
  subjectId: 'subj-mat',
  topicId: 'topic-funcoes',
  isBuiltIn: true,
  ownerId: null,
  subject: { name: 'Matemática' },
  topic: { name: 'Funções' },
};

/** Fórmula personalizada criada pelo aluno `dono`. */
function personalizada(dono: string) {
  return { ...FORMULA, id: 'f-pessoal', isBuiltIn: false, ownerId: dono };
}

/** O catálogo para todos, as personalizadas só para o dono. */
const VISIVEL_PARA_U1 = { OR: [{ isBuiltIn: true }, { ownerId: 'u1' }] };

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

  it('lista só o catálogo e as fórmulas personalizadas do próprio aluno', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([]);

    await service.list('u1', { q: 'x', subjectId: 'subj-mat' });
    const where = prisma.formula.findMany.mock.calls[0][0].where;
    // A visibilidade entra em AND e não se mistura com o OR da busca.
    expect(where.AND).toEqual([VISIVEL_PARA_U1]);
    expect(where.subjectId).toBe('subj-mat');
    expect(where.OR).toHaveLength(3);
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

  it('get() da personalizada de outro aluno responde 404', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findUnique.mockResolvedValue(personalizada('outro'));
    prisma.userFormula.findUnique.mockResolvedValue(null);
    await expect(service.get('u1', 'f-pessoal')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('get() da própria personalizada funciona', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findUnique.mockResolvedValue(personalizada('u1'));
    prisma.userFormula.findUnique.mockResolvedValue(null);
    const res = await service.get('u1', 'f-pessoal');
    expect(res).toMatchObject({ id: 'f-pessoal', isBuiltIn: false });
    // O dono não vaza na resposta.
    expect(res).not.toHaveProperty('ownerId');
  });

  it('create() grava fórmula personalizada (isBuiltIn=false) com dono', async () => {
    const { service, prisma } = makeService();
    prisma.formula.create.mockResolvedValue(personalizada('u1'));

    const res = await service.create('u1', {
      title: 'Minha fórmula',
      latex: 'a+b',
      subjectId: 'subj-mat',
    });
    expect(prisma.formula.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isBuiltIn: false, ownerId: 'u1' }),
      }),
    );
    expect(res.isBuiltIn).toBe(false);
    expect(res.favorited).toBe(false);
  });

  it('create() com título repetido do mesmo aluno responde 409', async () => {
    const { service, prisma } = makeService();
    prisma.formula.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create('u1', { title: 'Repetida', latex: 'a', subjectId: 's' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create() repassa erros que não são de título repetido', async () => {
    const { service, prisma } = makeService();
    const falha = new Error('banco fora do ar');
    prisma.formula.create.mockRejectedValue(falha);
    await expect(
      service.create('u1', { title: 'X', latex: 'a', subjectId: 's' }),
    ).rejects.toBe(falha);
  });

  it('pdf() só coloca no caderno o que o aluno enxerga', async () => {
    const { service, prisma } = makeService();
    prisma.formula.findMany.mockResolvedValue([]);
    await expect(
      service.pdf('u1', { formulaIds: ['f-pessoal'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const where = prisma.formula.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([VISIVEL_PARA_U1]);
    expect(where.id).toEqual({ in: ['f-pessoal'] });
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
      prisma.formula.findUnique.mockResolvedValue({
        isBuiltIn: true,
        ownerId: null,
      });
      prisma.userFormula.findUnique.mockResolvedValue(null);

      const res = await service.toggleFavorite('u1', 'f2');
      expect(res).toEqual({ favorited: true });
      expect(prisma.userFormula.create).toHaveBeenCalledWith({
        data: { userId: 'u1', formulaId: 'f2' },
      });
    });

    it('desfavorita quando já é favorita', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue({
        isBuiltIn: true,
        ownerId: null,
      });
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

    it('404 para a personalizada de outro aluno', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue({
        isBuiltIn: false,
        ownerId: 'outro',
      });
      await expect(
        service.toggleFavorite('u1', 'f-pessoal'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.userFormula.create).not.toHaveBeenCalled();
    });

    it('favorita a própria personalizada', async () => {
      const { service, prisma } = makeService();
      prisma.formula.findUnique.mockResolvedValue({
        isBuiltIn: false,
        ownerId: 'u1',
      });
      prisma.userFormula.findUnique.mockResolvedValue(null);
      await expect(service.toggleFavorite('u1', 'f-pessoal')).resolves.toEqual({
        favorited: true,
      });
    });
  });
});
