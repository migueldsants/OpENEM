/**
 * Monta as trilhas da tela Matérias (discussão #122): o catálogo resolvido
 * contra o banco (ids, incidência) e a visão de um aluno (domínio, etapa
 * atual). Lógica pura; o serviço só lê o banco e o perfil.
 */
import type { IncidenceWindow, TopicIncidence } from '../common/incidence';
import {
  OVERALL_MIN_ANSWERS,
  toPercent,
  topicMastery,
  weightedMastery,
  type MasteryState,
  type TopicAnswers,
} from '../common/mastery';
import { LANGUAGE_TOPICS, type TrackDef } from './tracks-catalog';

export type Language = 'ingles' | 'espanhol';

export interface ResolvedTopic {
  id: string;
  name: string;
  perExam: number;
  primaryPerExam: number;
  years: number;
  byYear: number[];
  /** Questões do assunto no banco inteiro: zero quer dizer que não dá para treinar. */
  bank: number;
  language: Language | null;
}

export interface ResolvedStage {
  title: string;
  why: string;
  topicIds: string[];
}

export interface ResolvedTrack {
  subjectId: string;
  subjectName: string;
  area: { id: string; name: string };
  stages: ResolvedStage[];
  extras: string[];
  topics: Record<string, ResolvedTopic>;
}

/** Igual para todo aluno: vai para o cache de catálogo. */
export interface TracksCatalog {
  window: IncidenceWindow | null;
  tracks: ResolvedTrack[];
}

export interface CatalogSubject {
  id: string;
  name: string;
  subjectArea: { id: string; name: string };
  topics: { id: string; name: string }[];
}

export interface IncidenceInput {
  topics: Record<string, TopicIncidence>;
  bank: Record<string, number>;
}

/**
 * Casa o catálogo (por nome) com as matérias e assuntos do banco. Nome do
 * catálogo que não existe no banco é ignorado; assunto do banco que o
 * catálogo não cita vai para o fim, em `extras`, para nunca sumir da tela.
 */
export function resolveTracks(
  defs: readonly TrackDef[],
  subjects: readonly CatalogSubject[],
  incidence: IncidenceInput,
): ResolvedTrack[] {
  const bySubject = new Map(subjects.map((s) => [s.name, s]));
  const out: ResolvedTrack[] = [];
  for (const def of defs) {
    const subject = bySubject.get(def.subject);
    if (!subject) continue;
    const idByName = new Map(subject.topics.map((t) => [t.name, t.id]));
    const used = new Set<string>();
    const ids = (names: readonly string[]) =>
      names.flatMap((name) => {
        const id = idByName.get(name);
        if (!id || used.has(id)) return [];
        used.add(id);
        return [id];
      });

    const stages = def.stages
      .map((s) => ({ title: s.title, why: s.why, topicIds: ids(s.topics) }))
      .filter((s) => s.topicIds.length > 0);
    const extras = ids(def.extras);
    for (const t of subject.topics) {
      if (!used.has(t.id)) extras.push(t.id);
    }

    const topics: Record<string, ResolvedTopic> = {};
    for (const t of subject.topics) {
      const inc = incidence.topics[t.id];
      topics[t.id] = {
        id: t.id,
        name: t.name,
        perExam: inc?.perExam ?? 0,
        primaryPerExam: inc?.primaryPerExam ?? 0,
        years: inc?.years ?? 0,
        byYear: inc?.byYear ?? [],
        bank: incidence.bank[t.id] ?? 0,
        language: LANGUAGE_TOPICS[t.name] ?? null,
      };
    }
    out.push({
      subjectId: subject.id,
      subjectName: subject.name,
      area: subject.subjectArea,
      stages,
      extras,
      topics,
    });
  }
  return out;
}

export interface TrackTopicView {
  id: string;
  name: string;
  perExam: number;
  years: number;
  byYear: number[];
  bank: number;
  state: MasteryState;
  /** 0..100. */
  mastery: number;
  answered: number;
  /** Acerto nas últimas 10 respostas, 0..100; null sem resposta. */
  accuracy: number | null;
}

export interface TrackStageView {
  index: number;
  title: string;
  why: string;
  perExam: number;
  /** Algum assunto da etapa tem questão no banco. */
  practicable: boolean;
  /** Todo assunto treinável da etapa está dominado. */
  done: boolean;
  topics: TrackTopicView[];
}

export interface TrackView {
  subjectId: string;
  subjectName: string;
  area: { id: string; name: string };
  perExam: number;
  /** 0..1, ponderado pela incidência. */
  mastery: number;
  answered: number;
  stages: TrackStageView[];
  extras: { perExam: number; topics: TrackTopicView[] };
  /** Primeira etapa treinável ainda não concluída; null quando acabou. */
  currentStage: number | null;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Quanto o assunto pesa na matéria. O assunto de uma língua conta tudo o que
 * caiu dele; os outros, só a parte que não é da segunda língua, para a soma
 * da matéria não contar as duas línguas.
 */
function topicWeight(t: ResolvedTopic): number {
  return t.language ? t.perExam : t.primaryPerExam;
}

export function buildTrackView(
  track: ResolvedTrack,
  answers: ReadonlyMap<string, TopicAnswers>,
  language: Language,
): TrackView {
  const visible = (id: string) => {
    const t = track.topics[id];
    return !!t && (!t.language || t.language === language);
  };
  const weightOf = new Map<string, number>();
  const topicView = (id: string): TrackTopicView => {
    const t = track.topics[id];
    const m = topicMastery(answers.get(id));
    weightOf.set(id, topicWeight(t));
    return {
      id,
      name: t.name,
      perExam: round2(topicWeight(t)),
      years: t.years,
      byYear: t.byYear,
      bank: t.bank,
      state: m.state,
      mastery: toPercent(m.mastery),
      answered: m.answered,
      accuracy: m.accuracy,
    };
  };
  const sum = (topics: TrackTopicView[]) =>
    round2(topics.reduce((s, t) => s + (weightOf.get(t.id) ?? 0), 0));

  const stages: TrackStageView[] = [];
  for (const s of track.stages) {
    const topics = s.topicIds.filter(visible).map(topicView);
    if (topics.length === 0) continue;
    const treinaveis = topics.filter((t) => t.bank > 0);
    stages.push({
      index: stages.length,
      title: s.title,
      why: s.why,
      perExam: sum(topics),
      practicable: treinaveis.length > 0,
      done:
        treinaveis.length > 0 &&
        treinaveis.every((t) => t.state === 'dominado'),
      topics,
    });
  }
  const extraTopics = track.extras.filter(visible).map(topicView);
  const all = [...stages.flatMap((s) => s.topics), ...extraTopics];

  return {
    subjectId: track.subjectId,
    subjectName: track.subjectName,
    area: track.area,
    perExam: sum(all),
    mastery: weightedMastery(
      all.map((t) => ({
        weight: weightOf.get(t.id) ?? 0,
        mastery: t.mastery / 100,
      })),
    ),
    answered: all.reduce((s, t) => s + t.answered, 0),
    stages,
    extras: { perExam: sum(extraTopics), topics: extraTopics },
    currentStage: stages.find((s) => s.practicable && !s.done)?.index ?? null,
  };
}

export interface SuggestedStage {
  subjectId: string;
  subjectName: string;
  areaName: string;
  stageIndex: number;
  title: string;
  topicIds: string[];
}

/**
 * Por onde começar: a etapa atual das matérias que mais rendem para o aluno
 * agora, `questões por prova × (1 − domínio)`. Sem incidência (banco de
 * demonstração), vale a ordem do catálogo.
 */
export function suggestStages(
  views: readonly TrackView[],
  limit = 2,
): SuggestedStage[] {
  return views
    .map((v, order) => ({ v, order, score: v.perExam * (1 - v.mastery) }))
    .filter(({ v }) => v.currentStage !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ v }) => {
      const stage = v.stages[v.currentStage!];
      return {
        subjectId: v.subjectId,
        subjectName: v.subjectName,
        areaName: v.area.name,
        stageIndex: stage.index,
        title: stage.title,
        topicIds: stage.topics.map((t) => t.id),
      };
    });
}

export interface OverallMastery {
  /** 0..100. */
  mastery: number;
  answered: number;
  /** A tela só mostra a porcentagem geral a partir de `OVERALL_MIN_ANSWERS`. */
  enough: boolean;
}

export function overallMastery(views: readonly TrackView[]): OverallMastery {
  const answered = views.reduce((s, v) => s + v.answered, 0);
  return {
    mastery: toPercent(
      weightedMastery(
        views.map((v) => ({ weight: v.perExam, mastery: v.mastery })),
      ),
    ),
    answered,
    enough: answered >= OVERALL_MIN_ANSWERS,
  };
}
