import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Fórmula personalizada do usuário (issue #38). */
export class CreateFormulaDto {
  @ApiProperty({ description: 'Nome da fórmula' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: 'Expressão em LaTeX' })
  @IsString()
  @MaxLength(2000)
  latex!: string;

  @ApiPropertyOptional({ description: 'Contexto/observação' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Matéria da fórmula' })
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ description: 'Assunto (tópico) relacionado' })
  @IsOptional()
  @IsString()
  topicId?: string;
}
