import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { PomodoroService } from './pomodoro.service';
import { PomodoroController } from './pomodoro.controller';

@Module({
  imports: [GamificationModule],
  providers: [PomodoroService],
  controllers: [PomodoroController],
})
export class PomodoroModule {}
