import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnswersModule } from './answers/answers.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommunityModule } from './community/community.module';
import { EssaysModule } from './essays/essays.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FlashcardsModule } from './flashcards/flashcards.module';
import { GamificationModule } from './gamification/gamification.module';
import { GamesModule } from './games/games.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    GamesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
