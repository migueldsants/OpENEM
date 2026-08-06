import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [GamificationModule],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
