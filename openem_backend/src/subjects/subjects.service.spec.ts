import { SubjectsService } from './subjects.service';

describe('SubjectsService', () => {
  it('lista matérias ordenadas com seus tópicos', async () => {
    const prisma = {
      subject: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            name: 'Matemática',
            topics: [{ id: 't1', name: 'Funções' }],
          },
        ]),
      },
    } as any;
    const service = new SubjectsService(prisma);

    const res = await service.list();
    expect(res[0]).toMatchObject({ id: 's1', name: 'Matemática' });
    expect(res[0].topics).toHaveLength(1);
    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
        select: expect.objectContaining({
          topics: expect.objectContaining({ orderBy: { name: 'asc' } }),
        }),
      }),
    );
  });
});
