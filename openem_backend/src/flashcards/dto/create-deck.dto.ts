import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateDeckDto {
  @ApiProperty({ description: 'Título do deck' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Descrição do deck' })
  @IsString()
  @MaxLength(2000)
  description!: string;

  @ApiProperty({
    description:
      'Matéria/área do knowledge (ex: "Matemática e suas Tecnologias")',
  })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({
    description: 'Tópico dentro da matéria (opcional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiProperty({
    description: 'Ícone do deck (emoji)',
    default: '📚',
    required: false,
  })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Deck público (visível para todos)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
