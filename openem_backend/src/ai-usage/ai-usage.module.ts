import { Module } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';

/** Cota das chamadas pagas à IA (hoje, os comentários gerados das questões). */
@Module({
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
