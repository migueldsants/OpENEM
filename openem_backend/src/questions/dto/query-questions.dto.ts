import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryQuestionsDto {
  @ApiPropertyOptional({
    description: 'Filtra pela área do conhecimento (SubjectArea)',
  })
  @IsOptional()
  @IsString()
  subjectAreaId?: string;

  @ApiPropertyOptional({ description: 'Filtra pela matéria (Subject)' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filtra pelo assunto (Topic)' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Nível 1..5' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ description: 'Ano da prova oficial' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1998)
  year?: number;

  @ApiPropertyOptional({
    description: 'Prova específica: "2023", "2023-reaplicacao"',
  })
  @IsOptional()
  @IsString()
  examSlug?: string;

  @ApiPropertyOptional({
    enum: ['ingles', 'espanhol'],
    description:
      'Língua estrangeira do aluno. Traz as questões comuns mais as da língua escolhida — o banco guarda inglês e espanhol da mesma questão.',
  })
  @IsOptional()
  @IsIn(['ingles', 'espanhol'])
  language?: string;

  @ApiPropertyOptional({
    description:
      'Busca pelo código da questão, por prefixo: "ENEM-2023-136", "2023 136", "2023".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
