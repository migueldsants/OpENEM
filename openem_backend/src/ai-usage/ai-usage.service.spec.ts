import { HttpException, HttpStatus } from '@nestjs/common';
import { AI_QUOTA_WINDOW_MS } from '../common/ai-quota';
import { AiUsageService } from './ai-usage.service';

function makePrisma(contagens: { user: number; global: number }) {
  return {
    aiUsage: {
      create: jest.fn().mockResolvedValue({ id: 'uso-1' }),
      count: jest.fn(({ where }: { where: { userId?: string } }) =>
        Promise.resolve(where.userId ? contagens.user : contagens.global),
      ),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

/** Cria o serviço com o ambiente dado (a cota é lida na construção). */
function makeService(
  contagens: { user: number; global: number },
  env: Record<string, string> = {},
) {
  const antes = { ...process.env };
  Object.assign(process.env, env);
  try {
    const prisma = makePrisma(contagens);
    return { service: new AiUsageService(prisma as never), prisma };
  } finally {
    process.env = antes;
  }
}

describe('AiUsageService.reserve', () => {
  it('grava a linha de uso antes de contar e deixa passar dentro da cota', async () => {
    const { service, prisma } = makeService({ user: 30, global: 0 });
    await expect(service.reserve('u1', 'explanation')).resolves.toBeUndefined();

    expect(prisma.aiUsage.create).toHaveBeenCalledWith({
      data: { userId: 'u1', feature: 'explanation' },
      select: { id: true },
    });
    const [primeira] = prisma.aiUsage.create.mock.invocationCallOrder;
    const [contagem] = prisma.aiUsage.count.mock.invocationCallOrder;
    expect(primeira).toBeLessThan(contagem);
    expect(prisma.aiUsage.delete).not.toHaveBeenCalled();
  });

  it('conta só o recurso e o aluno, nas últimas 24 h', async () => {
    const { service, prisma } = makeService({ user: 1, global: 0 });
    const agora = Date.now();
    await service.reserve('u1', 'explanation');

    const where = prisma.aiUsage.count.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.feature).toBe('explanation');
    const desde = (where.createdAt.gte as Date).getTime();
    expect(agora - desde).toBeGreaterThanOrEqual(AI_QUOTA_WINDOW_MS - 1000);
    expect(agora - desde).toBeLessThanOrEqual(AI_QUOTA_WINDOW_MS + 1000);
  });

  it('acima da cota do aluno: apaga a própria linha e responde 429', async () => {
    // Padrão: 30 comentários por aluno em 24 h.
    const { service, prisma } = makeService({ user: 31, global: 0 });
    const erro = await service
      .reserve('u1', 'explanation')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(prisma.aiUsage.delete).toHaveBeenCalledWith({
      where: { id: 'uso-1' },
    });
  });

  it('sem teto global, nem conta o total', async () => {
    const { service, prisma } = makeService({ user: 1, global: 9999 });
    await service.reserve('u1', 'explanation');
    expect(prisma.aiUsage.count).toHaveBeenCalledTimes(1);
  });

  it('com AI_DAILY_LIMIT, recusa quando o total passa do teto', async () => {
    const { service, prisma } = makeService(
      { user: 1, global: 11 },
      { AI_DAILY_LIMIT: '10' },
    );
    await expect(service.reserve('u1', 'explanation')).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(prisma.aiUsage.count).toHaveBeenCalledTimes(2);
    expect(prisma.aiUsage.delete).toHaveBeenCalled();
  });
});
