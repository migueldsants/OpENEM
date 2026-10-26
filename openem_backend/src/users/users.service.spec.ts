import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function makePrisma() {
  return {
    user: { findUnique: jest.fn() },
    profile: { upsert: jest.fn().mockResolvedValue({}) },
  };
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
      const service = new UsersService(prisma);

      const res = await service.getMe('u1');
      expect(res.profile.displayName).toBe('Ana');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
    });

    it('diz se a conta tem senha e Google, sem devolver o hash nem o sub', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: '$argon2id$...',
        googleSub: null,
        profile: null,
      });
      const service = new UsersService(prisma);
      const res = await service.getMe('u1');
      expect(res).toMatchObject({ hasPassword: true, googleLinked: false });
      expect(res).not.toHaveProperty('passwordHash');
      expect(res).not.toHaveProperty('googleSub');

      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: null,
        googleSub: '123',
        profile: null,
      });
      expect(await service.getMe('u1')).toMatchObject({
        hasPassword: false,
        googleLinked: true,
      });
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      const service = new UsersService(prisma);

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
      const service = new UsersService(prisma);

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
      const service = new UsersService(prisma);

      const res = await service.getPublicProfile('u1');
      expect(res).not.toHaveProperty('email');
      expect(res.displayName).toBe('Ana');
      if (!res.gamificationEnabled) throw new Error('gamificação ligada');
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
      const service = new UsersService(prisma);

      const res = await service.getPublicProfile('u2');
      expect(res.displayName).toBe('Estudante');
      if (!res.gamificationEnabled) throw new Error('gamificação ligada');
      expect(res.xp).toBe(0);
      expect(res.achievementsUnlocked).toBe(0);
    });

    it('esconde XP, nível, sequência e conquistas de quem desligou a gamificação', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue({
        id: 'u3',
        createdAt: new Date('2026-01-01'),
        profile: {
          displayName: 'Bia',
          goal: 'PROUNI',
          gamificationEnabled: false,
        },
        gamification: {
          points: 900,
          currentStreak: 7,
          lastActivityOn: new Date(),
        },
        achievements: [{ code: 'FIRST_ANSWER', unlockedAt: new Date() }],
      });
      const service = new UsersService(prisma);

      const res = await service.getPublicProfile('u3');
      expect(res).toEqual({
        id: 'u3',
        displayName: 'Bia',
        goal: 'PROUNI',
        createdAt: new Date('2026-01-01'),
        gamificationEnabled: false,
      });
    });

    it('sequência que já quebrou aparece como 0', async () => {
      const prisma = makePrisma() as any;
      const anteontem = new Date(Date.now() - 3 * 86_400_000);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u4',
        createdAt: new Date('2026-01-01'),
        profile: {
          displayName: 'Caio',
          goal: 'SISU',
          gamificationEnabled: true,
        },
        gamification: {
          points: 10,
          currentStreak: 12,
          lastActivityOn: anteontem,
        },
        achievements: [],
      });
      const service = new UsersService(prisma);

      const res = await service.getPublicProfile('u4');
      if (!res.gamificationEnabled) throw new Error('gamificação ligada');
      expect(res.currentStreak).toBe(0);
    });

    it('retorna 404 para usuário inexistente', async () => {
      const prisma = makePrisma() as any;
      prisma.user.findUnique.mockResolvedValue(null);
      const service = new UsersService(prisma);

      await expect(
        service.getPublicProfile('nao-existe'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
