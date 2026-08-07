import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Ranking de XP (global ou por liga do solicitante)',
  })
  leaderboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamification.leaderboard(
      user.userId,
      scope === 'league' ? 'league' : 'global',
      limit ? Number(limit) : 10,
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Histórico de XP ganho (logs + agregado por dia)',
  })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.gamification.getHistory(user.userId, days ? Number(days) : 30);
  }

  @Get('daily-challenge')
  @ApiOperation({
    summary: 'Desafio diário do dia (meta, progresso, recompensa)',
  })
  dailyChallenge(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.getDailyChallenge(user.userId);
  }

  @Post('daily-challenge/claim')
  @ApiOperation({ summary: 'Resgata a recompensa do desafio diário concluído' })
  claimDailyChallenge(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.claimDailyChallenge(user.userId);
  }
}
