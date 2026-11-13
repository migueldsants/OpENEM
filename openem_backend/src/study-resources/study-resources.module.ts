import { Module } from '@nestjs/common';
import { StudyResourcesController } from './study-resources.controller';
import { StudyResourcesService } from './study-resources.service';

@Module({
  providers: [StudyResourcesService],
  controllers: [StudyResourcesController],
})
export class StudyResourcesModule {}
