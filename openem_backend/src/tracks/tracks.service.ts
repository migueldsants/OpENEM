import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CATALOG_TTL_MS } from '../cache/catalog-invalidation';
import { toPercent } from '../common/mastery';
import { loadTopicAnswers } from '../performance/topic-answers';
import { PrismaService } from '../prisma/prisma.service';
import { loadIncidence } from './incidence-query';
import {
  buildTrackView,
  overallMastery,
  resolveTracks,
  suggestStages,
  type Language,
  type SuggestedStage,
  type TrackView,
  type TracksCatalog,
} from './track-view';
import { TRACKS } from './tracks-catalog';

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Trilhas resolvidas e incidência: iguais para todo aluno e só mudam com o
   * import ou a classificação, que dão `bump('catalog')`. Nada do aluno entra
   * aqui.
   */
  catalog(): Promise<TracksCatalog> {
    return this.cache.getOrSet(
      ['tracks'],
      CATALOG_TTL_MS,
      async () => {
        const [incidence, subjects] = await Promise.all([
          loadIncidence(this.prisma),
          this.prisma.subject.findMany({
            select: {
              id: true,
              name: true,
              subjectArea: { select: { id: true, name: true } },
              topics: { select: { id: true, name: true } },
            },
          }),
        ]);
        return {
          window: incidence.window,
          tracks: resolveTracks(TRACKS, subjects, incidence),
        };
      },
      { ns: 'catalog' },
    );
  }

  private async views(userId: string) {
    const [catalog, answers, profile] = await Promise.all([
      this.catalog(),
      loadTopicAnswers(this.prisma, userId),
      this.prisma.profile.findUnique({
        where: { userId },
        select: { foreignLanguage: true },
      }),
    ]);
    const language: Language =
      profile?.foreignLanguage === 'espanhol' ? 'espanhol' : 'ingles';
    return {
      catalog,
      language,
      views: catalog.tracks.map((t) => buildTrackView(t, answers, language)),
    };
  }

  /** Tela geral: o que cai em cada matéria e quanto o aluno domina. */
  async overview(userId: string) {
    const { catalog, language, views } = await this.views(userId);
    return {
      window: catalog.window,
      language,
      overall: overallMastery(views),
      suggestions: suggestStages(views, 2),
      subjects: views.map((v) => ({
        id: v.subjectId,
        name: v.subjectName,
        area: v.area,
        perExam: v.perExam,
        mastery: toPercent(v.mastery),
        answered: v.answered,
        currentStage: v.currentStage,
        stages: v.stages.map((s) => ({
          title: s.title,
          done: s.done,
          practicable: s.practicable,
        })),
      })),
    };
  }

  /** Trilha de uma matéria, com a incidência e o domínio de cada assunto. */
  async detail(userId: string, subjectId: string) {
    const { catalog, language, views } = await this.views(userId);
    const view = views.find((v) => v.subjectId === subjectId);
    if (!view) throw new NotFoundException('Matéria sem trilha');
    return {
      ...publicView(view),
      window: catalog.window,
      language,
    };
  }

  /**
   * A etapa que a recomendação usa quando o aluno não tem erros recentes
   * (aluno novo, ou que acertou tudo).
   */
  async suggestedStage(userId: string): Promise<SuggestedStage | null> {
    const { views } = await this.views(userId);
    return suggestStages(views, 1)[0] ?? null;
  }
}

function publicView(v: TrackView) {
  return {
    subject: { id: v.subjectId, name: v.subjectName, area: v.area },
    perExam: v.perExam,
    mastery: toPercent(v.mastery),
    answered: v.answered,
    currentStage: v.currentStage,
    stages: v.stages,
    extras: v.extras,
  };
}
