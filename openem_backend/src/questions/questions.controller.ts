import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca questões por área, assunto, nível e ano (paginado)',
  })
  findMany(@Query() query: QueryQuestionsDto) {
    return this.questionsService.findMany(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma questão comentada (com gabarito)' })
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }
}
