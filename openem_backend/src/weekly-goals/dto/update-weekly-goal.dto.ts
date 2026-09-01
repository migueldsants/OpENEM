import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Atualização dos alvos de uma meta semanal (issue #44). */
export class UpdateWeeklyGoalDto {
  @ApiPropertyOptional({
    description: 'Nova meta de tempo na semana, em minutos',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetMinutes?: number;

  @ApiPropertyOptional({
    description: 'Nova meta de questões na semana',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetQuestions?: number;
}
