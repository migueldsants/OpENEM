import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Fórmula personalizada do usuário (issue #38). */
export class CreateFormulaDto {
  @ApiProperty({ description: 'Nome da fórmula' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ description: 'Expressão em LaTeX' })
  @IsString()
  @MaxLength(2000)
  // Caractere de controle (fora tab e quebra de linha) não é LaTeX e fazia o
  // MathJax lançar exceção ao montar o caderno em PDF.
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/, {
    message: 'latex não pode ter caracteres de controle',
  })
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
