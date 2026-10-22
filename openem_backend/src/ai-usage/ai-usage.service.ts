import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AI_QUOTA_WINDOW_MS,
  aiQuotaLimitsFromEnv,
  AiFeature,
  AiQuotaLimits,
  quotaExceeded,
} from '../common/ai-quota';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cota das chamadas pagas à IA (ver common/ai-quota). A linha de uso entra
 * antes da contagem, então duas requisições simultâneas não passam juntas do
 * limite; quem estoura a cota tem a própria linha apagada e recebe 429.
 */
@Injectable()
export class AiUsageService {
  private readonly limits: AiQuotaLimits = aiQuotaLimitsFromEnv(process.env);

  constructor(private readonly prisma: PrismaService) {}

  /** Reserva uma chamada para o aluno; lança 429 se a cota acabou. */
  async reserve(userId: string, feature: AiFeature): Promise<void> {
    const desde = new Date(Date.now() - AI_QUOTA_WINDOW_MS);
    const linha = await this.prisma.aiUsage.create({
      data: { userId, feature },
      select: { id: true },
    });
    const [user, global] = await Promise.all([
      this.prisma.aiUsage.count({
        where: { userId, feature, createdAt: { gte: desde } },
      }),
      this.limits.global > 0
        ? this.prisma.aiUsage.count({ where: { createdAt: { gte: desde } } })
        : Promise.resolve(0),
    ]);
    if (quotaExceeded(feature, { user, global }, this.limits) === null) return;

    await this.prisma.aiUsage.delete({ where: { id: linha.id } });
    throw new HttpException(
      'Você atingiu o limite de pedidos à IA de hoje. Tente de novo amanhã.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
