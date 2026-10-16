import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formulasPdfBuffer } from '../common/pdf/formulas-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { FormulasPdfDto } from './dto/formulas-pdf.dto';
import { QueryFormulasDto } from './dto/query-formulas.dto';

/** Uma linha da legenda: o que o símbolo representa e em que unidade. */
export interface FormulaSymbolView {
  symbol: string;
  meaning: string;
  unit: string | null;
}

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
  /** Legenda dos símbolos, na ordem em que aparecem na expressão. */
  symbols: FormulaSymbolView[];
}

const FORMULA_SELECT = {
  id: true,
  title: true,
  latex: true,
  description: true,
  subjectId: true,
  topicId: true,
  isBuiltIn: true,
  ownerId: true,
  subject: { select: { name: true } },
  topic: { select: { name: true } },
  symbols: {
    orderBy: { position: 'asc' as const },
    select: { symbol: true, meaning: true, unit: true },
  },
} as const;

type FormulaRow = {
  id: string;
  title: string;
  latex: string;
  description: string | null;
  subjectId: string;
  topicId: string | null;
  isBuiltIn: boolean;
  ownerId: string | null;
  subject: { name: string } | null;
  topic: { name: string } | null;
  symbols: { symbol: string; meaning: string; unit: string | null }[];
};

/**
 * Fórmulas que o aluno enxerga: o catálogo inteiro e as personalizadas dele.
 * Antes do ownerId a personalizada aparecia para todos, o que servia para
 * espalhar spam e links de phishing. As criadas nessa época não têm dono
 * conhecido e ficam ocultas.
 */
function visibleTo(userId: string): Prisma.FormulaWhereInput {
  return { OR: [{ isBuiltIn: true }, { ownerId: userId }] };
}

/** A mesma regra de visibleTo, para uma linha já carregada. */
function canSee(
  row: { isBuiltIn: boolean; ownerId: string | null },
  userId: string,
): boolean {
  return row.isBuiltIn || row.ownerId === userId;
}

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
      symbols: row.symbols,
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

    const where: Record<string, unknown> = { AND: [visibleTo(userId)] };
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.topicId) where.topicId = query.topicId;
    if (query.onlyFavorites) where.id = { in: [...favoritedIds] };
    if (query.q) {
      // No Postgres `contains` diferencia maiúscula: `insensitive` vira ILIKE.
      // Cobre título/descrição/latex.
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { latex: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.formula.findMany({
      where,
      // Matéria › assunto › título: a tela agrupa nessa mesma ordem.
      orderBy: [
        { subject: { name: 'asc' } },
        { topic: { name: 'asc' } },
        { title: 'asc' },
      ],
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
    // A personalizada de outro aluno responde como inexistente.
    if (!row || !canSee(row, userId)) {
      throw new NotFoundException('Fórmula não encontrada');
    }
    return this.toView(row, new Set(fav ? [id] : []));
  }

  /** Fórmula personalizada do usuário (isBuiltIn=false), só para ele. */
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
    let formula: FormulaRow;
    try {
      formula = await this.prisma.formula.create({
        data: {
          title: dto.title,
          latex: dto.latex,
          description: dto.description ?? null,
          subjectId: dto.subjectId,
          topicId: dto.topicId ?? null,
          isBuiltIn: false,
          ownerId: userId,
        },
        select: FORMULA_SELECT,
      });
    } catch (e) {
      // O título é único por dono (ownerId + title).
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Você já tem uma fórmula com esse nome');
      }
      throw e;
    }
    return this.toView(formula, new Set());
  }

  /** Favorita/desfavorita (toggle, idempotente por linha única). */
  async toggleFavorite(userId: string, formulaId: string) {
    const formula = await this.prisma.formula.findUnique({
      where: { id: formulaId },
      select: { isBuiltIn: true, ownerId: true },
    });
    if (!formula || !canSee(formula, userId)) {
      throw new NotFoundException('Fórmula não encontrada');
    }

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

  /**
   * Caderno de fórmulas em PDF. Os filtros se combinam (matérias, assuntos,
   * favoritas e a lista exata vinda da tela); a ordem é a mesma da tela.
   */
  async pdf(
    userId: string,
    dto: FormulasPdfDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Pedir o id da personalizada de outro aluno não a coloca no caderno.
    const where: Record<string, unknown> = { AND: [visibleTo(userId)] };
    if (dto.subjectIds?.length) where.subjectId = { in: dto.subjectIds };
    if (dto.topicIds?.length) where.topicId = { in: dto.topicIds };

    const ids: string[][] = [];
    if (dto.formulaIds) ids.push(dto.formulaIds);
    if (dto.onlyFavorites) {
      const favoritas = await this.prisma.userFormula.findMany({
        where: { userId },
        select: { formulaId: true },
      });
      ids.push(favoritas.map((x) => x.formulaId));
    }
    if (ids.length) {
      where.id = { in: ids.reduce((a, b) => a.filter((id) => b.includes(id))) };
    }

    const rows = await this.prisma.formula.findMany({
      where,
      orderBy: [
        { subject: { name: 'asc' } },
        { topic: { name: 'asc' } },
        { title: 'asc' },
      ],
      select: FORMULA_SELECT,
    });
    if (rows.length === 0) {
      throw new BadRequestException(
        'Nenhuma fórmula nesse recorte. Escolha pelo menos uma.',
      );
    }

    const title = dto.title?.trim() || 'Fórmulas do ENEM';
    const buffer = await formulasPdfBuffer(
      rows.map((r) => ({
        title: r.title,
        latex: r.latex,
        description: r.description,
        subjectName: r.subject?.name ?? 'Outras',
        topicName: r.topic?.name ?? null,
        symbols: r.symbols,
      })),
      {
        title,
        theme: dto.theme,
        brandColor: dto.brandColor,
        cover: dto.cover,
        toc: dto.toc,
        legend: dto.legend,
        descriptions: dto.descriptions,
        twoColumns: dto.twoColumns,
        studentName: dto.studentName,
      },
    );
    return { buffer, filename: `${slug(title) || 'formulas'}.pdf` };
  }
}

/** "Fórmulas do ENEM" → "formulas-do-enem" (nome do arquivo baixado). */
function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
