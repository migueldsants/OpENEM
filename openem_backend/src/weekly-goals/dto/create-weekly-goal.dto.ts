import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Meta semanal (issue #44). O service valida que pelo menos um alvo seja > 0.
 * O escopo é opcional e hierárquico: topicId > subjectId > subjectAreaId.
 */
export class CreateWeeklyGoalDto {
  @ApiPropertyOptional({ description: 'Escopo: área do conhecimento' })
  @IsOptional()
  @IsString()
  subjectAreaId?: string;

  @ApiPropertyOptional({ description: 'Escopo: matéria' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Escopo: assunto (tópico)' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Meta de tempo na semana, em minutos (0 = sem meta de tempo)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetMinutes?: number;

  @ApiPropertyOptional({
    description: 'Meta de questões na semana (0 = sem meta de questões)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetQuestions?: number;
}
