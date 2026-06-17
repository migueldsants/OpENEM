import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerformanceService } from './performance.service';

@ApiTags('performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  @ApiOperation({
    summary: 'Desempenho do usuário por área, por assunto e tendência recente',
  })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.performanceService.overview(user.userId);
  }
}
