import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteFocusSessionDto } from './dto/complete-focus-session.dto';
import { PomodoroService } from './pomodoro.service';

@ApiTags('pomodoro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Post('sessions')
  @ApiOperation({
    summary:
      'Registra uma sessão de foco concluída com XP proporcional (issue #41)',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteFocusSessionDto,
  ) {
    return this.pomodoroService.complete(user.userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de sessões dos últimos N dias' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const d = days ? Math.min(365, Math.max(1, Number(days) || 30)) : 30;
    return this.pomodoroService.history(user.userId, d);
  }

  @Get('by-subject')
  @ApiOperation({ summary: 'Minutos de foco por matéria nos últimos N dias' })
  bySubject(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const d = days ? Math.min(365, Math.max(1, Number(days) || 30)) : 30;
    return this.pomodoroService.minutesBySubject(user.userId, d);
  }

  @Get('today')
  @ApiOperation({ summary: 'Minutos de foco de hoje (widget do Pomodoro)' })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.pomodoroService.todayMinutes(user.userId);
  }
}
