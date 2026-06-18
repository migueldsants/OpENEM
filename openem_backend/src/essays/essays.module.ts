import { Module } from '@nestjs/common';
import { EssaysController } from './essays.controller';
import { EssaysService } from './essays.service';

@Module({
  controllers: [EssaysController],
  providers: [EssaysService],
})
export class EssaysModule {}
