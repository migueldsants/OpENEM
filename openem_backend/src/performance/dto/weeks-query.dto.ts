import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_WEEKS = 12;

export class WeeksQueryDto {
  @ApiPropertyOptional({
    default: 8,
    minimum: 1,
    maximum: MAX_WEEKS,
    description:
      'Quantas semanas devolver, contando a atual (segunda a domingo, horário de Brasília)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_WEEKS)
  weeks?: number;
}
