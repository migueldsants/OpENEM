import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class StartSimulationDto {
  @ApiProperty({ description: 'Template do simulado (área ou completo)' })
  @IsString()
  templateId!: string;

  /** Filtros customizados (issue #40): simulado por matéria/tópico. */
  @ApiPropertyOptional({ description: 'Filtra questões por matéria' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filtra questões por assunto (tópico)' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({
    description: 'Quantidade de questões (modo rápido: 5–10)',
    minimum: 3,
    maximum: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(90)
  questionCount?: number;

  @ApiPropertyOptional({
    description: 'Ordenar por peso de frequência no ENEM (Pareto) em vez de aleatório',
  })
  @IsOptional()
  @IsBoolean()
  pareto?: boolean;
}
