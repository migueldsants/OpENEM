import { Injectable } from '@nestjs/common';
import {
  dailyChallengeFor,
  dailyChallengeStatus,
} from '../common/daily-challenge';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACHIEVEMENTS,
  AchievementDef,
  comboMultiplierForStreak,
  dailyBonusXp,
  evaluateAchievements,
  leagueForLevel,
  levelFromXp,
  pointsForAnswer,
  updateStreak,
  xpForAnswer,
} from '../common/gamification';

/** Variação aplicada após uma atividade — surge na resposta da questão. */
export interface GamificationDelta {
  xpGained: number;
  breakdown: { base: number; comboMultiplier: number; dailyBonus: number };
  xp: number;
  level: number;
  leveledUp: boolean;
  league: { key: string; name: string };
  leagueChanged: boolean;
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

      // XP = base × combo da streak (+ bônus na 1ª atividade do dia).
      const base = pointsForAnswer(isCorrect);
      const comboMultiplier = comboMultiplierForStreak(streak.currentStreak);
      const dailyBonus = streak.incremented
        ? dailyBonusXp(streak.currentStreak)
        : 0;
      const xpGained =
        xpForAnswer(isCorrect, streak.currentStreak) + dailyBonus;

      const xp = stat.points + xpGained;
      const answersCount = stat.answersCount + 1;
      const correctCount = stat.correctCount + (isCorrect ? 1 : 0);

      const before = levelFromXp(stat.points);
      const after = levelFromXp(xp);
      const leagueBefore = leagueForLevel(before.level);
      const leagueAfter = leagueForLevel(after.level);

      const unlocked = await tx.userAchievement.findMany({
        where: { userId },
        select: { code: true },
      });
      const newCodes = evaluateAchievements(
        {
          points: xp,
          currentStreak: streak.currentStreak,
          answersCount,
          correctCount,
        },
        unlocked.map((u) => u.code),
      );

      await tx.gamificationStat.update({
        where: { userId },
        data: {
          points: xp,
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
        xpGained,
        breakdown: { base, comboMultiplier, dailyBonus },
        xp,
        level: after.level,
        leveledUp: after.level > before.level,
        league: { key: leagueAfter.key, name: leagueAfter.name },
        leagueChanged: leagueAfter.key !== leagueBefore.key,
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

    const xp = stat?.points ?? 0;
    const levelInfo = levelFromXp(xp);
    const league = leagueForLevel(levelInfo.level);

    return {
      enabled: true as const,
      xp,
      level: levelInfo.level,
      league: { key: league.key, name: league.name },
      progress: {
        into: levelInfo.xpIntoLevel,
        forNext: levelInfo.xpForNextLevel,
        pct: levelInfo.progress,
      },
      currentStreak: stat?.currentStreak ?? 0,
      longestStreak: stat?.longestStreak ?? 0,
      lastActivityOn: stat?.lastActivityOn ?? null,
      answersCount: stat?.answersCount ?? 0,
      correctCount: stat?.correctCount ?? 0,
      achievementsUnlocked: unlocked,
      achievementsTotal: ACHIEVEMENTS.length,
    };
  }

  private startOfDayUtc(now: Date): Date {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  /** Status do desafio diário (ou { enabled: false } se a gamificação está off). */
  async getDailyChallenge(userId: string, now: Date = new Date()) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const spec = dailyChallengeFor(now);
    const [answeredToday, log] = await Promise.all([
      this.prisma.answer.count({
        where: { userId, createdAt: { gte: this.startOfDayUtc(now) } },
      }),
      this.prisma.dailyChallengeLog.findUnique({
        where: { userId_day: { userId, day: spec.day } },
        select: { id: true },
      }),
    ]);
    return {
      enabled: true as const,
      ...dailyChallengeStatus(spec, answeredToday, !!log),
    };
  }

  /**
   * Resgata a recompensa do desafio diário (uma vez por dia, se concluído).
   * Credita o XP em GamificationStat.points.
   */
  async claimDailyChallenge(userId: string, now: Date = new Date()) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const spec = dailyChallengeFor(now);

    return this.prisma.$transaction(async (tx) => {
      const answeredToday = await tx.answer.count({
        where: { userId, createdAt: { gte: this.startOfDayUtc(now) } },
      });
      if (answeredToday < spec.goal) {
        return {
          ...dailyChallengeStatus(spec, answeredToday, false),
          enabled: true as const,
          claimed: false as const,
          xpAwarded: 0,
          reason: 'incompleto' as const,
        };
      }

      // Marca o resgate; o índice único garante uma vez por dia.
      try {
        await tx.dailyChallengeLog.create({
          data: { userId, day: spec.day },
        });
      } catch {
        return {
          ...dailyChallengeStatus(spec, answeredToday, true),
          enabled: true as const,
          claimed: true as const,
          xpAwarded: 0,
          reason: 'ja_resgatado' as const,
        };
      }

      const stat = await tx.gamificationStat.upsert({
        where: { userId },
        create: { userId, points: spec.xpReward },
        update: { points: { increment: spec.xpReward } },
      });
      const level = levelFromXp(stat.points);

      return {
        ...dailyChallengeStatus(spec, answeredToday, true),
        enabled: true as const,
        claimed: true as const,
        xpAwarded: spec.xpReward,
        xp: stat.points,
        level: level.level,
      };
    });
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
