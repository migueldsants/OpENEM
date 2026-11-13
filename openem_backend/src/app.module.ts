import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnswersModule } from './answers/answers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { resolveJwtSecret } from './common/jwt-secret';
import { rateLimitMessage } from './common/rate-limit';
import {
  burstConfigFromEnv,
  throttleConfigFromEnv,
} from './common/throttle-config';
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
import { TracksModule } from './tracks/tracks.module';
import { StudyResourcesModule } from './study-resources/study-resources.module';
import { AppThrottlerGuard } from './rate-limit/app-throttler.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { RateThrottlerStorage } from './rate-limit/rate-throttler.storage';
import { makeTracker } from './rate-limit/tracker';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CacheModule,
    RateLimitModule,
    // Rate limiting (issues #49 e #87), contado em cada rota separadamente e
    // por aluno quando o pedido traz um JWT válido (por IP quando não traz):
    // - `burst`: rajada curta, 20 pedidos por segundo;
    // - `default`: 100 por minuto (THROTTLE_TTL_MS/THROTTLE_LIMIT).
    // Os contadores ficam no Redis (RateThrottlerStorage), valendo para todas
    // as instâncias. Rotas caras (login, cadastro, PDF, IA, fórum, temas) têm
    // limites próprios via @Throttle; a tabela está na documentação de produção
    // (openem_site/src/docs/conteudo/hospedar/04-producao.md).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RateThrottlerStorage],
      useFactory: (config: ConfigService, storage: RateThrottlerStorage) => ({
        throttlers: [
          {
            name: 'burst',
            ...burstConfigFromEnv({
              THROTTLE_BURST_TTL_MS: config.get<string>(
                'THROTTLE_BURST_TTL_MS',
              ),
              THROTTLE_BURST_LIMIT: config.get<string>('THROTTLE_BURST_LIMIT'),
            }),
          },
          {
            name: 'default',
            ...throttleConfigFromEnv({
              THROTTLE_TTL_MS: config.get<string>('THROTTLE_TTL_MS'),
              THROTTLE_LIMIT: config.get<string>('THROTTLE_LIMIT'),
            }),
          },
        ],
        storage,
        getTracker: makeTracker(
          new JwtService({ secret: resolveJwtSecret(config) }),
        ),
        // O AppThrottlerGuard troca pela mensagem com a espera.
        errorMessage: rateLimitMessage(60),
      }),
    }),
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
    TracksModule,
    StudyResourcesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global de rate limiting — todos os endpoints contam no limite.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
