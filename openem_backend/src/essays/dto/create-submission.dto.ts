import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Tema (EssayPrompt) escolhido' })
  @IsString()
  promptId!: string;

  @ApiProperty({ description: 'Texto da redação' })
  @IsString()
  @MinLength(1)
  content!: string;
}
