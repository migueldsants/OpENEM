import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Todos os campos opcionais — PATCH atualiza só o que foi enviado. */
export class UpdateDeckDto {
  @ApiProperty({ description: 'Título do deck', required: false })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Descrição do deck', required: false })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Matéria/área do knowledge',
    required: false,
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({
    description: 'Tópico dentro da matéria',
    required: false,
  })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({
    description: 'Subtema dentro do tópico',
    required: false,
  })
  @IsString()
  @IsOptional()
  subtheme?: string;

  @ApiProperty({ description: 'Ícone do deck (emoji)', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ description: 'Deck público', required: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
