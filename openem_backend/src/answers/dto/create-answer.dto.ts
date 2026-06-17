import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Alternativa escolhida (ausente = em branco)',
  })
  @IsOptional()
  @IsString()
  chosenId?: string;

  @ApiPropertyOptional({ description: 'Tempo gasto na questão, em segundos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentSec?: number;

  @ApiPropertyOptional({ description: 'Vincula a tentativa a um simulado' })
  @IsOptional()
  @IsString()
  simulationId?: string;
}
