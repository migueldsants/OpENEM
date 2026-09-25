import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Liga por padrão: só `false` explícito desliga. */
const padraoLigado = () =>
  Transform(({ value }) => value !== 'false' && value !== false);

/**
 * Caderno de fórmulas em PDF. Sem filtro nenhum, sai o catálogo inteiro com
 * capa, sumário, explicações e legenda, em duas colunas e no tema padrão.
 *
 * A seleção se combina: matérias E assuntos E (só favoritas) E, se vier,
 * a lista exata de fórmulas. A tela manda a lista exata (o aluno pode tirar
 * fórmula por fórmula); os outros filtros servem a quem usa a API direto.
 */
export class FormulasPdfDto {
  @ApiPropertyOptional({ type: [String], description: 'Fórmulas escolhidas' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  formulaIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Matérias' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Assuntos' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  topicIds?: string[];

  @ApiPropertyOptional({ description: 'Só as fórmulas favoritas do aluno' })
  @IsOptional()
  @IsBoolean()
  onlyFavorites?: boolean;

  @ApiPropertyOptional({ description: 'Título na capa e no cabeçalho' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ description: 'Nome do aluno na capa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  studentName?: string;

  @ApiPropertyOptional({ description: 'Tema de cor (mesmos temas do app)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'brandColor deve ser uma cor hexadecimal (#rrggbb)',
  })
  brandColor?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @padraoLigado()
  @IsBoolean()
  cover?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Sumário por assunto' })
  @IsOptional()
  @padraoLigado()
  @IsBoolean()
  toc?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Legenda dos símbolos' })
  @IsOptional()
  @padraoLigado()
  @IsBoolean()
  legend?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Explicação curta' })
  @IsOptional()
  @padraoLigado()
  @IsBoolean()
  descriptions?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @padraoLigado()
  @IsBoolean()
  twoColumns?: boolean;
}
