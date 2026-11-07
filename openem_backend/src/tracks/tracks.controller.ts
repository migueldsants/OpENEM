import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TracksService } from './tracks.service';

@ApiTags('tracks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  @ApiOperation({
    summary:
      'Matérias com o que cai nas provas regulares recentes e o domínio do aluno',
  })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.tracks.overview(user.userId);
  }

  @Get(':subjectId')
  @ApiOperation({
    summary:
      'Trilha de estudo de uma matéria: etapas, incidência e domínio de cada assunto',
  })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subjectId') subjectId: string,
  ) {
    return this.tracks.detail(user.userId, subjectId);
  }
}
