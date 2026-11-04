import { Injectable } from '@nestjs/common';
import {
  dailyChallengeFor,
  dailyChallengeStatus,
} from '../common/daily-challenge';
import { publicName } from '../common/nickname';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACHIEVEMENTS,
  AchievementDef,
  achievementProgress,
  activeStreak,
  comboMultiplierForStreak,
  dailyBonusXp,
  evaluateAchievements,
  GamificationSnapshot,
  LEAGUES,
  leagueForLevel,
  levelFromXp,
  pointsForAnswer,
  updateStreak,
  visibleAchievements,
  xpToReachLevel,
} from '../common/gamification';
import { aheadOf, rankRows } from '../common/leaderboard';
import { addDays, startOfStudyDay, studyDay } from '../common/study-day';

/**
 * Chaves de ação registradas no XpLog (issue #17). O histórico ainda pode ter
 * linhas 'GAME', do GamesModule que foi removido.
 */
export type XpAction =
  | 'ANSWER'
  | 'SIMULATION'
  | 'ESSAY'
  | 'REVIEW'
  | 'STUDY_SESSION'
  | 'DAILY_CHALLENGE'
  | 'ACHIEVEMENT';

/** Variação aplicada após uma atividade — surge na resposta da questão. */
export interface GamificationDelta {
  xpGained: number;
  breakdown: {
    base: number;
    comboMultiplier: number;
    dailyBonus: number;
    /** XP bônus das conquistas desbloqueadas nesta atividade (issue #48). */
    achievementXp: number;
  };
  xp: number;
  level: number;
  leveledUp: boolean;
  league: { key: string; name: string };
  leagueChanged: boolean;
  currentStreak: number;
  streakIncremented: boolean;
  newAchievements: AchievementDef[];
}

/** Contadores incrementais opcionais por tipo de atividade. */
interface Counters {
  answersCount?: number;
  correctCount?: number;
  simulationsCount?: number;
  essaysCount?: number;
  highScoreEssays?: number;
  reviewsCount?: number;
  sessionsDone?: number;
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
    const base = pointsForAnswer(isCorrect);
    return this.recordActivity(userId, 'ANSWER', base, isCorrect, now, {
      answersCount: 1,
      correctCount: isCorrect ? 1 : 0,
    });
  }

  /**
   * Contabiliza uma atividade genérica que dá XP (simulado, redação, revisão,
   * sessão de cronograma). Atualiza pontos, streak e conquistas — sem tocar nos
   * contadores de questões (a menos que `counters` os incrementem).
   *
   * O combo da streak e o bônus diário se aplicam como nas respostas: a 1ª
   * atividade do dia recebe o bônus de login, e o XP é multiplicado pelo combo.
   */
  async recordActivity(
    userId: string,
    action: XpAction,
    basePoints: number,
    detail: boolean | string | null,
    now: Date = new Date(),
    counters: Counters = {},
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

      const comboMultiplier = comboMultiplierForStreak(streak.currentStreak);
      const dailyBonus = streak.incremented
        ? dailyBonusXp(streak.currentStreak)
        : 0;
      const activityXp = Math.round(basePoints * comboMultiplier) + dailyBonus;

      const xp = stat.points + activityXp;
      const next: Counters = {
        answersCount: stat.answersCount + (counters.answersCount ?? 0),
        correctCount: stat.correctCount + (counters.correctCount ?? 0),
        simulationsCount:
          stat.simulationsCount + (counters.simulationsCount ?? 0),
        essaysCount: stat.essaysCount + (counters.essaysCount ?? 0),
        highScoreEssays: stat.highScoreEssays + (counters.highScoreEssays ?? 0),
        reviewsCount: stat.reviewsCount + (counters.reviewsCount ?? 0),
        sessionsDone: stat.sessionsDone + (counters.sessionsDone ?? 0),
      };

      const before = levelFromXp(stat.points);

      const unlocked = await tx.userAchievement.findMany({
        where: { userId },
        select: { code: true },
      });
      const newCodes = evaluateAchievements(
        {
          points: xp,
          currentStreak: streak.currentStreak,
          answersCount: next.answersCount ?? 0,
          correctCount: next.correctCount ?? 0,
          simulationsCount: next.simulationsCount ?? 0,
          essaysCount: next.essaysCount ?? 0,
          highScoreEssays: next.highScoreEssays ?? 0,
          reviewsCount: next.reviewsCount ?? 0,
          sessionsDone: next.sessionsDone ?? 0,
        },
        unlocked.map((u) => u.code),
      );

      // XP bônus das conquistas desbloqueadas (issue #48): some ao total —
      // conquistas de nível podem empurrar um level acima, então `after`
      // considera o total.
      const byCode = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
      const achievementXp = newCodes.reduce(
        (sum, code) => sum + (byCode.get(code)?.xp ?? 0),
        0,
      );
      const xpTotal = xp + achievementXp;
      const after = levelFromXp(xpTotal);
      const leagueBefore = leagueForLevel(before.level);
      const leagueAfter = leagueForLevel(after.level);

      await tx.gamificationStat.update({
        where: { userId },
        data: {
          points: xpTotal,
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastActivityOn: streak.lastActivityOn,
          answersCount: next.answersCount ?? 0,
          correctCount: next.correctCount ?? 0,
          simulationsCount: next.simulationsCount ?? 0,
          essaysCount: next.essaysCount ?? 0,
          highScoreEssays: next.highScoreEssays ?? 0,
          reviewsCount: next.reviewsCount ?? 0,
          sessionsDone: next.sessionsDone ?? 0,
        },
      });

      if (newCodes.length > 0) {
        await tx.userAchievement.createMany({
          data: newCodes.map((code) => ({ userId, code })),
        });
      }

      // Histórico de XP (issue #17): um log por ação. O bônus de conquistas
      // ganha um log próprio com action ACHIEVEMENT (issue #48).
      const detailStr =
        detail == null ? null : typeof detail === 'string' ? detail : null;
      await tx.xpLog.create({
        data: { userId, action, xpGained: activityXp, detail: detailStr },
      });
      if (achievementXp > 0) {
        await tx.xpLog.create({
          data: {
            userId,
            action: 'ACHIEVEMENT',
            xpGained: achievementXp,
            detail: `Conquistas: ${newCodes
              .map((c) => byCode.get(c)?.name ?? c)
              .join(', ')}`,
          },
        });
      }

      return {
        xpGained: activityXp + achievementXp,
        breakdown: {
          base: basePoints,
          comboMultiplier,
          dailyBonus,
          achievementXp,
        },
        xp: xpTotal,
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
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { code: true },
    });
    const unlockedCodes = unlocked.map((u) => u.code);

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
      // O gravado só muda com atividade; o que vale hoje pode já ter zerado.
      currentStreak: stat ? activeStreak(stat) : 0,
      longestStreak: stat?.longestStreak ?? 0,
      lastActivityOn: stat?.lastActivityOn ?? null,
      answersCount: stat?.answersCount ?? 0,
      correctCount: stat?.correctCount ?? 0,
      simulationsCount: stat?.simulationsCount ?? 0,
      essaysCount: stat?.essaysCount ?? 0,
      highScoreEssays: stat?.highScoreEssays ?? 0,
      reviewsCount: stat?.reviewsCount ?? 0,
      sessionsDone: stat?.sessionsDone ?? 0,
      achievementsUnlocked: unlockedCodes.length,
      // Sem as aposentadas que o aluno não tem (ver `visibleAchievements`).
      achievementsTotal: visibleAchievements(unlockedCodes).length,
    };
  }

  /**
   * Histórico de XP do usuário (XpLog), opcionalmente limitado aos últimos N
   * dias. Retorna os logs ordenados do mais recente ao mais antigo.
   */
  async getHistory(userId: string, days = 30, now: Date = new Date()) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const since = startOfStudyDay(addDays(studyDay(now), -Math.max(1, days)));

    const logs = await this.prisma.xpLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        xpGained: true,
        detail: true,
        createdAt: true,
      },
    });

    // Agrega XP por dia de Brasília (YYYY-MM-DD) para o gráfico da tela Progresso.
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const key = studyDay(log.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + log.xpGained);
    }

    return {
      enabled: true as const,
      logs,
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, xp]) => ({ day, xp })),
    };
  }

  /** Status do desafio diário (ou { enabled: false } se a gamificação está off). */
  async getDailyChallenge(userId: string, now: Date = new Date()) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const spec = dailyChallengeFor(now);
    const [answeredToday, log] = await Promise.all([
      this.prisma.answer.count({
        where: { userId, createdAt: { gte: startOfStudyDay(spec.day) } },
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
        where: { userId, createdAt: { gte: startOfStudyDay(spec.day) } },
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
      // Captura apenas a violação de unicidade (P2002) = "já resgatado";
      // qualquer outro erro do banco é propagado em vez de mascarado (issue #49).
      try {
        await tx.dailyChallengeLog.create({
          data: { userId, day: spec.day },
        });
      } catch (err) {
        if (
          (err as { code?: string }).code === 'P2002' ||
          (
            err as { clientVersion?: string; message?: string }
          )?.message?.includes('UNIQUE constraint failed')
        ) {
          return {
            ...dailyChallengeStatus(spec, answeredToday, true),
            enabled: true as const,
            claimed: true as const,
            xpAwarded: 0,
            reason: 'ja_resgatado' as const,
          };
        }
        throw err;
      }

      const stat = await tx.gamificationStat.upsert({
        where: { userId },
        create: { userId, points: spec.xpReward },
        update: { points: { increment: spec.xpReward } },
      });
      // Sem o log, o gráfico de XP por dia não fechava com o XP total.
      await tx.xpLog.create({
        data: {
          userId,
          action: 'DAILY_CHALLENGE' satisfies XpAction,
          xpGained: spec.xpReward,
          detail: `Desafio diário: ${spec.goal} questões`,
        },
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

  /**
   * Catálogo de conquistas com data de desbloqueio e progresso atual (0..1)
   * de cada uma ainda travada (issue #48) — todas com barra visível.
   */
  async listAchievements(userId: string) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const [unlocked, stat] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { code: true, unlockedAt: true },
      }),
      this.prisma.gamificationStat.findUnique({ where: { userId } }),
    ]);
    const byCode = new Map(unlocked.map((u) => [u.code, u.unlockedAt]));
    const snapshot: GamificationSnapshot = {
      points: stat?.points ?? 0,
      currentStreak: stat ? activeStreak(stat) : 0,
      answersCount: stat?.answersCount ?? 0,
      correctCount: stat?.correctCount ?? 0,
      simulationsCount: stat?.simulationsCount ?? 0,
      essaysCount: stat?.essaysCount ?? 0,
      highScoreEssays: stat?.highScoreEssays ?? 0,
      reviewsCount: stat?.reviewsCount ?? 0,
      sessionsDone: stat?.sessionsDone ?? 0,
    };
    return visibleAchievements(byCode.keys()).map((a) => ({
      ...a,
      unlocked: byCode.has(a.code),
      unlockedAt: byCode.get(a.code) ?? null,
      progress: byCode.has(a.code) ? 1 : achievementProgress(a.code, snapshot),
    }));
  }

  /**
   * Ranking de XP (issue #19). `scope = 'league'` restringe à liga do usuário
   * que pede (ranking social entre pares); `scope = 'global'` (default) é o
   * ranking geral. Cada linha traz a posição real (`rank`) e `isMe`; o próprio
   * usuário sempre aparece, no fim e com a posição dele quando está fora do
   * top N. Quem desligou a gamificação não aparece no ranking dos outros nem
   * vê o ranking ({ enabled: false }).
   */
  async leaderboard(
    userId: string,
    scope: 'global' | 'league' = 'global',
    limit = 10,
  ) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const cap = Math.min(Math.max(1, limit), 50);

    const mine = await this.prisma.gamificationStat.findUnique({
      where: { userId },
      select: { points: true },
    });
    const myXp = mine?.points ?? 0;

    // A liga é função do nível, e o nível L começa em xpToReachLevel(L): a
    // faixa de XP [início da liga, início da próxima) cobre exatamente a liga.
    const league =
      scope === 'league' ? leagueForLevel(levelFromXp(myXp).level) : null;
    const nextLeague = league
      ? LEAGUES.find((l) => l.minLevel > league.minLevel)
      : undefined;
    const where = {
      NOT: { user: { profile: { is: { gamificationEnabled: false } } } },
      ...(league
        ? {
            points: {
              gte: xpToReachLevel(league.minLevel),
              ...(nextLeague
                ? { lt: xpToReachLevel(nextLeague.minLevel) }
                : {}),
            },
          }
        : {}),
    };

    const [top, ahead] = await Promise.all([
      this.prisma.gamificationStat.findMany({
        where,
        // O desempate por userId deixa a ordem estável e casa com `aheadOf`.
        orderBy: [{ points: 'desc' }, { userId: 'asc' }],
        select: { userId: true, points: true },
        take: cap,
      }),
      this.prisma.gamificationStat.count({
        where: { AND: [where, aheadOf(myXp, userId)] },
      }),
    ]);

    const rows = rankRows(
      top.map((s) => ({ userId: s.userId, xp: s.points })),
      { userId, xp: myXp, ahead },
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, profile: { select: { nickname: true } } },
    });
    const nameById = new Map(users.map((u) => [u.id, publicName(u.profile)]));

    return {
      enabled: true as const,
      scope,
      league: league?.name ?? null,
      entries: rows.map((r) => ({
        userId: r.userId,
        nickname: nameById.get(r.userId) ?? publicName(null),
        xp: r.xp,
        level: levelFromXp(r.xp).level,
        rank: r.rank,
        isMe: r.isMe,
      })),
    };
  }
}
