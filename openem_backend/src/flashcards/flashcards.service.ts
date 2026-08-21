import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildStudyQueue, reviewFlashcard, type FlashcardQueueItem } from '../common/flashcard-queue';
import { CreateDeckDto } from './dto/create-deck.dto';
import { CreateFlashcardDto } from './dto/create-flashcard.dto';

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Decks ----

  async createDeck(userId: string, dto: CreateDeckDto) {
    return this.prisma.flashcardDeck.create({
      data: { ...dto, userId, isPublic: dto.isPublic ?? false },
    });
  }

  /** Decks do usuário logado (tab "Meus Decks"). */
  listMyDecks(userId: string) {
    return this.prisma.flashcardDeck.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { flashcards: true } } },
    });
  }

  /** Decks públicos votados (tab "Decks Prontos"). */
  listPublicDecks(subject?: string) {
    return this.prisma.flashcardDeck.findMany({
      where: { isPublic: true, ...(subject ? { subject } : {}) },
      orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { flashcards: true } } },
    });
  }

  async getDeck(deckId: string, userId: string) {
    const deck = await this.prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: {
        flashcards: { orderBy: { order: 'asc' } },
        _count: { select: { flashcards: true } },
      },
    });
    if (!deck) throw new NotFoundException('Deck não encontrado');
    if (!deck.isPublic && deck.userId !== userId) {
      throw new ForbiddenException('Este deck é privado');
    }
    return deck;
  }

  /** Vota em um deck público. */
  async voteDeck(deckId: string, vote: 'up' | 'down') {
    const field = vote === 'up' ? 'upvotes' : 'downvotes';
    const deck = await this.prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { [field]: { increment: 1 } },
      select: { id: true, upvotes: true, downvotes: true },
    });
    return deck;
  }

  // ---- Flashcards ----

  async addFlashcard(userId: string, deckId: string, dto: CreateFlashcardDto) {
    const deck = await this.prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { userId: true, _count: { select: { flashcards: true } } },
    });
    if (!deck) throw new NotFoundException('Deck não encontrado');
    if (deck.userId !== userId) {
      throw new ForbiddenException('Você não pode editar este deck');
    }
    return this.prisma.flashcard.create({
      data: { ...dto, deckId, order: deck._count.flashcards },
    });
  }

  async removeFlashcard(userId: string, flashcardId: string) {
    const card = await this.prisma.flashcard.findUnique({
      where: { id: flashcardId },
      select: { deck: { select: { userId: true } } },
    });
    if (!card) throw new NotFoundException('Flashcard não encontrado');
    if (card.deck.userId !== userId) {
      throw new ForbiddenException('Você não pode editar este deck');
    }
    await this.prisma.flashcard.delete({ where: { id: flashcardId } });
    return { removed: true };
  }

  // ---- Estudo (fila SM-2 + Pareto) ----

  /**
   * Monta a fila "Estudo Otimizado" do usuário:
   * - inclui todos os flashcards de decks do usuário + decks públicos;
   * - estado SM-2 vem do FlashcardReview (default: novo, dueAt = agora);
   * - Pareto via weight do deck; SM-2 via vencimento.
   */
  async studyQueue(userId: string, limit = 20): Promise<FlashcardQueueItem[]> {
    const reviews = await this.prisma.flashcardReview.findMany({
      where: { userId },
      select: {
        flashcardId: true,
        easeFactor: true,
        intervalD: true,
        repetition: true,
        dueAt: true,
        flashcard: {
          select: {
            id: true,
            front: true,
            back: true,
            deck: { select: { title: true, icon: true, topic: true } },
          },
        },
      },
    });

    const byCard = new Map(reviews.map((r) => [r.flashcardId, r]));

    // Cards nunca vistos também entram na fila (novo = vencido por padrão).
    const allCards = await this.prisma.flashcard.findMany({
      where: {
        OR: [
          { deck: { userId } },
          { deck: { isPublic: true } },
        ],
      },
      select: {
        id: true,
        front: true,
        back: true,
        deck: {
          select: {
            title: true,
            icon: true,
            topic: true,
            userId: true,
          },
        },
      },
    });

    const now = new Date();
    const items: FlashcardQueueItem[] = allCards.map((c) => {
      const r = byCard.get(c.id);
      const weight = 3; // todo: pesos por tópico via tabela de pesos canônica
      return {
        flashcardId: c.id,
        front: c.front,
        back: c.back,
        deckTitle: c.deck.title,
        deckIcon: c.deck.icon,
        weight,
        easeFactor: r?.easeFactor ?? 2.5,
        intervalD: r?.intervalD ?? 0,
        repetition: r?.repetition ?? 0,
        dueAt: r?.dueAt ?? now,
        overdue: (r?.dueAt ?? now).getTime() <= now.getTime(),
      };
    });

    return buildStudyQueue(items, limit);
  }

  /** Registra a nota SM-2 (0..5) de um flashcard e devolve o novo estado. */
  async review(userId: string, flashcardId: string, quality: number) {
    const review = await this.prisma.flashcardReview.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
      select: { easeFactor: true, intervalD: true, repetition: true },
    });

    const next = reviewFlashcard(
      review ?? { easeFactor: 2.5, intervalD: 0, repetition: 0 },
      quality,
    );

    return this.prisma.flashcardReview.upsert({
      where: { userId_flashcardId: { userId, flashcardId } },
      create: {
        userId,
        flashcardId,
        easeFactor: next.easeFactor,
        intervalD: next.intervalD,
        repetition: next.repetition,
        dueAt: next.dueAt,
        lastQuality: quality,
      },
      update: {
        easeFactor: next.easeFactor,
        intervalD: next.intervalD,
        repetition: next.repetition,
        dueAt: next.dueAt,
        lastQuality: quality,
        reviewedAt: new Date(),
      },
    });
  }
}
