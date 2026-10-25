import { Injectable, NotFoundException } from '@nestjs/common';
import {
  levelFromXp,
  leagueForLevel,
  ACHIEVEMENTS,
  visibleAchievements,
} from '../common/gamification';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        passwordHash: true,
        googleSub: true,
        profile: {
          select: {
            goal: true,
            minutesPerDay: true,
            displayName: true,
            focusMode: true,
            gamificationEnabled: true,
            onboarded: true,
            foreignLanguage: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    // O hash e o id do Google nunca saem: o app só precisa saber se existem.
    const { passwordHash, googleSub, ...rest } = user;
    return {
      ...rest,
      hasPassword: passwordHash !== null,
      googleLinked: googleSub !== null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.profile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    return this.getMe(userId);
  }

  /**
   * Perfil público de um usuário (issue #19). Expõe apenas dados não-sensíveis:
   * nome de exibição, objetivo, nível, liga, XP total e conquistas em destaque.
   * Nunca expõe e-mail ou outros PII. Se o usuário não existe, 404.
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        profile: { select: { displayName: true, goal: true } },
        gamification: { select: { points: true, currentStreak: true } },
        achievements: { select: { code: true, unlockedAt: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const xp = user.gamification?.points ?? 0;
    const levelInfo = levelFromXp(xp);
    const league = leagueForLevel(levelInfo.level);
    const unlockedCodes = new Set(user.achievements.map((a) => a.code));
    // Conquistas em destaque: até 4 desbloqueadas (pela ordem do catálogo).
    const featured = ACHIEVEMENTS.filter((a) => unlockedCodes.has(a.code))
      .slice(0, 4)
      .map((a) => ({ code: a.code, name: a.name, description: a.description }));

    return {
      id: user.id,
      displayName: user.profile?.displayName ?? 'Estudante',
      goal: user.profile?.goal ?? 'SISU',
      createdAt: user.createdAt,
      xp,
      level: levelInfo.level,
      league: { key: league.key, name: league.name },
      currentStreak: user.gamification?.currentStreak ?? 0,
      achievementsUnlocked: unlockedCodes.size,
      achievementsTotal: visibleAchievements(unlockedCodes).length,
      featuredAchievements: featured,
    };
  }
}
