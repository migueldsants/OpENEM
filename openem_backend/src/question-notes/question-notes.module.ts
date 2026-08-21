import { Module } from '@nestjs/common';
import { QuestionNotesController } from './question-notes.controller';
import { QuestionNotesService } from './question-notes.service';

@Module({
  controllers: [QuestionNotesController],
  providers: [QuestionNotesService],
})
export class QuestionNotesModule {}
