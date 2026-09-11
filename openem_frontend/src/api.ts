// Cliente de API. Em dev, o Vite faz proxy de /api e /health para o backend.
import { enqueue } from './offline/queue';
const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
const TOKEN_KEY = 'openem.token';

/** Distingue falha de rede (fetch lança TypeError) de erro HTTP (HttpError). */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Erro de API que carrega o status HTTP, para o chamador reagir (ex.: 401). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Notificado quando uma chamada autenticada recebe 401 (token expirado/inválido),
// para o AuthProvider encerrar a sessão e levar o usuário ao login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    // Token expirado durante a sessão: limpa e encerra para não travar o usuário.
    if (res.status === 401 && token) {
      setToken(null);
      onUnauthorized?.();
    }
    throw new HttpError(
      res.status,
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ??
        `Erro ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // Corpo vazio ou `null` (ex.: GET /review/next sem revisão agendada).
  if (text === '' || text === 'null') return null as T;
  return JSON.parse(text) as T;
}

// ---- Tipos ----
export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}
export interface TopicRef {
  id: string;
  name: string;
  subject: { id: string; name: string };
}
export interface AreaRef {
  id: string;
  name: string;
}
export interface ExamRef {
  year: number;
  slug: string;
  label: string;
}
export interface Alternative {
  id: string;
  /** Letra oficial do gabarito. Nula nas questões autorais antigas. */
  letter: string | null;
  text: string;
  /** Alternativa que é uma imagem (gráficos, mapas das provas oficiais). */
  imageUrl: string | null;
}
export interface Question {
  id: string;
  /** Código da questão oficial: "ENEM-2023-136". Nulo nas autorais. */
  code?: string | null;
  /** Número no caderno oficial (1..180). */
  number?: number | null;
  /** Texto de apoio, em Markdown (pode conter imagens e LaTeX). */
  statement: string;
  /** O comando da questão, quando vem separado do apoio. */
  questionPrompt: string | null;
  difficulty: number;
  /** "ENEM_DEV" nas provas oficiais, "AUTORAL" nas demais. */
  source: string;
  /** Idioma da questão de língua estrangeira. */
  language: string | null;
  /**
   * Nulo enquanto a questão não for classificada em matéria/assunto — é o caso
   * da maior parte do banco oficial, que entra só com a área.
   */
  topic: TopicRef | null;
  subjectArea: AreaRef | null;
  examYear: ExamRef | null;
  alternatives: Alternative[];
}
export interface QuestionFacets {
  total: number;
  areas: { id: string; count: number }[];
  topics: { id: string; count: number }[];
  exams: { slug: string; count: number }[];
}
export interface ExplanationResult {
  explanation: string | null;
  source: string | null;
  /** false quando não há comentário e nenhum provedor de IA configurado. */
  available: boolean;
}
export interface Favorite {
  id: string;
  createdAt: string;
  question: Question;
}
export interface Achievement {
  code: string;
  name: string;
  description: string;
  /** XP bônus creditado ao desbloquear (issue #48). */
  xp: number;
  /** Emoji temático (issue #48). */
  icon: string;
  /** Classe Tailwind de destaque (issue #48). */
  color: string;
}
export interface GamificationDelta {
  xpGained: number;
  breakdown: {
    base: number;
    comboMultiplier: number;
    dailyBonus: number;
    achievementXp: number;
  };
  xp: number;
  level: number;
  leveledUp: boolean;
  league: { key: string; name: string };
  leagueChanged: boolean;
  currentStreak: number;
  streakIncremented: boolean;
  newAchievements: Achievement[];
}
export interface AnswerResult {
  isCorrect: boolean;
  correctAlternativeId: string | null;
  /** Nulo quando a questão ainda não tem comentário. */
  explanation: string | null;
  /** Origem do comentário: "ai:<provedor>" quando gerado por IA. */
  explanationSource?: string | null;
  gamification?: GamificationDelta;
  /** true quando a resposta foi enfileirada offline (issue #42). */
  offlineQueued?: boolean;
}
export type GamificationSummary =
  | { enabled: false }
  | {
      enabled: true;
      xp: number;
      level: number;
      league: { key: string; name: string };
      progress: { into: number; forNext: number; pct: number };
      currentStreak: number;
      longestStreak: number;
      lastActivityOn: string | null;
      answersCount: number;
      correctCount: number;
      simulationsCount: number;
      essaysCount: number;
      highScoreEssays: number;
      reviewsCount: number;
      sessionsDone: number;
      achievementsUnlocked: number;
      achievementsTotal: number;
    };
export interface AchievementView extends Achievement {
  unlocked: boolean;
  unlockedAt: string | null;
  /** Progresso 0..1 para as ainda travadas (issue #48). */
  progress: number;
}
export type DailyChallenge =
  | { enabled: false }
  | {
      enabled: true;
      day: string;
      goal: number;
      xpReward: number;
      progress: number;
      completed: boolean;
      claimed: boolean;
    };
export type DailyChallengeClaim =
  | { enabled: false }
  | {
      enabled: true;
      claimed: boolean;
      xpAwarded: number;
      xp?: number;
      level?: number;
      reason?: 'incompleto' | 'ja_resgatado';
    };

/** Entrada do histórico de XP (XpLog). */
export interface XpLogEntry {
  id: string;
  action: string;
  xpGained: number;
  detail: string | null;
  createdAt: string;
}
export type XpHistory =
  | { enabled: false }
  | { enabled: true; logs: XpLogEntry[]; byDay: { day: string; xp: number }[] };

// ---- Games (issue #18) ----
export interface GameLevel {
  key: string;
  label: string;
}
export interface GameCatalogItem {
  key: string;
  name: string;
  description: string;
  scoring: string;
  levels: GameLevel[];
}
export interface GameScoreResult {
  id: string;
  gameKey: string;
  score: number;
  level: number;
  durationSec: number;
  createdAt: string;
  gamification?: GamificationDelta;
}
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  bestScore: number;
  plays: number;
}
export interface Recommendation {
  question: Question;
  reason: string;
}
export interface ThreadAuthor {
  id: string;
  name: string;
}
export interface ForumThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  questionId: string | null;
  author: ThreadAuthor;
  replies: number;
}
export interface ForumPost {
  id: string;
  body: string;
  createdAt: string;
  author: ThreadAuthor;
  likes: number;
  liked: boolean;
}
export interface ForumThread {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  questionId: string | null;
  author: ThreadAuthor;
  posts: ForumPost[];
}
export interface ToggleLikeResult {
  liked: boolean;
  likes: number;
}
export interface PublicProfile {
  id: string;
  displayName: string;
  goal: string;
  createdAt: string;
  xp: number;
  level: number;
  league: { key: string; name: string };
  currentStreak: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  featuredAchievements: {
    code: string;
    name: string;
    description: string;
  }[];
}
export interface LeaderboardEntryXp {
  userId: string;
  displayName: string;
  xp: number;
  level: number;
}
export interface LeaderboardResult {
  scope: 'global' | 'league';
  league: string | null;
  entries: LeaderboardEntryXp[];
}
export interface Subject {
  id: string;
  name: string;
  subjectArea: AreaRef | null;
  topics: { id: string; name: string }[];
}
export interface AreaPerformance {
  id: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}
export interface PerformancePoint {
  date: string;
  total: number;
  correct: number;
  accuracy: number;
}
export interface Performance {
  overall: { total: number; correct: number; accuracy: number };
  recent: { total: number; correct: number; accuracy: number };
  bySubject: AreaPerformance[];
  byTopic: (AreaPerformance & { subjectName?: string })[];
  weakestTopics: (AreaPerformance & { subjectName?: string })[];
  timeline: PerformancePoint[];
}

/** Mapa de calor por tópico (issue #43): taxonomia completa. */
export interface HeatmapTopic {
  id: string;
  name: string;
  weight: number;
  total: number;
  correct: number;
  accuracy: number;
}
export interface HeatmapSubject {
  id: string;
  name: string;
  topics: HeatmapTopic[];
}
export interface HeatmapArea {
  id: string;
  name: string;
  subjects: HeatmapSubject[];
}

/** Meta semanal (issue #44) com progresso calculado. */
export interface WeeklyGoal {
  id: string;
  subjectAreaId: string | null;
  subjectAreaName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  topicId: string | null;
  topicName: string | null;
  targetMinutes: number;
  targetQuestions: number;
  weekStart: string;
  minutesDone: number;
  questionsDone: number;
  completed: boolean;
}

/** Uma linha da legenda: o que o símbolo representa e em que unidade. */
export interface FormulaSymbol {
  symbol: string;
  meaning: string;
  unit: string | null;
}

/** Fórmula do cheat sheet (issue #38). */
export interface Formula {
  id: string;
  title: string;
  latex: string;
  description: string | null;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  isBuiltIn: boolean;
  favorited: boolean;
  /** Legenda dos símbolos, na ordem em que aparecem na expressão. */
  symbols: FormulaSymbol[];
}

/** Sessão de foco (Pomodoro) registrada (issue #41). */
export interface FocusSession {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  durationSec: number;
  startedAt: string;
  completedAt: string;
}
export interface FocusHistory {
  sessions: FocusSession[];
  totalMinutes: number;
}
export interface FocusMinutesBySubject {
  subjectId: string | null;
  subjectName: string;
  minutes: number;
}

/** Vídeo da biblioteca pessoal (issue #37). */
export interface VideoNote {
  id: string;
  timestampSec: number;
  content: string;
  createdAt: string;
}
export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  thumbnail: string | null;
  subjectId: string | null;
  subjectName: string | null;
  watched: boolean;
  createdAt: string;
  notes: VideoNote[];
}
export interface ReviewItem {
  id: string;
  dueAt: string;
  topic: TopicRef;
}

/** Anotação pessoal do usuário em uma questão (issue #39). */
export interface QuestionNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  question: {
    id: string;
    statement: string;
    difficulty: number;
    topic: TopicRef;
  };
}
/** Versão enxuta usada ao filtrar por questionIds (histórico). */
export interface QuestionNoteRef {
  questionId: string;
  content: string;
  updatedAt: string;
}

// ---- Flashcards (issue #36) ----

export interface FlashcardDeckBrief {
  id: string;
  title: string;
  description: string;
  subject: string;
  topic: string | null;
  subtheme: string | null;
  icon: string;
  weight: number;
  upvotes: number;
  downvotes: number;
  isPublic: boolean;
  createdAt: string;
  _count: { flashcards: number };
}
export interface FlashcardItem {
  flashcardId: string;
  front: string;
  back: string;
  deckTitle: string;
  deckIcon: string;
  deckTopic?: string;
  deckSubtheme?: string;
  weight: number;
  easeFactor: number;
  intervalD: number;
  repetition: number;
  dueAt: string;
  overdue: boolean;
}
export interface FlashcardReviewResult {
  id: string;
  easeFactor: number;
  intervalD: number;
  repetition: number;
  dueAt: string;
  lastQuality: number;
}

/** Dashboard de revisão espaçada. */
export interface FlashcardStats {
  total: number;
  overdue: number;
  dueToday: number;
  reviewedToday: number;
  mature: number;
  learning: number;
  newCards: number;
  streak: number;
  avgEase: number;
  retention: number;
}

/** Preview do próximo agendamento SM-2 antes de avaliar. */
export interface FlashcardPreview {
  current: { easeFactor: number; intervalD: number; repetition: number };
  previews: {
    quality: number;
    label: string;
    intervalD: number;
    dueAt: string;
  }[];
}

/** Previsão de carga de revisão por dia. */
export interface FlashcardForecastDay {
  day: string;
  label: string;
  count: number;
  overdue: boolean;
}

/** Progresso de um deck: novos, vistos (≥1x) e revistos (≥2x). */
export interface DeckProgress {
  total: number;
  newCards: number;
  seen: number;
  reviewed: number;
}
export type DeckProgressMap = Record<string, DeckProgress>;
export interface Paginated<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}
/**
 * Bloco do cronograma (issue #46): nome livre, não mais um subtópico fixo.
 * O calendário é editável, então `label` é a fonte de verdade do que aparece.
 */
export interface StudySession {
  id: string;
  /** "Matemática", "Inglês", "Revisar simulado"… */
  label: string;
  dayIndex: number;
  minutes: number;
  done: boolean;
  position: number;
  /** Matéria do ENEM quando o nome bate com o catálogo (cor e relatórios). */
  subject: { id: string; name: string } | null;
  gamification?: GamificationDelta;
}
export interface StudyPlan {
  id: string;
  minutesPerDay: number;
  createdAt: string;
  sessions: StudySession[];
}
export interface EssayPrompt {
  id: string;
  title: string;
  theme: string;
  instructions: string;
  year: number | null;
}
/** Destaque de um erro sobre o texto da redação (start/end null = não localizado). */
export interface EssayAnnotation {
  competency: number; // 1..5
  start: number | null;
  end: number | null;
  excerpt: string;
  comment: string;
  suggestion: string;
}
export interface EssayEvaluation {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  total: number;
  feedback: string | null;
  competencyFeedback?: Record<'c1' | 'c2' | 'c3' | 'c4' | 'c5', string> | null;
  annotations?: EssayAnnotation[] | null;
  gamification?: GamificationDelta;
}
export interface EssaySubmissionSummary {
  id: string;
  submittedAt: string;
  prompt: { id: string; title: string; theme: string };
  evaluation: Pick<
    EssayEvaluation,
    'total' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5'
  > | null;
}
export interface EssaySubmissionDetail {
  id: string;
  submittedAt: string;
  content: string;
  prompt: { id: string; title: string; theme: string; instructions: string };
  evaluation: EssayEvaluation | null;
}
export interface SimulationTemplate {
  id: string;
  name: string;
  /** EXAM = um dia de prova oficial do ENEM, na ordem do caderno. */
  scope: 'AREA' | 'FULL' | 'EXAM';
  questionCount: number;
  timeLimitMin: number | null;
  subject: { id: string; name: string } | null;
  exam?: {
    slug: string;
    year: number;
    label: string;
    isReapplication: boolean;
  } | null;
  day?: number | null;
  /** Áreas do dia da prova, na ordem do caderno. */
  areas?: string[];
}
export interface SimulationStart {
  id: string;
  startedAt: string;
  timeLimitMin: number | null;
  questionCount: number;
  questions: Question[];
}
export interface SimulationAnswerInput {
  questionId: string;
  chosenId?: string;
  timeSpentSec?: number;
}
export interface SimulationResultDetail {
  questionId: string;
  isCorrect: boolean;
  chosenId: string | null;
  correctAlternativeId: string | null;
  explanation: string | null;
}
export interface SimulationResult {
  simulationId: string;
  total: number;
  correct: number;
  percentage: number;
  triScore: number | null;
  details: SimulationResultDetail[];
  gamification?: GamificationDelta;
}
export interface Profile {
  goal: string;
  minutesPerDay: number;
  displayName: string | null;
  focusMode: boolean;
  gamificationEnabled: boolean;
  onboarded: boolean;
  /** Língua estrangeira da prova: "ingles" | "espanhol". */
  foreignLanguage?: string;
}
export interface Me {
  id: string;
  email: string;
  createdAt: string;
  profile: Profile | null;
}

export const api = {
  health: () =>
    fetch('/health').then(
      (r) => r.json() as Promise<{ status: string; database: string }>,
    ),
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password },
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: () => request<Me>('/users/me'),
  updateProfile: (
    patch: Partial<
      Pick<
        Profile,
        | 'focusMode'
        | 'minutesPerDay'
        | 'goal'
        | 'displayName'
        | 'gamificationEnabled'
        | 'onboarded'
        | 'foreignLanguage'
      >
    >,
  ) => request<Me>('/users/me/profile', { method: 'PUT', body: patch }),

  subjects: () => request<Subject[]>('/subjects'),
  questions: (
    params: {
      subjectAreaId?: string;
      subjectId?: string;
      topicId?: string;
      difficulty?: number;
      /** Prova específica: "2023", "2023-reaplicacao". */
      examSlug?: string;
      language?: string;
      /** Busca por código, por prefixo: "ENEM-2023-136", "2023 136". */
      code?: string;
      page?: number;
      limit?: number;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.subjectAreaId) qs.set('subjectAreaId', params.subjectAreaId);
    if (params.subjectId) qs.set('subjectId', params.subjectId);
    if (params.topicId) qs.set('topicId', params.topicId);
    if (params.difficulty) qs.set('difficulty', String(params.difficulty));
    if (params.examSlug) qs.set('examSlug', params.examSlug);
    if (params.language) qs.set('language', params.language);
    if (params.code) qs.set('code', params.code);
    qs.set('page', String(params.page ?? 1));
    qs.set('limit', String(params.limit ?? 10));
    return request<Paginated<Question>>(`/questions?${qs.toString()}`);
  },
  exams: () => request<ExamRef[]>('/questions/exams'),
  /** Quantas questões há por área, assunto e prova (para os filtros). */
  questionFacets: (language?: string) =>
    request<QuestionFacets>(
      `/questions/facets${language ? `?language=${language}` : ''}`,
    ),
  /** Comentário da questão; gerado por IA na primeira vez, se houver provedor. */
  explanation: (questionId: string) =>
    request<ExplanationResult>(`/questions/${questionId}/explanation`, {
      method: 'POST',
    }),
  answer: async (questionId: string, chosenId: string) => {
    try {
      return await request<AnswerResult>('/answers', {
        method: 'POST',
        body: { questionId, chosenId },
      });
    } catch (err) {
      // Erro de rede (não HTTP): enfileira para sincronizar ao reconectar
      // (issue #42). A UI recebe um resultado "em branco" com pending=true.
      if (isNetworkError(err)) {
        await enqueue({
          kind: 'answer',
          key: `answer:${questionId}:${Date.now()}`,
          questionId,
          chosenId,
        });
        return {
          isCorrect: false,
          correctAlternativeId: null,
          explanation: null,
          offlineQueued: true,
        } as AnswerResult;
      }
      throw err;
    }
  },
  performance: (period: '7d' | '30d' | 'all' = '30d') =>
    request<Performance>(`/performance?period=${period}`),
  performanceHeatmap: () =>
    request<HeatmapArea[]>('/performance/heatmap'),

  weeklyGoals: () => request<WeeklyGoal[]>('/weekly-goals'),
  createWeeklyGoal: (goal: {
    subjectAreaId?: string;
    subjectId?: string;
    topicId?: string;
    targetMinutes?: number;
    targetQuestions?: number;
  }) =>
    request<WeeklyGoal>('/weekly-goals', { method: 'POST', body: goal }),
  updateWeeklyGoal: (id: string, targets: { targetMinutes?: number; targetQuestions?: number }) =>
    request<WeeklyGoal>(`/weekly-goals/${id}`, {
      method: 'PATCH',
      body: targets,
    }),
  deleteWeeklyGoal: (id: string) =>
    request<{ removed: boolean }>(`/weekly-goals/${id}`, {
      method: 'DELETE',
    }),

  formulas: (params?: {
    q?: string;
    subjectId?: string;
    topicId?: string;
    onlyFavorites?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.subjectId) search.set('subjectId', params.subjectId);
    if (params?.topicId) search.set('topicId', params.topicId);
    if (params?.onlyFavorites) search.set('onlyFavorites', 'true');
    const qs = search.toString();
    return request<Formula[]>(`/formulas${qs ? `?${qs}` : ''}`);
  },
  toggleFormulaFavorite: (id: string) =>
    request<{ favorited: boolean }>(`/formulas/${id}/favorite`, {
      method: 'POST',
    }),

  completeFocusSession: (input: {
    durationSec: number;
    startedAt: string;
    subjectId?: string;
  }) =>
    request<FocusSession & { gamification?: GamificationDelta }>(
      '/pomodoro/sessions',
      { method: 'POST', body: input },
    ),
  focusHistory: (days = 30) =>
    request<FocusHistory>(`/pomodoro/history?days=${days}`),
  focusBySubject: (days = 30) =>
    request<FocusMinutesBySubject[]>(`/pomodoro/by-subject?days=${days}`),
  focusToday: () => request<{ minutes: number }>('/pomodoro/today'),

  videos: (subjectId?: string) =>
    request<Video[]>(
      `/videos${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''}`,
    ),
  addVideo: (url: string, subjectId?: string) =>
    request<Video>('/videos', {
      method: 'POST',
      body: { url, ...(subjectId ? { subjectId } : {}) },
    }),
  updateVideoSubject: (id: string, subjectId: string | null) =>
    request<Video>(`/videos/${id}`, {
      method: 'PATCH',
      body: { subjectId },
    }),
  toggleVideoWatched: (id: string) =>
    request<Video>(`/videos/${id}/watched`, { method: 'POST' }),
  deleteVideo: (id: string) =>
    request<{ removed: boolean }>(`/videos/${id}`, { method: 'DELETE' }),
  addVideoNote: (id: string, timestampSec: number, content: string) =>
    request<VideoNote>(`/videos/${id}/notes`, {
      method: 'POST',
      body: { timestampSec, content },
    }),
  deleteVideoNote: (noteId: string) =>
    request<{ removed: boolean }>(`/videos/notes/${noteId}`, {
      method: 'DELETE',
    }),
  reviewQueue: () => request<ReviewItem[]>('/review/queue'),
  reviewNext: () => request<ReviewItem | null>('/review/next'),
  gradeReview: async (id: string, quality: number) => {
    try {
      return await request(`/review/${id}`, {
        method: 'POST',
        body: { quality },
      });
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueue({
          kind: 'review',
          key: `review:${id}:${Date.now()}`,
          reviewItemId: id,
          quality,
        });
        return { offlineQueued: true };
      }
      throw err;
    }
  },

  simulationTemplates: () =>
    request<SimulationTemplate[]>('/simulations/templates'),
  startSimulation: (
    templateId: string,
    filters?: {
      subjectId?: string;
      topicId?: string;
      questionCount?: number;
      pareto?: boolean;
    },
  ) =>
    request<SimulationStart>('/simulations', {
      method: 'POST',
      body: { templateId, ...filters },
    }),
  finishSimulation: (id: string, answers: SimulationAnswerInput[]) =>
    request<SimulationResult>(`/simulations/${id}/finish`, {
      method: 'POST',
      body: { answers },
    }),

  favorites: () => request<Favorite[]>('/favorites'),
  addFavorite: (questionId: string) =>
    request('/favorites', { method: 'POST', body: { questionId } }),
  removeFavorite: (questionId: string) =>
    request(`/favorites/${questionId}`, { method: 'DELETE' }),

  questionNotes: () => request<QuestionNote[]>('/question-notes'),
  questionNoteFor: (questionId: string) =>
    request<QuestionNote | null>(`/question-notes/${questionId}`),
  questionNotesForQuestions: (questionIds: string[]) =>
    request<QuestionNoteRef[]>(
      `/question-notes?questionIds=${questionIds.join(',')}`,
    ),
  saveQuestionNote: (questionId: string, content: string) =>
    request<QuestionNote>('/question-notes', {
      method: 'PUT',
      body: { questionId, content },
    }),
  removeQuestionNote: (questionId: string) =>
    request(`/question-notes/${questionId}`, { method: 'DELETE' }),

  // ---- Flashcards (issue #36) ----
  flashcardDecksMine: () =>
    request<FlashcardDeckBrief[]>('/flashcards/decks/mine'),
  flashcardDecksPublic: (subject?: string) =>
    request<FlashcardDeckBrief[]>(
      `/flashcards/decks/public${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`,
    ),
  flashcardDeck: (deckId: string) =>
    request<FlashcardDeckBrief & { flashcards: { id: string; front: string; back: string }[] }>(
      `/flashcards/decks/${deckId}`,
    ),
  createDeck: (data: {
    title: string;
    description: string;
    subject: string;
    topic?: string;
    subtheme?: string;
    icon?: string;
    isPublic?: boolean;
  }) => request<FlashcardDeckBrief>('/flashcards/decks', { method: 'POST', body: data }),
  updateDeck: (
    deckId: string,
    data: Partial<{
      title: string;
      description: string;
      subject: string;
      topic: string;
      subtheme: string;
      icon: string;
      isPublic: boolean;
    }>,
  ) =>
    request<FlashcardDeckBrief>(`/flashcards/decks/${deckId}`, {
      method: 'PATCH',
      body: data,
    }),
  deleteDeck: (deckId: string) =>
    request<{ removed: boolean }>(`/flashcards/decks/${deckId}`, {
      method: 'DELETE',
    }),
  addFlashcard: (deckId: string, front: string, back: string) =>
    request(`/flashcards/decks/${deckId}/flashcards`, {
      method: 'POST',
      body: { front, back },
    }),
  deleteFlashcard: (flashcardId: string) =>
    request<{ removed: boolean }>(`/flashcards/flashcards/${flashcardId}`, {
      method: 'DELETE',
    }),
  voteDeck: (deckId: string, vote: 'up' | 'down') =>
    request(`/flashcards/decks/${deckId}/vote`, { method: 'POST', body: { vote } }),
  studyQueue: (
    filters?: {
      subject?: string;
      topic?: string;
      subtheme?: string;
      deckId?: string;
    },
  ) => {
    const qs = new URLSearchParams();
    if (filters?.subject) qs.set('subject', filters.subject);
    if (filters?.topic) qs.set('topic', filters.topic);
    if (filters?.subtheme) qs.set('subtheme', filters.subtheme);
    if (filters?.deckId) qs.set('deckId', filters.deckId);
    return request<FlashcardItem[]>(`/flashcards/study/queue?${qs.toString()}`);
  },
  reviewFlashcard: (flashcardId: string, quality: number) =>
    request<FlashcardReviewResult>(`/flashcards/flashcards/${flashcardId}/review`, {
      method: 'POST',
      body: { quality },
    }),
  flashcardStats: () => request<FlashcardStats>('/flashcards/stats'),
  flashcardPreview: (flashcardId: string) =>
    request<FlashcardPreview>(`/flashcards/flashcards/${flashcardId}/preview`),
  flashcardForecast: (days = 7) =>
    request<FlashcardForecastDay[]>(`/flashcards/forecast?days=${days}`),
  flashcardDeckProgress: () =>
    request<DeckProgressMap>('/flashcards/decks/progress'),

  studyPlan: () => request<StudyPlan>('/study-plan'),
  generateStudyPlan: () =>
    request<StudyPlan>('/study-plan/generate', { method: 'POST' }),
  /** Edita um bloco: nome, duração, dia ou conclusão. */
  updateSession: (
    id: string,
    patch: Partial<
      Pick<StudySession, 'label' | 'minutes' | 'dayIndex' | 'done'>
    >,
  ) =>
    request<StudySession>(`/study-plan/sessions/${id}`, {
      method: 'PATCH',
      body: patch,
    }),
  addSession: (label: string, dayIndex: number, minutes?: number) =>
    request<StudySession>('/study-plan/sessions', {
      method: 'POST',
      body: { label, dayIndex, ...(minutes ? { minutes } : {}) },
    }),
  removeSession: (id: string) =>
    request<{ removed: boolean }>(`/study-plan/sessions/${id}`, {
      method: 'DELETE',
    }),
  /** Esvazia o cronograma, mantendo o plano para edição manual. */
  clearStudyPlan: () => request<StudyPlan>('/study-plan', { method: 'DELETE' }),

  essayPrompts: () => request<EssayPrompt[]>('/essays/prompts'),
  submitEssay: (promptId: string, content: string) =>
    request<{ id: string; promptId: string; submittedAt: string; gamification?: GamificationDelta }>('/essays/submissions', {
      method: 'POST',
      body: { promptId, content },
    }),
  essaySubmissions: () =>
    request<EssaySubmissionSummary[]>('/essays/submissions'),
  essaySubmission: (id: string) =>
    request<EssaySubmissionDetail>(`/essays/submissions/${id}`),
  essayAiAvailable: () =>
    request<{ available: boolean }>('/essays/ai-available'),
  evaluateEssayWithAi: (id: string) =>
    request<EssayEvaluation>(`/essays/submissions/${id}/ai-evaluation`, {
      method: 'POST',
    }),

  gamification: () => request<GamificationSummary>('/gamification/me'),
  achievements: () => request<AchievementView[]>('/gamification/achievements'),
  xpHistory: (days = 30) =>
    request<XpHistory>(`/gamification/history?days=${days}`),
  dailyChallenge: () =>
    request<DailyChallenge>('/gamification/daily-challenge'),
  claimDailyChallenge: () =>
    request<DailyChallengeClaim>('/gamification/daily-challenge/claim', {
      method: 'POST',
    }),

  recommendations: (limit = 5) =>
    request<Recommendation[]>(`/recommendation/next?limit=${limit}`),

  forumThreads: () => request<ForumThreadSummary[]>('/community/threads'),
  forumThread: (id: string) => request<ForumThread>(`/community/threads/${id}`),
  createThread: (title: string, body: string, questionId?: string) =>
    request<ForumThread>('/community/threads', {
      method: 'POST',
      body: { title, body, questionId },
    }),
  replyThread: (id: string, body: string) =>
    request<ForumThread>(`/community/threads/${id}/posts`, {
      method: 'POST',
      body: { body },
    }),
  togglePostLike: (threadId: string, postId: string) =>
    request<ToggleLikeResult>(
      `/community/threads/${threadId}/posts/${postId}/like`,
      { method: 'POST' },
    ),

  publicProfile: (userId: string) =>
    request<PublicProfile>(`/users/${userId}/profile`),

  xpLeaderboard: (scope: 'global' | 'league' = 'global', limit = 10) =>
    request<LeaderboardResult>(
      `/gamification/leaderboard?scope=${scope}&limit=${limit}`,
    ),

  gameCatalog: () => request<GameCatalogItem[]>('/games'),
  submitGameScore: (
    gameKey: string,
    score: number,
    level: number,
    durationSec: number,
  ) =>
    request<GameScoreResult>('/games/scores', {
      method: 'POST',
      body: { gameKey, score, level, durationSec },
    }),
  gameLeaderboard: (key: string, limit = 10) =>
    request<LeaderboardEntry[]>(`/games/${key}/leaderboard?limit=${limit}`),
  globalLeaderboard: (limit = 10) =>
    request<LeaderboardEntry[]>(`/games/leaderboard?limit=${limit}`),
};
