import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { ExplanationService } from './explanation.service';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly explanationService: ExplanationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca questões por área, assunto, nível e ano (paginado)',
  })
  findMany(@Query() query: QueryQuestionsDto) {
    return this.questionsService.findMany(query);
  }

  // As rotas fixas precisam vir ANTES de :id, senão "exams" e "facets" são
  // lidos como id de questão.
  @Get('facets')
  @ApiOperation({
    summary:
      'Contagem de questões por área, assunto e prova (para o painel de filtros)',
  })
  facets(@Query('language') language?: string) {
    return this.questionsService.facets(
      language === 'ingles' || language === 'espanhol' ? language : undefined,
    );
  }

  @Get('exams')
  @ApiOperation({
    summary: 'Lista as provas disponíveis, da mais recente para a mais antiga',
  })
  exams() {
    return this.questionsService.exams();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma questão comentada (com gabarito)' })
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  // Limite apertado: cada chamada nova custa uma requisição paga à IA, e sem
  // teto um único cliente esgotaria a chave do projeto gerando o banco inteiro.
  @Post(':id/explanation')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary:
      'Devolve o comentário da questão, gerando-o por IA na primeira vez (se houver provedor)',
  })
  explain(@Param('id') id: string) {
    return this.explanationService.explain(id);
  }
}
