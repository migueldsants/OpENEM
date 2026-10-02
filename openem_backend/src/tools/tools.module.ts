import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  providers: [ToolsService],
  controllers: [ToolsController],
})
export class ToolsModule {}
