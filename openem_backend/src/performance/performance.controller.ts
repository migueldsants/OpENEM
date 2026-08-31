import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerformanceQueryDto } from './dto/performance-query.dto';
import { HeatmapService } from './heatmap.service';
import { PerformanceService } from './performance.service';

@ApiTags('performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly heatmapService: HeatmapService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Desempenho do usuário por área, por assunto e tendência recente (filtro 7d/30d/all)',
  })
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PerformanceQueryDto,
  ) {
    return this.performanceService.overview(user.userId, query.period ?? '30d');
  }

  @Get('heatmap')
  @ApiOperation({
    summary:
      'Mapa de calor da taxonomia canônica: todos os tópicos por área → matéria com o desempenho do usuário (issue #43)',
  })
  heatmap(@CurrentUser() user: AuthenticatedUser) {
    return this.heatmapService.heatmap(user.userId);
  }
}
