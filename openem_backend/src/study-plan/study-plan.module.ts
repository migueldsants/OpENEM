import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { PerformanceModule } from '../performance/performance.module';
import { StudyPlanController } from './study-plan.controller';
import { StudyPlanService } from './study-plan.service';

@Module({
  imports: [PerformanceModule, GamificationModule],
  controllers: [StudyPlanController],
  providers: [StudyPlanService],
})
export class StudyPlanModule {}
