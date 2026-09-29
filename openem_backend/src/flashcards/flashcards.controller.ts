import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import {
  CreateFlashcardDto,
  ReviewFlashcardDto,
  VoteDeckDto,
} from './dto/create-flashcard.dto';
import { FlashcardsService } from './flashcards.service';

@ApiTags('flashcards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcards: FlashcardsService) {}

  // ---- Decks ----

  @Post('decks')
  @ApiOperation({ summary: 'Cria um deck de flashcards' })
  createDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeckDto,
  ) {
    return this.flashcards.createDeck(user.userId, dto);
  }

  @Get('decks/mine')
  @ApiOperation({ summary: 'Decks do usuário logado' })
  myDecks(@CurrentUser() user: AuthenticatedUser) {
    return this.flashcards.listMyDecks(user.userId);
  }

  @Get('decks/public')
  @ApiOperation({
    summary: 'Decks públicos votados (opcionalmente por matéria)',
  })
  publicDecks(@Query('subject') subject?: string) {
    return this.flashcards.listPublicDecks(subject);
  }

  // Rotas estáticas ANTES de decks/:deckId (senão "progress" é confundido com :deckId).
  @Get('decks/progress')
  @ApiOperation({
    summary: 'Progresso por deck para a árvore (novos, vistos, revistos)',
  })
  deckProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.flashcards.deckProgress(user.userId);
  }

  @Get('decks/:deckId')
  @ApiOperation({ summary: 'Detalhe de um deck (com flashcards)' })
  getDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ) {
    return this.flashcards.getDeck(deckId, user.userId);
  }

  @Post('decks/:deckId/vote')
  @ApiOperation({
    summary: 'Vota (up/down) em um deck público — um voto por aluno',
  })
  voteDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() dto: VoteDeckDto,
  ) {
    return this.flashcards.voteDeck(user.userId, deckId, dto.vote);
  }

  @Patch('decks/:deckId')
  @ApiOperation({ summary: 'Atualiza um deck (apenas o dono)' })
  updateDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() dto: UpdateDeckDto,
  ) {
    return this.flashcards.updateDeck(user.userId, deckId, dto);
  }

  @Delete('decks/:deckId')
  @ApiOperation({ summary: 'Remove um deck com seus cards (apenas o dono)' })
  removeDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ) {
    return this.flashcards.removeDeck(user.userId, deckId);
  }

  // ---- Flashcards ----

  @Post('decks/:deckId/flashcards')
  @ApiOperation({ summary: 'Adiciona um flashcard ao deck' })
  addFlashcard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() dto: CreateFlashcardDto,
  ) {
    return this.flashcards.addFlashcard(user.userId, deckId, dto);
  }

  @Delete('flashcards/:flashcardId')
  @ApiOperation({ summary: 'Remove um flashcard' })
  removeFlashcard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('flashcardId') flashcardId: string,
  ) {
    return this.flashcards.removeFlashcard(user.userId, flashcardId);
  }

  // ---- Estudo ----

  @Get('study/queue')
  @ApiOperation({
    summary: 'Fila otimizada de estudo (SM-2 + Pareto) — filtros por escopo',
  })
  studyQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('subject') subject?: string,
    @Query('topic') topic?: string,
    @Query('subtheme') subtheme?: string,
    @Query('deckId') deckId?: string,
  ) {
    return this.flashcards.studyQueue(
      user.userId,
      limit ? parseInt(limit, 10) : 30,
      {
        subject: subject || undefined,
        topic: topic || undefined,
        subtheme: subtheme || undefined,
        deckId: deckId || undefined,
      },
    );
  }

  @Post('flashcards/:flashcardId/review')
  @ApiOperation({ summary: 'Registra uma revisão SM-2 (qualidade 0-5)' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('flashcardId') flashcardId: string,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.flashcards.review(user.userId, flashcardId, dto.quality);
  }

  // ---- Revisão espaçada: estatísticas & previsão ----

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard de revisão espaçada do usuário' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.flashcards.stats(user.userId);
  }

  @Get('flashcards/:flashcardId/preview')
  @ApiOperation({
    summary:
      'Preview do próximo agendamento SM-2 sem salvar (antes de avaliar)',
  })
  previewReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('flashcardId') flashcardId: string,
  ) {
    return this.flashcards.previewReview(user.userId, flashcardId);
  }

  @Get('forecast')
  @ApiOperation({
    summary: 'Previsão de carga de revisão dos próximos dias',
  })
  dueForecast(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.flashcards.dueForecast(
      user.userId,
      days ? parseInt(days, 10) : 7,
    );
  }
}
