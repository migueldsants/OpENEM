import {
  Body,
  Controller,
  Delete,
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
import { CreateDeckDto } from './dto/create-deck.dto';
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

  @Get('decks/:deckId')
  @ApiOperation({ summary: 'Detalhe de um deck (com flashcards)' })
  getDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ) {
    return this.flashcards.getDeck(deckId, user.userId);
  }

  @Post('decks/:deckId/vote')
  @ApiOperation({ summary: 'Vota (up/down) em um deck público' })
  voteDeck(@Param('deckId') deckId: string, @Body() dto: VoteDeckDto) {
    return this.flashcards.voteDeck(deckId, dto.vote);
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
  ) {
    return this.flashcards.studyQueue(
      user.userId,
      limit ? parseInt(limit, 10) : 30,
      {
        subject: subject || undefined,
        topic: topic || undefined,
        subtheme: subtheme || undefined,
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
}
