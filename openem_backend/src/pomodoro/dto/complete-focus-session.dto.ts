import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Registro de sessão de foco concluída (issue #41). */
export class CompleteFocusSessionDto {
  @ApiProperty({
    description: 'Duração da sessão em segundos (30s a 4h)',
    minimum: 30,
    maximum: 14400,
  })
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(14400)
  durationSec!: number;

  @ApiProperty({ description: 'Momento em que a sessão começou (ISO 8601)' })
  @IsISO8601()
  startedAt!: string;

  @ApiPropertyOptional({ description: 'Matéria estudada na sessão' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}
