import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpsertQuestionNoteDto {
  @ApiProperty({ description: 'Questão associada à nota' })
  @IsString()
  questionId!: string;

  @ApiProperty({ description: 'Conteúdo da nota (Markdown)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string;
}
