import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';

function makePrismaMock() {
  return {
    flashcardDeck: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
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
    it('incrementa upvotes', async () => {
      const { service, prisma } = makeService();
      prisma.flashcardDeck.update.mockResolvedValue({
        id: 'dk-1',
        upvotes: 1,
        downvotes: 0,
      });
      await service.voteDeck('dk-1', 'up');
      expect(prisma.flashcardDeck.update).toHaveBeenCalledWith({
        where: { id: 'dk-1' },
        data: { upvotes: { increment: 1 } },
        select: { id: true, upvotes: true, downvotes: true },
      });
    });
  });
});
