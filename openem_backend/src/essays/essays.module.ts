import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { GamificationModule } from '../gamification/gamification.module';
import { EssaysController } from './essays.controller';
import { EssaysService } from './essays.service';

@Module({
  imports: [GamificationModule, AiUsageModule],
  controllers: [EssaysController],
  providers: [EssaysService],
})
export class EssaysModule {}
