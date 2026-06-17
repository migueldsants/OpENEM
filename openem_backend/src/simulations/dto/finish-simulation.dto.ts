import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SimulationAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Alternativa escolhida (ausente = em branco)',
  })
  @IsOptional()
  @IsString()
  chosenId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSec?: number;
}

export class FinishSimulationDto {
  @ApiProperty({ type: [SimulationAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulationAnswerDto)
  answers!: SimulationAnswerDto[];
}
