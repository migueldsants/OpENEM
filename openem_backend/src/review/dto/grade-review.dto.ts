import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class GradeReviewDto {
  @ApiProperty({
    minimum: 0,
    maximum: 5,
    description: 'Qualidade da lembrança (0 = esqueceu, 5 = perfeito)',
  })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}
