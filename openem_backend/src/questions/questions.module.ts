import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { ExplanationService } from './explanation.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [AiUsageModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, ExplanationService],
})
export class QuestionsModule {}
