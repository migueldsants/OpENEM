import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { EssaysController } from './essays.controller';
import { EssaysService } from './essays.service';

@Module({
  imports: [GamificationModule],
  controllers: [EssaysController],
  providers: [EssaysService],
})
export class EssaysModule {}
