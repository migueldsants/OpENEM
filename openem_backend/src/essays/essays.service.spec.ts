import { EssaysService } from './essays.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EssaysService', () => {
  it('lista os temas do mais recente ao mais antigo, com os sem ano no fim', async () => {
    const prisma = {
      essayPrompt: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new EssaysService(
      prisma as unknown as PrismaService,
      {} as GamificationService,
    );

    await service.listPrompts();

    // Sem `nulls: 'last'` o Postgres poria os temas sem ano primeiro.
    expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ year: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
      }),
    );
  });
});
