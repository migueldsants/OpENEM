import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_QUESTIONS, MIN_QUESTIONS } from '../../common/simulation-filters';

/**
 * Filtros do simulado personalizado. Os campos no plural são os do montador
 * por tema (o aluno escolhe várias áreas/matérias/assuntos de uma vez); os no
 * singular continuam aceitos porque a versão anterior da API os usava.
 */
export class SimulationFiltersDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Áreas do conhecimento. É o filtro que alcança as questões oficiais ainda não classificadas em matéria.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  subjectAreaIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Matérias' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Assuntos (temas)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  topicIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Provas: "2023", "2023-reaplicacao"',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  examSlugs?: string[];

  /** Compatibilidade com a API anterior (filtro único). */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  subjectAreaId?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Ano mínimo da prova' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1998)
  yearFrom?: number;

  @ApiPropertyOptional({ description: 'Ano máximo da prova' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1998)
  yearTo?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({
    enum: ['ingles', 'espanhol'],
    description:
      'Idioma da língua estrangeira. Omitido, usa o do perfil do aluno.',
  })
  @IsOptional()
  @IsIn(['ingles', 'espanhol'])
  language?: string;

  @ApiPropertyOptional({ minimum: MIN_QUESTIONS, maximum: MAX_QUESTIONS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_QUESTIONS)
  @Max(MAX_QUESTIONS)
  questionCount?: number;

  @ApiPropertyOptional({ description: 'Tempo do simulado, em minutos' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  timeLimitMin?: number;

  @ApiPropertyOptional({
    description: 'Sorteio ponderado pela incidência no ENEM (Pareto)',
  })
  @IsOptional()
  @IsBoolean()
  pareto?: boolean;

  @ApiPropertyOptional({ description: 'Só questões nunca respondidas' })
  @IsOptional()
  @IsBoolean()
  unseenOnly?: boolean;

  @ApiPropertyOptional({ description: 'Só questões favoritadas' })
  @IsOptional()
  @IsBoolean()
  onlyFavorites?: boolean;

  @ApiPropertyOptional({ description: 'Só questões que o aluno errou antes' })
  @IsOptional()
  @IsBoolean()
  wrongOnly?: boolean;
}

export class StartSimulationDto extends SimulationFiltersDto {
  @ApiPropertyOptional({
    description:
      'Template do simulado (prova oficial, por área ou personalizado salvo). ' +
      'Sem ele, o simulado é montado só com os filtros.',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description:
      'Salva este recorte como um simulado personalizado com o nome dado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  saveAs?: string;
}

/** Corpo de `POST /simulations/templates` (salvar um simulado por tema). */
export class CreateTemplateDto extends SimulationFiltersDto {
  @ApiProperty({ maxLength: 60 })
  @IsString()
  @MaxLength(60)
  name!: string;
}
