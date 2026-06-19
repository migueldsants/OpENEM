import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Resumo de gamificação (pontos, sequência, conquistas)',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.getSummary(user.userId);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Catálogo de conquistas com status de desbloqueio' })
  achievements(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.listAchievements(user.userId);
  }
}
