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
  LEAGUES,
  leagueForLevel,
  levelFromXp,
  pointsForAnswer,
  updateStreak,
  xpToReachLevel,
} from '../common/gamification';

/** Chaves de ação registradas no XpLog (issue #17). */
export type XpAction =
  | 'ANSWER'
  | 'SIMULATION'
  | 'ESSAY'
  | 'REVIEW'
  | 'STUDY_SESSION'
  | 'GAME'
  | 'DAILY_CHALLENGE';

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
      const xpGained = Math.round(basePoints * comboMultiplier) + dailyBonus;

      const xp = stat.points + xpGained;
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

      await tx.gamificationStat.update({
        where: { userId },
        data: {
          points: xp,
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

      // Histórico de XP (issue #17): um log por ação.
      const detailStr =
        detail == null ? null : typeof detail === 'string' ? detail : null;
      await tx.xpLog.create({
        data: { userId, action, xpGained, detail: detailStr },
      });

      const byCode = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));
      return {
        xpGained,
        breakdown: { base: basePoints, comboMultiplier, dailyBonus },
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
      simulationsCount: stat?.simulationsCount ?? 0,
      essaysCount: stat?.essaysCount ?? 0,
      highScoreEssays: stat?.highScoreEssays ?? 0,
      reviewsCount: stat?.reviewsCount ?? 0,
      sessionsDone: stat?.sessionsDone ?? 0,
      achievementsUnlocked: unlocked,
      achievementsTotal: ACHIEVEMENTS.length,
    };
  }

  /**
   * Histórico de XP do usuário (XpLog), opcionalmente limitado aos últimos N
   * dias. Retorna os logs ordenados do mais recente ao mais antigo.
   */
  async getHistory(userId: string, days = 30) {
    if (!(await this.isEnabled(userId))) {
      return { enabled: false as const };
    }
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(1, days));
    since.setUTCHours(0, 0, 0, 0);

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

    // Agrega XP por dia (YYYY-MM-DD UTC) para o gráfico da tela Progresso.
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const d = new Date(log.createdAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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

  /**
   * Ranking de XP (issue #19). `scope = 'league'` restringe à liga do usuário
   * que pede (ranking social entre pares); `scope = 'global'` (default) é o
   * ranking geral. Sempre inclui o próprio usuário mesmo se fora do top N.
   * Retorna { entries, scope, league? }.
   */
  async leaderboard(
    userId: string,
    scope: 'global' | 'league' = 'global',
    limit = 10,
  ) {
    const cap = Math.min(Math.max(1, limit), 50);

    // Liga do solicitante (para o scope=league). Se a gamificação está off,
    // cai no ranking global (não há como filtrar por liga sem o próprio XP).
    let leagueKey: string | null = null;
    if (scope === 'league') {
      const stat = await this.prisma.gamificationStat.findUnique({
        where: { userId },
        select: { points: true },
      });
      const xp = stat?.points ?? 0;
      leagueKey = leagueForLevel(levelFromXp(xp).level).key;
    }

    // Faixa de níveis que cobre a liga (para filtrar por nível derivado do XP).
    // Como a liga é função do nível, filtramos pelos níveis daquela liga.
    const levelRange = leagueKey
      ? LEAGUES.filter((l) => l.key === leagueKey)[0]
      : null;
    const minLevel = levelRange?.minLevel ?? 0;
    const nextLeague = levelRange
      ? LEAGUES.find((l) => l.minLevel > minLevel)
      : null;
    const maxLevelExclusive = nextLeague ? nextLeague.minLevel : Infinity;

    // Busca no máximo o necessário (issue #49): para o escopo global, `take`
    // direto; para o escopo de liga, filtra no banco pela faixa exata de XP
    // que cobre os níveis da liga (level L começa em xpToReachLevel(L), logo
    // `gte`/`lt` batem exatamente com minLevel/maxLevelExclusive).
    const minLeagueXp = leagueKey ? xpToReachLevel(minLevel) : 0;
    const maxLeagueXp =
      leagueKey && Number.isFinite(maxLevelExclusive)
        ? xpToReachLevel(maxLevelExclusive)
        : null;

    const stats = await this.prisma.gamificationStat.findMany({
      orderBy: { points: 'desc' },
      select: { userId: true, points: true },
      take: leagueKey ? undefined : cap,
      where: leagueKey
        ? {
            points: {
              gte: minLeagueXp,
              ...(maxLeagueXp != null ? { lt: maxLeagueXp } : {}),
            },
          }
        : undefined,
    });

    const enriched = stats.map((s) => ({
      userId: s.userId,
      xp: s.points,
      level: levelFromXp(s.points).level,
    }));

    // Garante que o solicitante esteja presente (mesmo sem stat ainda — XP 0).
    if (!enriched.some((e) => e.userId === userId)) {
      enriched.push({ userId, xp: 0, level: levelFromXp(0).level });
    }

    const filtered = leagueKey
      ? enriched.filter(
          (e) => e.level >= minLevel && e.level < maxLevelExclusive,
        )
      : enriched;

    const top = filtered.slice(0, cap);
    const users = await this.prisma.user.findMany({
      where: { id: { in: top.map((e) => e.userId) } },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    const nameById = new Map(
      users.map((u) => [u.id, u.profile?.displayName ?? 'Estudante']),
    );

    const entries = top.map((e) => ({
      userId: e.userId,
      displayName: nameById.get(e.userId) ?? 'Estudante',
      xp: e.xp,
      level: e.level,
    }));

    // Garante que o solicitante aparece (mesmo fora do top).
    const meInEntries = entries.some((e) => e.userId === userId);
    if (!meInEntries) {
      const me = enriched.find((e) => e.userId === userId);
      if (me) {
        entries.push({
          userId: me.userId,
          displayName: nameById.get(me.userId) ?? 'Estudante',
          xp: me.xp,
          level: me.level,
        });
      }
    }

    return {
      scope,
      league: leagueKey
        ? leagueForLevel(
            levelFromXp(enriched.find((e) => e.userId === userId)?.xp ?? 0)
              .level,
          ).name
        : null,
      entries,
    };
  }
}
