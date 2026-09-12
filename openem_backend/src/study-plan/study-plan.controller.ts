import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { StudyPlanService } from './study-plan.service';

@ApiTags('study-plan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Gera o cronograma a partir do desempenho e do tempo disponível',
  })
  generate(@CurrentUser() user: AuthenticatedUser) {
    return this.studyPlanService.generate(user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Retorna o cronograma atual com as sessões por dia',
  })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.studyPlanService.get(user.userId);
  }

  @Post('sessions')
  @ApiOperation({
    summary: 'Adiciona um bloco livre em um dia do calendário (issue #46)',
  })
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.studyPlanService.createSession(user.userId, dto);
  }

  @Patch('sessions/:id')
  @ApiOperation({
    summary: 'Edita nome, duração, dia ou conclusão de um bloco',
  })
  updateSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.studyPlanService.updateSession(user.userId, id, dto);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Remove um bloco do calendário' })
  removeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.studyPlanService.removeSession(user.userId, id);
  }

  @Delete()
  @ApiOperation({
    summary: 'Esvazia o cronograma, mantendo o plano para edição',
  })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.studyPlanService.clear(user.userId);
  }
}
