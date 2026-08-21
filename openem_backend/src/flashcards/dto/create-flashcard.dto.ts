import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class CreateFlashcardDto {
  @ApiProperty({ description: 'Frente do card (Markdown — pergunta)' })
  @IsString()
  @IsNotEmpty()
  front!: string;

  @ApiProperty({ description: 'Verso do card (Markdown — resposta)' })
  @IsString()
  @IsNotEmpty()
  back!: string;
}

export class ReviewFlashcardDto {
  @ApiProperty({
    description: 'Qualidade da lembrança (0-5)',
    minimum: 0,
    maximum: 5,
  })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}

export class VoteDeckDto {
  @ApiProperty({ description: 'Voto: up ou down' })
  @IsString()
  @IsNotEmpty()
  vote!: 'up' | 'down';
}
