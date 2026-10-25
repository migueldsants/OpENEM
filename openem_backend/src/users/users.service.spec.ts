import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { MemoryCacheStore } from '../cache/cache-store';
import {
  LoginAttemptsService,
  TooManyAttemptsException,
} from '../rate-limit/login-attempts.service';
import { EXPORT_FORMAT } from './data-export';
import { UsersService } from './users.service';

// Cada operação do $transaction devolve um marcador com o seu nome, para o
// teste conferir a ordem.
function op(name: string) {
  return jest.fn().mockReturnValue(name);
}

function makePrisma() {
  return {
    user: { findUnique: jest.fn(), delete: op('user.delete') },
    profile: { upsert: jest.fn().mockResolvedValue({}) },
    userTheme: { updateMany: op('userTheme.updateMany') },
    flashcardDeck: { updateMany: op('flashcardDeck.updateMany') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

function makeAttempts() {
  return new LoginAttemptsService(new MemoryCacheStore(), 'rl');
}

function makeService(prisma: any, attempts = makeAttempts()) {
  return new UsersService(prisma, attempts);
}

describe('UsersService', () => {
  describe('getMe()', () => {
    it('retorna o usuário com o perfil', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        profile: { displayName: 'Ana', onboarded: true },
      });
      const service = makeService(prisma);

      const res = await service.getMe('u1');
      expect(res.profile.displayName).toBe('Ana');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(service.getMe('nao-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile()', () => {
    it('faz upsert do perfil e devolve o usuário atualizado', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        profile: { goal: 'PROUNI', minutesPerDay: 90 },
      });
      const service = makeService(prisma);

      const res = await service.updateProfile('u1', {
        goal: 'PROUNI',
        minutesPerDay: 90,
      });
      expect(prisma.profile.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        update: { goal: 'PROUNI', minutesPerDay: 90 },
        create: { userId: 'u1', goal: 'PROUNI', minutesPerDay: 90 },
      });
      expect(res.profile.goal).toBe('PROUNI');
    });
  });

  describe('getPublicProfile()', () => {
    it('expõe apenas dados não-sensíveis com nível/liga derivados do XP', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        createdAt: new Date('2026-01-01'),
        profile: { displayName: 'Ana', goal: 'SISU' },
        gamification: { points: 400, currentStreak: 3 },
        achievements: [{ code: 'FIRST_ANSWER', unlockedAt: new Date() }],
      });
      const service = makeService(prisma);

      const res = await service.getPublicProfile('u1');
      expect(res).not.toHaveProperty('email');
      expect(res.displayName).toBe('Ana');
      expect(res.level).toBe(5); // 25*(5-1)^2 = 400
      expect(res.league.key).toBe('PRATA');
      expect(res.achievementsUnlocked).toBe(1);
      expect(res.featuredAchievements[0].code).toBe('FIRST_ANSWER');
    });

    it('usa defaults quando não há perfil/gamificação', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        createdAt: new Date(),
        profile: null,
        gamification: null,
        achievements: [],
      });
      const service = makeService(prisma);

      const res = await service.getPublicProfile('u2');
      expect(res.displayName).toBe('Estudante');
      expect(res.xp).toBe(0);
      expect(res.achievementsUnlocked).toBe(0);
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(
        service.getPublicProfile('nao-existe'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('exportData()', () => {
    it('busca o aluno com o select da exportação e monta o arquivo', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        createdAt: new Date('2026-01-01'),
        termsAcceptedAt: null,
        termsVersion: null,
        answers: [{ id: 'a1' }],
      });
      const service = makeService(prisma);

      const res = await service.exportData(
        'u1',
        new Date('2026-10-25T12:00:00Z'),
      );
      const arg = prisma.user.findUnique.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'u1' });
      expect(arg.select.passwordHash).toBeUndefined();
      expect(arg.select.answers).toBeDefined();
      expect(res).toMatchObject({
        format: EXPORT_FORMAT,
        exportedAt: '2026-10-25T12:00:00.000Z',
        account: { id: 'u1', email: 'a@b.com' },
        answers: [{ id: 'a1' }],
      });
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        makeService(prisma).exportData('nao-existe'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteAccount()', () => {
    let passwordHash: string;
    beforeAll(async () => {
      passwordHash = await argon2.hash('senhaForte123');
    });

    it('com a senha certa, acerta os totais dos outros e apaga o usuário, na mesma transação', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        passwordHash,
      });
      await makeService(prisma).deleteAccount('u1', 'senhaForte123');

      expect(prisma.$transaction).toHaveBeenCalledWith([
        'userTheme.updateMany',
        'flashcardDeck.updateMany',
        'flashcardDeck.updateMany',
        'user.delete',
      ]);
      expect(prisma.userTheme.updateMany).toHaveBeenCalledWith({
        where: { likeRows: { some: { userId: 'u1' } }, likes: { gt: 0 } },
        data: { likes: { decrement: 1 } },
      });
      expect(prisma.flashcardDeck.updateMany).toHaveBeenCalledWith({
        where: {
          votes: { some: { userId: 'u1', vote: 'up' } },
          upvotes: { gt: 0 },
        },
        data: { upvotes: { decrement: 1 } },
      });
      expect(prisma.flashcardDeck.updateMany).toHaveBeenCalledWith({
        where: {
          votes: { some: { userId: 'u1', vote: 'down' } },
          downvotes: { gt: 0 },
        },
        data: { downvotes: { decrement: 1 } },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });

    it('com a senha errada, responde 403 e não apaga nada', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        passwordHash,
      });
      await expect(
        makeService(prisma).deleteAccount('u1', 'outraSenha'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a quinta senha errada bloqueia a conta, também para o login', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        passwordHash,
      });
      const attempts = makeAttempts();
      const service = makeService(prisma, attempts);
      for (let i = 0; i < 4; i++) {
        await expect(
          service.deleteAccount('u1', 'errada'),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      await expect(service.deleteAccount('u1', 'errada')).rejects.toBeInstanceOf(
        TooManyAttemptsException,
      );
      // Bloqueada, nem a senha certa passa, e o login vê o mesmo bloqueio.
      await expect(
        service.deleteAccount('u1', 'senhaForte123'),
      ).rejects.toBeInstanceOf(TooManyAttemptsException);
      await expect(attempts.assertAllowed('a@b.com')).rejects.toBeInstanceOf(
        TooManyAttemptsException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a exclusão zera as falhas anteriores do e-mail', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        email: 'a@b.com',
        passwordHash,
      });
      const attempts = makeAttempts();
      const success = jest.spyOn(attempts, 'recordSuccess');
      await makeService(prisma, attempts).deleteAccount('u1', 'senhaForte123');
      expect(success).toHaveBeenCalledWith('a@b.com');
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        makeService(prisma).deleteAccount('nao-existe', 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
