import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FlashcardsService } from './flashcards.service';

function makePrismaMock() {
  return {
    flashcardDeck: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    flashcardDeckVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // A transação repassa o próprio mock como cliente.
    $transaction: jest.fn(),
    flashcard: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    flashcardReview: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrismaMock() as any;
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return { service: new FlashcardsService(prisma), prisma };
}

describe('FlashcardsService', () => {
  describe('createDeck()', () => {
    it('define userId e isPublic=false por default', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.create.mockResolvedValue({ id: 'dk-1' });
      await service.createDeck('u-1', {
        title: 'T',
        description: '',
        subject: 'Matemática e suas Tecnologias',
      });
      expect(prisma.flashcardDeck.create).toHaveBeenCalledWith({
        data: {
          title: 'T',
          description: '',
          subject: 'Matemática e suas Tecnologias',
          userId: 'u-1',
          isPublic: false,
        },
      });
    });
  });

  describe('getDeck()', () => {
    it('permite acesso a deck público', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({
        id: 'dk-1',
        isPublic: true,
        userId: 'u-2',
        flashcards: [],
        _count: {},
      });
      const r = await service.getDeck('dk-1', 'u-1');
      expect(r.id).toBe('dk-1');
    });

    it('nega acesso a deck privado de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({
        id: 'dk-1',
        isPublic: false,
        userId: 'u-2',
      });
      await expect(service.getDeck('dk-1', 'u-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('permite o dono acessar deck privado', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({
        id: 'dk-1',
        isPublic: false,
        userId: 'u-1',
      });
      await expect(service.getDeck('dk-1', 'u-1')).resolves.toBeDefined();
    });

    it('404 para deck inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue(null);
      await expect(service.getDeck('dk-x', 'u-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addFlashcard()', () => {
    it('define a ordem como o próximo índice', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({
        userId: 'u-1',
        _count: { flashcards: 3 },
      });
      prisma.flashcard.create.mockResolvedValue({ id: 'fc-1' });
      await service.addFlashcard('u-1', 'dk-1', { front: 'F', back: 'B' });
      expect(prisma.flashcard.create).toHaveBeenCalledWith({
        data: { front: 'F', back: 'B', deckId: 'dk-1', order: 3 },
      });
    });

    it('nega quando o deck é de outro usuário', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({ userId: 'u-2' });
      await expect(
        service.addFlashcard('u-1', 'dk-1', { front: 'F', back: 'B' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('voteDeck()', () => {
    /** Deck público com o voto anterior do aluno (ou nenhum). */
    function arrange(anterior: { id: string; vote: string } | null) {
      const ctx = makeService();
      ctx.prisma.flashcardDeck.findUnique.mockResolvedValue({ isPublic: true });
      ctx.prisma.flashcardDeckVote.findUnique.mockResolvedValue(anterior);
      ctx.prisma.flashcardDeck.update.mockResolvedValue({
        id: 'dk-1',
        upvotes: 1,
        downvotes: 0,
      });
      return ctx;
    }

    /** Incremento aplicado aos contadores do deck. */
    function incremento(prisma: any) {
      return prisma.flashcardDeck.update.mock.calls[0][0].data;
    }

    it('404 para deck inexistente', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue(null);
      await expect(
        service.voteDeck('u-1', 'nao-existe', 'up'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 para deck privado, sem mexer nos contadores', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.findUnique.mockResolvedValue({ isPublic: false });
      await expect(service.voteDeck('u-1', 'dk-1', 'down')).rejects.toThrow(
        'Só é possível votar em decks públicos',
      );
      expect(prisma.flashcardDeck.update).not.toHaveBeenCalled();
    });

    it('primeiro voto grava a linha do aluno e soma 1', async () => {
      const { service, prisma } = arrange(null);
      const res = await service.voteDeck('u-1', 'dk-1', 'up');

      expect(prisma.flashcardDeckVote.findUnique).toHaveBeenCalledWith({
        where: { deckId_userId: { deckId: 'dk-1', userId: 'u-1' } },
        select: { id: true, vote: true },
      });
      expect(prisma.flashcardDeckVote.create).toHaveBeenCalledWith({
        data: { deckId: 'dk-1', userId: 'u-1', vote: 'up' },
      });
      expect(prisma.flashcardDeck.update).toHaveBeenCalledWith({
        where: { id: 'dk-1' },
        data: { upvotes: { increment: 1 }, downvotes: { increment: 0 } },
        select: { id: true, upvotes: true, downvotes: true },
      });
      expect(res).toEqual({
        id: 'dk-1',
        upvotes: 1,
        downvotes: 0,
        myVote: 'up',
      });
    });

    it('primeiro voto contra soma no contador de downvotes', async () => {
      const { service, prisma } = arrange(null);
      await service.voteDeck('u-1', 'dk-1', 'down');
      expect(incremento(prisma)).toEqual({
        upvotes: { increment: 0 },
        downvotes: { increment: 1 },
      });
    });

    it('repetir o mesmo voto não conta de novo', async () => {
      const { service, prisma } = arrange({ id: 'v-1', vote: 'up' });
      await service.voteDeck('u-1', 'dk-1', 'up');

      expect(prisma.flashcardDeckVote.create).not.toHaveBeenCalled();
      expect(prisma.flashcardDeckVote.update).not.toHaveBeenCalled();
      expect(incremento(prisma)).toEqual({
        upvotes: { increment: 0 },
        downvotes: { increment: 0 },
      });
    });

    it('trocar de sentido move o voto de um contador para o outro', async () => {
      const { service, prisma } = arrange({ id: 'v-1', vote: 'up' });
      const res = await service.voteDeck('u-1', 'dk-1', 'down');

      expect(prisma.flashcardDeckVote.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { vote: 'down' },
      });
      expect(incremento(prisma)).toEqual({
        upvotes: { increment: -1 },
        downvotes: { increment: 1 },
      });
      expect(res.myVote).toBe('down');
    });

    it('trocar de contra para a favor também move o voto', async () => {
      const { service, prisma } = arrange({ id: 'v-1', vote: 'down' });
      await service.voteDeck('u-1', 'dk-1', 'up');
      expect(incremento(prisma)).toEqual({
        upvotes: { increment: 1 },
        downvotes: { increment: -1 },
      });
    });

    it('voto simultâneo barrado pelo índice único vira 409', async () => {
      const { service, prisma } = arrange(null);
      prisma.flashcardDeckVote.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.voteDeck('u-1', 'dk-1', 'up'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('outros erros do banco passam adiante', async () => {
      const { service, prisma } = arrange(null);
      const falha = new Error('disco cheio');
      prisma.flashcardDeckVote.create.mockRejectedValue(falha);
      await expect(service.voteDeck('u-1', 'dk-1', 'up')).rejects.toBe(falha);
    });
  });
});
