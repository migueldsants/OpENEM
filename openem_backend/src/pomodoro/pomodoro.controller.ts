import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StartFocusSessionDto } from './dto/start-focus-session.dto';
import { PomodoroService } from './pomodoro.service';

@ApiTags('pomodoro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Post('sessions/start')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Abre uma sessão de foco no servidor; o relógio passa a contar daqui',
  })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartFocusSessionDto,
  ) {
    return this.pomodoroService.start(user.userId, dto);
  }

  @Post('sessions/:id/complete')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary:
      'Conclui a sessão depois do tempo real e credita XP proporcional (issue #41)',
  })
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pomodoroService.complete(user.userId, id);
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
