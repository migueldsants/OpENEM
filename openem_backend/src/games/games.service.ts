import { Injectable, NotFoundException } from '@nestjs/common';
import { findGame, GAMES, xpForGameScore } from '../common/games';
import {
  GamificationDelta,
  GamificationService,
} from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitGameScoreDto } from './dto/submit-game-score.dto';

function authorName(user: {
  id: string;
  profile: { displayName: string | null } | null;
}) {
  return { id: user.id, name: user.profile?.displayName ?? 'Estudante' };
}

export interface GameCatalogItem {
  key: string;
  name: string;
  description: string;
  scoring: string;
  levels: { key: string; label: string }[];
}

export interface GameScoreResult {
  id: string;
  gameKey: string;
  score: number;
  level: number;
  durationSec: number;
  createdAt: Date;
  gamification?: GamificationDelta;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  bestScore: number;
  plays: number;
}

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  listGames(): GameCatalogItem[] {
    return GAMES.map((g) => ({ ...g, levels: [...g.levels] }));
  }

  async submitScore(
    userId: string,
    dto: SubmitGameScoreDto,
  ): Promise<GameScoreResult> {
    const game = findGame(dto.gameKey);
    if (!game) {
      throw new NotFoundException('Minigame não encontrado');
    }
    const score = await this.prisma.gameScore.create({
      data: {
        userId,
        gameKey: dto.gameKey,
        score: dto.score,
        level: dto.level,
        durationSec: dto.durationSec,
      },
      select: {
        id: true,
        gameKey: true,
        score: true,
        level: true,
        durationSec: true,
        createdAt: true,
      },
    });
    // XP por jogar (issue #18): integrado à gamificação, respeitando o toggle.
    const baseXp = xpForGameScore(dto.score);
    const gamification = await this.gamification.recordActivity(
      userId,
      'GAME',
      baseXp,
      `${game.name}: ${dto.score} pontos`,
      new Date(),
      {},
    );
    return { ...score, ...(gamification ? { gamification } : {}) };
  }

  /** Ranking de um minigame específico (top N por maior score). */
  async leaderboard(gameKey: string, limit = 10): Promise<LeaderboardEntry[]> {
    const game = findGame(gameKey);
    if (!game) {
      throw new NotFoundException('Minigame não encontrado');
    }
    const rows = await this.prisma.gameScore.groupBy({
      by: ['userId'],
      where: { gameKey },
      _max: { score: true },
      _count: { _all: true },
      orderBy: { _max: { score: 'desc' } },
      take: Math.min(Math.max(1, limit), 50),
    });
    if (rows.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    const nameById = new Map(users.map((u) => [u.id, authorName(u).name]));
    return rows.map((r) => ({
      userId: r.userId,
      displayName: nameById.get(r.userId) ?? 'Estudante',
      bestScore: r._max.score ?? 0,
      plays: r._count._all,
    }));
  }

  /** Ranking geral por XP (top N usuários por GamificationStat.points). */
  async globalLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const stats = await this.prisma.gamificationStat.findMany({
      orderBy: { points: 'desc' },
      take: Math.min(Math.max(1, limit), 50),
      select: { userId: true, points: true },
    });
    if (stats.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: stats.map((s) => s.userId) } },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    const nameById = new Map(users.map((u) => [u.id, authorName(u).name]));
    return stats.map((s) => ({
      userId: s.userId,
      displayName: nameById.get(s.userId) ?? 'Estudante',
      bestScore: s.points,
      plays: 0,
    }));
  }
}
