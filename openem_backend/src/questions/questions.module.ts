import { Module } from '@nestjs/common';
import { ExplanationService } from './explanation.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, ExplanationService],
})
export class QuestionsModule {}
