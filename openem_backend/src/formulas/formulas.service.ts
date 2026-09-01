import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { QueryFormulasDto } from './dto/query-formulas.dto';

export interface FormulaView {
  id: string;
  title: string;
  latex: string;
  description: string | null;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  isBuiltIn: boolean;
  favorited: boolean;
}

const FORMULA_SELECT = {
  id: true,
  title: true,
  latex: true,
  description: true,
  subjectId: true,
  topicId: true,
  isBuiltIn: true,
  subject: { select: { name: true } },
  topic: { select: { name: true } },
} as const;

type FormulaRow = {
  id: string;
  title: string;
  latex: string;
  description: string | null;
  subjectId: string;
  topicId: string | null;
  isBuiltIn: boolean;
  subject: { name: string } | null;
  topic: { name: string } | null;
};

@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: FormulaRow, favoritedIds: Set<string>): FormulaView {
    return {
      id: row.id,
      title: row.title,
      latex: row.latex,
      description: row.description,
      subjectId: row.subjectId,
      subjectName: row.subject?.name ?? '',
      topicId: row.topicId,
      topicName: row.topic?.name ?? null,
      isBuiltIn: row.isBuiltIn,
      favorited: favoritedIds.has(row.id),
    };
  }

  /**
   * Lista fórmulas com filtros (issue #38): busca por texto (título,
   * descrição ou LaTeX), matéria/assunto e onlyFavorites (do usuário).
   */
  async list(userId: string, query: QueryFormulasDto): Promise<FormulaView[]> {
    const favorited = await this.prisma.userFormula.findMany({
      where: { userId },
      select: { formulaId: true },
    });
    const favoritedIds = new Set(favorited.map((f) => f.formulaId));

    const where: Record<string, unknown> = {};
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.topicId) where.topicId = query.topicId;
    if (query.onlyFavorites) where.id = { in: [...favoritedIds] };
    if (query.q) {
      // SQLite LIKE é case-insensitive para ASCII; cobre título/descrição/latex.
      where.OR = [
        { title: { contains: query.q } },
        { description: { contains: query.q } },
        { latex: { contains: query.q } },
      ];
    }

    const rows = await this.prisma.formula.findMany({
      where,
      orderBy: [{ subject: { name: 'asc' } }, { title: 'asc' }],
      select: FORMULA_SELECT,
    });
    return rows.map((r) => this.toView(r, favoritedIds));
  }

  /** Detalhe de uma fórmula com o estado de favorito do usuário. */
  async get(userId: string, id: string): Promise<FormulaView> {
    const [row, fav] = await Promise.all([
      this.prisma.formula.findUnique({
        where: { id },
        select: FORMULA_SELECT,
      }),
      this.prisma.userFormula.findUnique({
        where: { userId_formulaId: { userId, formulaId: id } },
        select: { id: true },
      }),
    ]);
    if (!row) throw new NotFoundException('Fórmula não encontrada');
    return this.toView(row, new Set(fav ? [id] : []));
  }

  /** Fórmula personalizada do usuário (isBuiltIn=false). */
  async create(userId: string, dto: CreateFormulaDto): Promise<FormulaView> {
    // Valida matéria/assunto: FK quebrada viraria 500 genérico do Prisma.
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException('Matéria não encontrada');
    if (dto.topicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
        select: { id: true },
      });
      if (!topic) throw new NotFoundException('Assunto não encontrado');
    }
    const formula = await this.prisma.formula.create({
      data: {
        title: dto.title,
        latex: dto.latex,
        description: dto.description ?? null,
        subjectId: dto.subjectId,
        topicId: dto.topicId ?? null,
        isBuiltIn: false,
      },
      select: FORMULA_SELECT,
    });
    return this.toView(formula, new Set());
  }

  /** Favorita/desfavorita (toggle, idempotente por linha única). */
  async toggleFavorite(userId: string, formulaId: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { id: formulaId },
      select: { id: true },
    });
    if (!formula) throw new NotFoundException('Fórmula não encontrada');

    const existing = await this.prisma.userFormula.findUnique({
      where: { userId_formulaId: { userId, formulaId } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.userFormula.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.userFormula.create({ data: { userId, formulaId } });
    return { favorited: true };
  }
}
