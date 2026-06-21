import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty({ minLength: 3, maxLength: 140 })
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ description: 'Questão relacionada (opcional)' })
  @IsOptional()
  @IsString()
  questionId?: string;
}
