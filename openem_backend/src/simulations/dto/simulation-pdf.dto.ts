import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SimulationFiltersDto } from './start-simulation.dto';

/**
 * Opções do caderno em PDF. Tudo é opcional: sem nada, sai o caderno completo
 * (capa + questões + cartão-resposta + gabarito) no tema padrão.
 */
export class SimulationPdfDto extends SimulationFiltersDto {
  @ApiPropertyOptional({
    description: 'Gera o PDF de um template (prova oficial ou salvo)',
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Título impresso na capa' })
  @IsOptional()
  @IsString()
  @MaxLength(90)
  title?: string;

  @ApiPropertyOptional({ description: 'Nome do aluno na capa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  studentName?: string;

  @ApiPropertyOptional({
    description: 'Tema de cor do caderno (mesmos temas do app)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @ApiPropertyOptional({
    description: 'Cor da marca em hexadecimal, para o tema personalizado',
    example: '#2563eb',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'brandColor deve ser uma cor hexadecimal (#rrggbb)',
  })
  brandColor?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  cover?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  answerSheet?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  answerKey?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Inclui os comentários das questões que têm resolução',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  explanations?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Duas colunas, como o caderno oficial',
  })
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  twoColumns?: boolean;
}
