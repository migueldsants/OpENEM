import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';

@Module({
  imports: [ReviewModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
