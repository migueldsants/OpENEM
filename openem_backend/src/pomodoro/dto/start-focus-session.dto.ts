import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Abertura de uma sessão de foco (issue #41). */
export class StartFocusSessionDto {
  @ApiProperty({
    description: 'Duração pretendida da sessão, em segundos (30s a 4h)',
    minimum: 30,
    maximum: 14400,
  })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(14400)
  durationSec!: number;

  @ApiPropertyOptional({ description: 'Matéria estudada na sessão' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}
