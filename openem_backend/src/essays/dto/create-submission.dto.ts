import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Teto do texto da redação. A folha do ENEM tem 30 linhas (uns 3 mil
 * caracteres); o teto dá folga para quem digita, sem deixar que cada correção
 * por IA vire uma chamada paga do tamanho do corpo da requisição.
 */
export const ESSAY_MAX_LENGTH = 8000;

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Tema (EssayPrompt) escolhido' })
  @IsString()
  promptId!: string;

  @ApiProperty({
    description: 'Texto da redação',
    maxLength: ESSAY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(ESSAY_MAX_LENGTH)
  content!: string;
}
