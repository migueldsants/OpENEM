import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { ReviewModule } from '../review/review.module';
import { SimulationPdfService } from './simulation-pdf.service';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';

@Module({
  imports: [ReviewModule, GamificationModule],
  controllers: [SimulationsController],
  providers: [SimulationsService, SimulationPdfService],
})
export class SimulationsModule {}
