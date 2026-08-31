import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { HeatmapService } from './heatmap.service';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, HeatmapService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
