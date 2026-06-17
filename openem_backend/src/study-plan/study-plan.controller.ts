import {
  Body,
  Controller,
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

  @Patch('sessions/:id')
  @ApiOperation({ summary: 'Marca uma sessão de estudo como concluída' })
  updateSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.studyPlanService.setSessionDone(user.userId, id, dto.done);
  }
}
