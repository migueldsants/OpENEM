import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Novo bloco no calendário (issue #46): nome livre, não só matéria do ENEM. */
export class CreateSessionDto {
  @ApiProperty({
    description: 'Nome do bloco — "Matemática", "Inglês", "Revisar simulado"',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ description: 'Dia do plano (0 = primeiro dia)' })
  @IsInt()
  @Min(0)
  @Max(365)
  dayIndex!: number;

  @ApiPropertyOptional({ description: 'Duração em minutos (padrão 45)' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes?: number;
}
