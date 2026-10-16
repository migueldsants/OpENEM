import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AnswersModule } from './answers/answers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { throttleConfigFromEnv } from './common/throttle-config';
import { CommunityModule } from './community/community.module';
import { EssaysModule } from './essays/essays.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { GamificationModule } from './gamification/gamification.module';
import { HealthModule } from './health/health.module';
import { PerformanceModule } from './performance/performance.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionNotesModule } from './question-notes/question-notes.module';
import { QuestionsModule } from './questions/questions.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { ReviewModule } from './review/review.module';
import { SimulationsModule } from './simulations/simulations.module';
import { StudyPlanModule } from './study-plan/study-plan.module';
import { SubjectsModule } from './subjects/subjects.module';
import { UsersModule } from './users/users.module';
import { WeeklyGoalsModule } from './weekly-goals/weekly-goals.module';
import { FormulasModule } from './formulas/formulas.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { VideosModule } from './videos/videos.module';
import { ThemesModule } from './themes/themes.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting (issue #49): 100 req/min por IP por padrão, contados em
    // cada rota separadamente (a chave do throttler é rota + IP), e guardados
    // na memória do processo. Rotas caras (auth, PDF, IA) têm limites
    // próprios via @Throttle.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          throttleConfigFromEnv({
            THROTTLE_TTL_MS: config.get<string>('THROTTLE_TTL_MS'),
            THROTTLE_LIMIT: config.get<string>('THROTTLE_LIMIT'),
          }),
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SubjectsModule,
    QuestionsModule,
    QuestionNotesModule,
    AnswersModule,
    SimulationsModule,
    PerformanceModule,
    ReviewModule,
    FavoritesModule,
    FlashcardsModule,
    StudyPlanModule,
    EssaysModule,
    GamificationModule,
    RecommendationModule,
    CommunityModule,
    WeeklyGoalsModule,
    FormulasModule,
    PomodoroModule,
    VideosModule,
    ThemesModule,
    ToolsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global de rate limiting — todos os endpoints contam no limite.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
