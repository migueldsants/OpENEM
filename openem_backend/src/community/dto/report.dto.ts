import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReportDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 500,
    example: 'Ofensa a outro aluno',
    description: 'Motivo da denúncia, lido por quem modera a instalação',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
