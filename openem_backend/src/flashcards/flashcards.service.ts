import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildStudyQueue,
  reviewFlashcard,
  type FlashcardQueueItem,
} from '../common/flashcard-queue';
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
   * - filtros opcionais: subject (área), topic (matéria), subtheme (subtema)
   *   permitem estudar um escopo específico da árvore de decks.
   */
  async studyQueue(
    userId: string,
    _limit?: number,
    filters?: { subject?: string; topic?: string; subtheme?: string },
  ): Promise<FlashcardQueueItem[]> {
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
            deck: { select: { title: true, icon: true, topic: true, subtheme: true, weight: true } },
          },
        },
      },
    });

    const byCard = new Map(reviews.map((r) => [r.flashcardId, r]));

    // Cards nunca vistos também entram na fila (novo = vencido por padrão).
    const allCards = await this.prisma.flashcard.findMany({
      where: {
        OR: [{ deck: { userId } }, { deck: { isPublic: true } }],
        deck: {
          ...(filters?.subject ? { subject: filters.subject } : {}),
          ...(filters?.topic ? { topic: filters.topic } : {}),
          ...(filters?.subtheme ? { subtheme: filters.subtheme } : {}),
        },
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
            subtheme: true,
            weight: true,
            userId: true,
          },
        },
      },
    });

    const now = new Date();
    const items: FlashcardQueueItem[] = allCards.map((c) => {
      const r = byCard.get(c.id);
      const weight = c.deck.weight ?? 3;
      return {
        flashcardId: c.id,
        front: c.front,
        back: c.back,
        deckTitle: c.deck.title,
        deckIcon: c.deck.icon,
        deckTopic: c.deck.topic ?? undefined,
        deckSubtheme: c.deck.subtheme ?? undefined,
        weight,
        easeFactor: r?.easeFactor ?? 2.5,
        intervalD: r?.intervalD ?? 0,
        repetition: r?.repetition ?? 0,
        dueAt: r?.dueAt ?? now,
        // Só é "atrasado" se o usuário já tiver visto o card (tem revisão).
        // Cards nunca revisados são "novos", não atrasados.
        overdue: r != null && r.dueAt.getTime() <= now.getTime(),
      };
    });

    return buildStudyQueue(items);
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

  // ---- Estatísticas & previsão (revisão espaçada) ----

  /** Dashboard de revisão: totais, vencidos, novatos, ritmo e streak. */
  async stats(userId: string) {
    const reviews = await this.prisma.flashcardReview.findMany({
      where: { userId },
      select: {
        easeFactor: true,
        intervalD: true,
        repetition: true,
        dueAt: true,
        lastQuality: true,
        reviewedAt: true,
      },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const total = reviews.length;
    const overdue = reviews.filter((r) => r.dueAt <= now).length;
    const dueToday = reviews.filter(
      (r) => r.dueAt >= todayStart && r.dueAt <= now,
    ).length;
    const reviewedToday = reviews.filter((r) => r.reviewedAt >= todayStart).length;
    const mature = reviews.filter((r) => r.intervalD >= 21).length;
    const learning = reviews.filter((r) => r.intervalD < 21 && r.repetition > 0).length;
    const newCards = total - reviews.filter((r) => r.repetition > 0).length;

    // Streak: dias consecutivos com pelo menos 1 revisão.
    const reviewDays = new Set(
      reviews.map((r) => r.reviewedAt.toISOString().slice(0, 10)),
    );
    let streak = 0;
    const cursor = new Date(todayStart);
    while (reviewDays.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Facilidade média (easeFactor médio dos cards já vistos).
    const seenEase = reviews.filter((r) => r.repetition > 0).map((r) => r.easeFactor);
    const avgEase = seenEase.length > 0
      ? seenEase.reduce((s, e) => s + e, 0) / seenEase.length
      : 2.5;

    // Retenção: proporção de reviews com quality >= 3.
    const graded = reviews.filter((r) => r.lastQuality != null);
    const retention = graded.length > 0
      ? graded.filter((r) => (r.lastQuality ?? 0) >= 3).length / graded.length
      : 0;

    return {
      total,
      overdue,
      dueToday,
      reviewedToday,
      mature,
      learning,
      newCards,
      streak,
      avgEase: Math.round(avgEase * 100) / 100,
      retention: Math.round(retention * 100),
    };
  }

  /** Preview do próximo agendamento SM-2 sem salvar — mostra ao usuário
   * "se você avaliar como Fácil, volta em 6 dias" antes de ele clicar.
   */
  async previewReview(userId: string, flashcardId: string) {
    const review = await this.prisma.flashcardReview.findUnique({
      where: { userId_flashcardId: { userId, flashcardId } },
      select: { easeFactor: true, intervalD: true, repetition: true },
    });

    const base = review ?? { easeFactor: 2.5, intervalD: 0, repetition: 0 };
    const qualities = [1, 3, 4, 5];
    const labels: Record<number, string> = { 1: 'Esqueci', 3: 'Difícil', 4: 'Bom', 5: 'Fácil' };

    const previews = qualities.map((q) => {
      const next = reviewFlashcard(base, q);
      return {
        quality: q,
        label: labels[q],
        intervalD: next.intervalD,
        dueAt: next.dueAt.toISOString(),
      };
    });

    return {
      current: {
        easeFactor: base.easeFactor,
        intervalD: base.intervalD,
        repetition: base.repetition,
      },
      previews,
    };
  }

  /**
   * Previsão de carga futura: quantos cards vencem em cada dos próximos 7 dias.
   * Ajuda o usuário a planejar o estudo e ver picos de revisão.
   */
  async dueForecast(userId: string, days = 7) {
    const reviews = await this.prisma.flashcardReview.findMany({
      where: { userId },
      select: { dueAt: true },
    });

    // Cards nunca vistos (não têm FlashcardReview) também contam como "hoje".
    const totalCards = await this.prisma.flashcard.count({
      where: { OR: [{ deck: { userId } }, { deck: { isPublic: true } }] },
    });
    const unseenCount = totalCards - reviews.length;

    const now = new Date();
    const forecast: { day: string; label: string; count: number; overdue: boolean }[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      let count = reviews.filter((r) => {
        return r.dueAt >= dayStart && r.dueAt < dayEnd;
      }).length;

      // No dia atual, soma os cards nunca vistos (novos = vencem hoje).
      if (i === 0) {
        count += unseenCount + reviews.filter((r) => r.dueAt < dayStart).length;
      }

      const label = i === 0
        ? 'Hoje'
        : i === 1
          ? 'Amanhã'
          : dayStart.toLocaleDateString('pt-BR', { weekday: 'short' });

      forecast.push({
        day: dayStart.toISOString().slice(0, 10),
        label: label.charAt(0).toUpperCase() + label.slice(1),
        count,
        overdue: i === 0,
      });
    }

    return forecast;
  }

  /**
   * Progresso por deck para a árvore: cards novos, vistos (1x) e revistos (2x+).
   * Retorna um mapa deckId → { total, newCards, seen, reviewed }.
   */
  async deckProgress(userId: string) {
    const decks = await this.prisma.flashcardDeck.findMany({
      where: { isPublic: true },
      select: { id: true, _count: { select: { flashcards: true } } },
    });

    const allReviews = await this.prisma.flashcardReview.findMany({
      where: { userId },
      select: { flashcardId: true, repetition: true },
    });
    const reviewByCard = new Map(allReviews.map((r) => [r.flashcardId, r.repetition]));

    const cardsByDeck = await this.prisma.flashcard.findMany({
      select: { id: true, deckId: true },
    });
    const cardsInDeck = new Map<string, string[]>();
    for (const c of cardsByDeck) {
      if (!cardsInDeck.has(c.deckId)) cardsInDeck.set(c.deckId, []);
      cardsInDeck.get(c.deckId)!.push(c.id);
    }

    const progress: Record<string, { total: number; newCards: number; seen: number; reviewed: number }> = {};
    for (const deck of decks) {
      const cardIds = cardsInDeck.get(deck.id) ?? [];
      let seen = 0;
      let reviewed = 0;
      for (const cid of cardIds) {
        const rep = reviewByCard.get(cid);
        if (rep != null && rep >= 1) seen++;
        if (rep != null && rep >= 2) reviewed++;
      }
      progress[deck.id] = {
        total: deck._count.flashcards,
        newCards: cardIds.length - seen,
        seen,
        reviewed,
      };
    }
    return progress;
  }
}
