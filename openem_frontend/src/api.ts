// Cliente de API. Em dev, o Vite faz proxy de /api e /health para o backend.
const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
const TOKEN_KEY = 'openem.token';

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
export interface Alternative {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  statement: string;
  difficulty: number;
  topic: TopicRef;
  alternatives: Alternative[];
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
}
export interface GamificationDelta {
  xpGained: number;
  breakdown: { base: number; comboMultiplier: number; dailyBonus: number };
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
  explanation: string;
  gamification?: GamificationDelta;
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
export interface StudySession {
  id: string;
  dayIndex: number;
  minutes: number;
  done: boolean;
  topic: TopicRef;
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
  scope: 'AREA' | 'FULL';
  questionCount: number;
  timeLimitMin: number | null;
  subject: { id: string; name: string } | null;
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
  explanation: string;
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
      >
    >,
  ) => request<Me>('/users/me/profile', { method: 'PUT', body: patch }),

  subjects: () => request<Subject[]>('/subjects'),
  questions: (params: {
    subjectId?: string;
    topicId?: string;
    difficulty?: number;
    page?: number;
    limit?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.subjectId) qs.set('subjectId', params.subjectId);
    if (params.topicId) qs.set('topicId', params.topicId);
    if (params.difficulty) qs.set('difficulty', String(params.difficulty));
    qs.set('page', String(params.page ?? 1));
    qs.set('limit', String(params.limit ?? 10));
    return request<Paginated<Question>>(`/questions?${qs.toString()}`);
  },
  answer: (questionId: string, chosenId: string) =>
    request<AnswerResult>('/answers', {
      method: 'POST',
      body: { questionId, chosenId },
    }),
  performance: (period: '7d' | '30d' | 'all' = '30d') =>
    request<Performance>(`/performance?period=${period}`),
  reviewQueue: () => request<ReviewItem[]>('/review/queue'),
  reviewNext: () => request<ReviewItem | null>('/review/next'),
  gradeReview: (id: string, quality: number) =>
    request(`/review/${id}`, { method: 'POST', body: { quality } }),

  simulationTemplates: () =>
    request<SimulationTemplate[]>('/simulations/templates'),
  startSimulation: (templateId: string) =>
    request<SimulationStart>('/simulations', {
      method: 'POST',
      body: { templateId },
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
    icon?: string;
    isPublic?: boolean;
  }) => request<FlashcardDeckBrief>('/flashcards/decks', { method: 'POST', body: data }),
  addFlashcard: (deckId: string, front: string, back: string) =>
    request(`/flashcards/decks/${deckId}/flashcards`, {
      method: 'POST',
      body: { front, back },
    }),
  voteDeck: (deckId: string, vote: 'up' | 'down') =>
    request(`/flashcards/decks/${deckId}/vote`, { method: 'POST', body: { vote } }),
  studyQueue: (
    filters?: { subject?: string; topic?: string; subtheme?: string },
  ) => {
    const qs = new URLSearchParams();
    if (filters?.subject) qs.set('subject', filters.subject);
    if (filters?.topic) qs.set('topic', filters.topic);
    if (filters?.subtheme) qs.set('subtheme', filters.subtheme);
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
  setSessionDone: (id: string, done: boolean) =>
    request<StudySession>(`/study-plan/sessions/${id}`, {
      method: 'PATCH',
      body: { done },
    }),

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
