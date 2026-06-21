import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { ReviewModule } from '../review/review.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';

@Module({
  imports: [ReviewModule, GamificationModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
