import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Verificação de saúde da API, do banco e do cache' })
  async check(): Promise<{
    status: string;
    database: string;
    redis: 'up' | 'down' | 'disabled';
  }> {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    // O Redis fora do ar não muda o status: sem ele a API lê do banco.
    const redis = await this.cache.status();
    return { status: 'ok', database, redis };
  }
}
