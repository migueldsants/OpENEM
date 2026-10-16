import { Module } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';

/** Cota das chamadas pagas à IA, compartilhada por redações e comentários. */
@Module({
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
