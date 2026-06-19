import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACHIEVEMENTS,
  AchievementDef,
  evaluateAchievements,
  pointsForAnswer,
  updateStreak,
} from '../common/gamification';

/** Variação aplicada após uma atividade — surge na resposta da questão. */
export interface GamificationDelta {
  pointsGained: number;
  points: number;
  currentStreak: number;
  streakIncremented: boolean;
  newAchievements: AchievementDef[];
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  private async isEnabled(userId: string): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { gamificationEnabled: true },
    });
    // Sem perfil ainda: gamificação ligada por padrão (default do schema).
    return profile?.gamificationEnabled ?? true;
  }

  /**
   * Contabiliza uma questão respondida: atualiza pontos, sequência e conquistas.
   * No-op (retorna null) quando o usuário desativou a gamificação.
   */
  async recordAnswer(
    userId: string,
    isCorrect: boolean,
    now: Date = new Date(),
  ): Promise<GamificationDelta | null> {
    if (!(await this.isEnabled(userId))) {
      return null;
    }

    const pointsGained = pointsForAnswer(isCorrect);

    return this.prisma.$transaction(async (tx) => {
      const stat = await tx.gamificationStat.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      const streak = updateStreak(
        {
          currentStreak: stat.currentStreak,
          longestStreak: stat.longestStreak,
          lastActivityOn: stat.lastActivityOn,
        },
        now,
      );

      const points = stat.points + pointsGained;
      const answersCount = stat.answersCount + 1;
      const correctCount = stat.correctCount + (isCorrect ? 1 : 0);

      const unlocked = await tx.userAchievement.findMany({
        where: { userId },
        select: { code: true },
      });
      const newCodes = evaluateAchievements(
        {
          points,
          currentStreak: streak.currentStreak,
          answersCount,
          correctCount,
        },
        unlocked.map((u) => u.code),
      );

      await tx.gamificationStat.update({
        where: { userId },
        data: {
          points,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastActivityOn: streak.lastActivityOn,
          answersCount,
          correctCount,
        },
      });

      if (newCodes.length > 0) {
        await tx.userAchievement.createMany({
          data: newCodes.map((code) => ({ userId, code })),
        });
      }

      const byCode = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
      return {
        pointsGained,
        points,
        currentStreak: streak.currentStreak,
        streakIncremented: streak.incremented,
        newAchievements: newCodes
          .map((c) => byCode.get(c))
          .filter((a): a is AchievementDef => !!a),
      };
    });
  }

  /** Resumo de gamificação do usuário (ou { enabled: false } se desativado). */
  async getSummary(userId: string) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }

    const stat = await this.prisma.gamificationStat.findUnique({
      where: { userId },
    });
    const unlocked = await this.prisma.userAchievement.count({
      where: { userId },
    });

    return {
      enabled: true as const,
      points: stat?.points ?? 0,
      currentStreak: stat?.currentStreak ?? 0,
      longestStreak: stat?.longestStreak ?? 0,
      lastActivityOn: stat?.lastActivityOn ?? null,
      answersCount: stat?.answersCount ?? 0,
      correctCount: stat?.correctCount ?? 0,
      achievementsUnlocked: unlocked,
      achievementsTotal: ACHIEVEMENTS.length,
    };
  }

  /** Catálogo de conquistas com a data de desbloqueio (null se ainda travada). */
  async listAchievements(userId: string) {
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { code: true, unlockedAt: true },
    });
    const byCode = new Map(unlocked.map((u) => [u.code, u.unlockedAt]));
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: byCode.has(a.code),
      unlockedAt: byCode.get(a.code) ?? null,
    }));
  }
}
