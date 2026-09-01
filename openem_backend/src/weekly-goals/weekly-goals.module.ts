import { Module } from '@nestjs/common';
import { WeeklyGoalsService } from './weekly-goals.service';
import { WeeklyGoalsController } from './weekly-goals.controller';

@Module({
  providers: [WeeklyGoalsService],
  controllers: [WeeklyGoalsController],
})
export class WeeklyGoalsModule {}
