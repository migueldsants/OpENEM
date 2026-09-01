import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertQuestionNoteDto } from './dto/upsert-question-note.dto';
import { QuestionNotesService } from './question-notes.service';

@ApiTags('question-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('question-notes')
export class QuestionNotesController {
  constructor(private readonly notes: QuestionNotesService) {}

  @Put()
  @ApiOperation({
    summary: 'Cria ou atualiza uma anotação pessoal em uma questão',
  })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertQuestionNoteDto,
  ) {
    return this.notes.upsert(user.userId, dto.questionId, dto.content);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista as anotações do usuário (todas, ou filtradas por questionIds)',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('questionIds') questionIds?: string,
  ) {
    if (questionIds) {
      return this.notes.forQuestions(user.userId, questionIds.split(','));
    }
    return this.notes.list(user.userId);
  }

  @Get(':questionId')
  @ApiOperation({ summary: 'Retorna a anotação do usuário para uma questão' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.notes.get(user.userId, questionId);
  }

  @Delete(':questionId')
  @ApiOperation({ summary: 'Remove a anotação do usuário de uma questão' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.notes.remove(user.userId, questionId);
  }
}
