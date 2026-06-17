import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryQuestionsDto {
  @ApiPropertyOptional({ description: 'Filtra pela área (Subject)' })
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
