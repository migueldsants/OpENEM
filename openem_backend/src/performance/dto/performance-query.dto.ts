import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type PerformancePeriod = '7d' | '30d' | 'all';

export class PerformanceQueryDto {
  @ApiPropertyOptional({
    enum: ['7d', '30d', 'all'],
    default: '30d',
    description: 'Janela de tempo das estatísticas (7d/30d/all)',
  })
  @IsOptional()
  @IsIn(['7d', '30d', 'all'])
  period?: PerformancePeriod;
}
