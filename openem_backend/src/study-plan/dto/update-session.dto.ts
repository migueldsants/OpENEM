import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Edição de um bloco do cronograma (issue #46). Todos os campos opcionais. */
export class UpdateSessionDto {
  @ApiPropertyOptional({ description: 'Nome livre do bloco' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional({ description: 'Duração do bloco em minutos' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes?: number;

  @ApiPropertyOptional({ description: 'Dia do plano (0 = primeiro dia)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dayIndex?: number;

  @ApiPropertyOptional({ description: 'Marca a sessão como concluída ou não' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
