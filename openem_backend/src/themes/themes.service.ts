import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  parseThemeTokens,
  readStoredTokens,
  type ThemeTokens,
} from '../common/theme-tokens';
import { PrismaService } from '../prisma/prisma.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import type { CommunitySort } from './dto/list-community-themes.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

/** Teto por aluno: tema é leve, mas a lista não pode crescer sem fim. */
export const MAX_THEMES_PER_USER = 30;

export interface ThemeView {
  id: string;
  name: string;
  light: ThemeTokens;
  dark: ThemeTokens;
  isPublic: boolean;
  likes: number;
  liked: boolean;
  mine: boolean;
  /** Nome de exibição do autor — nunca o e-mail. */
  author: string;
  publishedAt: Date | null;
  updatedAt: Date;
}

const ROW_SELECT = {
  id: true,
  ownerId: true,
  name: true,
  light: true,
  dark: true,
  isPublic: true,
  likes: true,
  publishedAt: true,
  updatedAt: true,
  owner: { select: { profile: { select: { displayName: true } } } },
} as const;

type Row = Prisma.UserThemeGetPayload<{ select: typeof ROW_SELECT }>;

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

function tokensOrFail(raw: unknown): string {
  // O DTO já validou; a checagem aqui garante que só JSON normalizado vai
  // para o banco mesmo se o service for chamado de outro lugar.
  const tokens = parseThemeTokens(raw);
  if (!tokens) {
    throw new BadRequestException('Cores do tema precisam ser #rrggbb');
  }
  return JSON.stringify(tokens);
}

@Injectable()
export class ThemesService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: Row, userId: string, liked = false): ThemeView | null {
    const light = readStoredTokens(row.light);
    const dark = readStoredTokens(row.dark);
    if (!light || !dark) return null;
    return {
      id: row.id,
      name: row.name,
      light,
      dark,
      isPublic: row.isPublic,
      likes: row.likes,
      liked,
      mine: row.ownerId === userId,
      author: row.owner.profile?.displayName?.trim() || 'Estudante',
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Carrega um tema do dono; de outro aluno responde 404 para não revelar que existe. */
  private async ownRow(userId: string, id: string) {
    const row = await this.prisma.userTheme.findUnique({
      where: { id },
      select: { id: true, ownerId: true, isPublic: true },
    });
    if (!row || row.ownerId !== userId) {
      throw new NotFoundException('Tema não encontrado');
    }
    return row;
  }

  async mine(userId: string): Promise<ThemeView[]> {
    const rows = await this.prisma.userTheme.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      select: ROW_SELECT,
    });
    return rows
      .map((r) => this.toView(r, userId))
      .filter((v): v is ThemeView => v !== null);
  }

  async community(
    userId: string,
    sort: CommunitySort = 'popular',
    take = 30,
    skip = 0,
  ): Promise<ThemeView[]> {
    const rows = await this.prisma.userTheme.findMany({
      where: { isPublic: true },
      orderBy:
        sort === 'recent'
          ? [{ publishedAt: 'desc' }, { id: 'asc' }]
          : [{ likes: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
      take,
      skip,
      select: {
        ...ROW_SELECT,
        likeRows: { where: { userId }, select: { id: true } },
      },
    });
    return rows
      .map((r) => this.toView(r, userId, r.likeRows.length > 0))
      .filter((v): v is ThemeView => v !== null);
  }

  async create(userId: string, dto: CreateThemeDto): Promise<ThemeView> {
    const count = await this.prisma.userTheme.count({
      where: { ownerId: userId },
    });
    if (count >= MAX_THEMES_PER_USER) {
      throw new BadRequestException(
        `Limite de ${MAX_THEMES_PER_USER} temas atingido. Apague um para criar outro.`,
      );
    }
    try {
      const row = await this.prisma.userTheme.create({
        data: {
          ownerId: userId,
          name: dto.name.trim(),
          light: tokensOrFail(dto.light),
          dark: tokensOrFail(dto.dark),
          isPublic: dto.isPublic ?? false,
          publishedAt: dto.isPublic ? new Date() : null,
        },
        select: ROW_SELECT,
      });
      return this.toView(row, userId)!;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Você já tem um tema com esse nome');
      }
      throw e;
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateThemeDto,
  ): Promise<ThemeView> {
    const current = await this.ownRow(userId, id);
    const data: Prisma.UserThemeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.light !== undefined) data.light = tokensOrFail(dto.light);
    if (dto.dark !== undefined) data.dark = tokensOrFail(dto.dark);
    if (dto.isPublic !== undefined) {
      data.isPublic = dto.isPublic;
      // Republicar volta o tema ao topo dos recentes; despublicar mantém as curtidas.
      if (dto.isPublic && !current.isPublic) data.publishedAt = new Date();
    }
    try {
      const row = await this.prisma.userTheme.update({
        where: { id },
        data,
        select: ROW_SELECT,
      });
      return this.toView(row, userId)!;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Você já tem um tema com esse nome');
      }
      throw e;
    }
  }

  async remove(userId: string, id: string) {
    await this.ownRow(userId, id);
    await this.prisma.userTheme.delete({ where: { id } });
    return { removed: true };
  }

  /** Curte ou descurte (toggle). Só tema publicado e de outro aluno. */
  async toggleLike(userId: string, id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const theme = await tx.userTheme.findUnique({
          where: { id },
          select: { ownerId: true, isPublic: true },
        });
        if (!theme || !theme.isPublic) {
          throw new NotFoundException('Tema não encontrado');
        }
        if (theme.ownerId === userId) {
          throw new BadRequestException('Não dá para curtir o próprio tema');
        }
        const existing = await tx.userThemeLike.findUnique({
          where: { themeId_userId: { themeId: id, userId } },
          select: { id: true },
        });
        if (existing) {
          await tx.userThemeLike.delete({ where: { id: existing.id } });
        } else {
          await tx.userThemeLike.create({ data: { themeId: id, userId } });
        }
        const updated = await tx.userTheme.update({
          where: { id },
          data: { likes: existing ? { decrement: 1 } : { increment: 1 } },
          select: { likes: true },
        });
        return { liked: !existing, likes: Math.max(0, updated.likes) };
      });
    } catch (e) {
      // Dois cliques simultâneos: o segundo bate no @@unique.
      if (isUniqueViolation(e)) {
        throw new ConflictException('Curtida já registrada');
      }
      throw e;
    }
  }
}
