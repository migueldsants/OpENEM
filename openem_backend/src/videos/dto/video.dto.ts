import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Salva um vídeo na biblioteca (issue #37). */
export class CreateVideoDto {
  @ApiProperty({ description: 'Link do YouTube (ou ID do vídeo)' })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  url!: string;

  @ApiPropertyOptional({ description: 'Matéria do vídeo' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class UpdateVideoDto {
  @ApiPropertyOptional({ description: 'Nova matéria (null para limpar)' })
  @IsOptional()
  @IsString()
  subjectId?: string | null;
}

export class AddVideoNoteDto {
  @ApiProperty({ description: 'Instante da nota, em segundos', minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(86400)
  timestampSec!: number;

  @ApiProperty({ description: 'Conteúdo da nota' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
