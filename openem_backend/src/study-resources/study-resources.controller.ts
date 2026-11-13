import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudyResourcesService } from './study-resources.service';

@ApiTags('study-resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('study-resources')
export class StudyResourcesController {
  constructor(private readonly service: StudyResourcesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Materiais gratuitos de instituições públicas ou sem fins lucrativos (tela Onde estudar), sem os bloqueados por STUDY_RESOURCES_BLOCKED e sem os de conferência vencida',
  })
  list() {
    return this.service.list();
  }
}
