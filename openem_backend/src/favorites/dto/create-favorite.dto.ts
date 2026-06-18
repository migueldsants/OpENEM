import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({ description: 'Questão a favoritar' })
  @IsString()
  questionId!: string;
}
