import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { COMPETENCY_VALUES } from '../../common/essay-score';

const competency = (n: number) =>
  ApiProperty({
    enum: COMPETENCY_VALUES,
    description: `Competência ${n} (0..200, múltiplos de 40)`,
  });

export class EvaluateEssayDto {
  @competency(1)
  @IsIn(COMPETENCY_VALUES)
  c1!: number;

  @competency(2)
  @IsIn(COMPETENCY_VALUES)
  c2!: number;

  @competency(3)
  @IsIn(COMPETENCY_VALUES)
  c3!: number;

  @competency(4)
  @IsIn(COMPETENCY_VALUES)
  c4!: number;

  @competency(5)
  @IsIn(COMPETENCY_VALUES)
  c5!: number;

  @ApiPropertyOptional({ description: 'Comentário geral do corretor' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
