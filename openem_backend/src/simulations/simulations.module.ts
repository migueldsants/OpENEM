import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';

@Module({
  imports: [ReviewModule],
  controllers: [SimulationsController],
  providers: [SimulationsService],
})
export class SimulationsModule {}
