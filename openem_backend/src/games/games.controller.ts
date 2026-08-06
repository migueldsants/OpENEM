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
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';
import { GamesService } from './games.service';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de minigames disponíveis' })
  list() {
    return this.gamesService.listGames();
  }

  @Post('scores')
  @ApiOperation({ summary: 'Registra a pontuação de uma partida de minigame' })
  submitScore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitGameScoreDto,
  ) {
    return this.gamesService.submitScore(user.userId, dto);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Ranking geral por XP (top N)' })
  globalLeaderboard(@Query('limit') limit?: string) {
    return this.gamesService.globalLeaderboard(limit ? Number(limit) : 10);
  }

  @Get(':key/leaderboard')
  @ApiOperation({ summary: 'Ranking de um minigame específico (top N)' })
  leaderboard(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.gamesService.leaderboard(key, limit ? Number(limit) : 10);
  }
}
