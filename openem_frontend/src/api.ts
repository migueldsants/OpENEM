// Cliente de API. Em dev, o Vite faz proxy de /api e /health para o backend.
import { enqueue } from './offline/queue';
import { parseRetryAfter, rateLimitMessage } from './lib/rate-limit';
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
    /** No 429: segundos até poder tentar de novo (Retry-After), se vier. */
    public readonly retryAfterSec: number | null = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * 429 do rate limiting: a espera vem do Retry-After e o texto é montado aqui,
 * para o aluno ler "Tente de novo em 30 s" em vez de "Erro 429".
 */
function rateLimitError(res: Response): HttpError {
  const espera = parseRetryAfter(res.headers.get('retry-after'));
  return new HttpError(429, rateLimitMessage(espera), espera);
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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // Continua TypeError (a fila offline reconhece falha de rede por ele),
    // mas com texto que o aluno entende no lugar de "Failed to fetch".
    if (err instanceof TypeError) {
      throw new TypeError(
        'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
        { cause: err },
      );
    }
    throw err;
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    // Token expirado durante a sessão: limpa e encerra para não travar o usuário.
    if (res.status === 401 && token) {
      setToken(null);
      onUnauthorized?.();
    }
    if (res.status === 429) throw rateLimitError(res);
    // 5xx chega como "Internal server error" (inglês, e sem nada a fazer):
    // melhor uma frase útil do que o texto cru do Nest.
    if (res.status >= 500) {
      throw new HttpError(
        res.status,
        'O servidor teve um problema. Tente de novo em instantes.',
      );
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

/**
 * POST que devolve um PDF. Não passa pelo `request` porque a resposta é
 * binária, e o token precisa ir no header (por isso não dá para ser um link).
 */
async function postPdf(
  path: string,
  body: unknown,
  fallbackName: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new TypeError(
      'Sem conexão com o servidor. Verifique sua internet e tente de novo.',
      { cause: err },
    );
  }
  if (!res.ok) {
    if (res.status === 429) throw rateLimitError(res);
    const data = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    throw new HttpError(
      res.status,
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ??
        'Não foi possível gerar o PDF',
    );
  }
  const nome =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
    fallbackName;
  return { blob: await res.blob(), filename: nome };
}

// ---- Tipos ----
export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}
/** Formas de entrar que este servidor oferece (variáveis de quem hospeda). */
export interface AuthOptions {
  /** Há SMTP: o "Esqueci minha senha" manda um link por e-mail. */
  passwordReset: boolean;
  /** Há cliente OAuth do Google: aparece o "Entrar com Google". */
  google: boolean;
}
export interface GoogleAuthResponse extends AuthResponse {
  /** A senha antiga, nunca confirmada, foi desativada no vínculo. */
  passwordDisabled: boolean;
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
  /** Chave do ícone; `lib/achievement-icon` resolve (issue #48). */
  icon: string;
  /** Classe Tailwind de destaque (issue #48). */
  color: string;
  /** Conquista que o app não oferece mais; só vem para quem já a tem. */
  retired?: boolean;
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
/** Uma página de respostas, em ordem de criação. */
export interface ForumPostPage {
  posts: ForumPost[];
  /** Cursor da próxima página; `null` quando esta é a última. */
  nextCursor: string | null;
}
/** Tópico com a primeira página de respostas; `replies` é o total. */
export interface ForumThread extends ForumPostPage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  questionId: string | null;
  author: ThreadAuthor;
  replies: number;
}
export interface ToggleLikeResult {
  liked: boolean;
  likes: number;
}

/** Tema de cores salvo no servidor (tela Temas). Cores sempre #rrggbb. */
export interface SavedTheme {
  id: string;
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  isPublic: boolean;
  likes: number;
  liked: boolean;
  mine: boolean;
  /** Nome de exibição do autor. */
  author: string;
  publishedAt: string | null;
  updatedAt: string;
}
export interface ThemeInput {
  name: string;
  light: Record<string, string>;
  dark: Record<string, string>;
  isPublic?: boolean;
}
export type CommunityThemeSort = 'popular' | 'recent';
interface PublicProfileBase {
  id: string;
  displayName: string;
  goal: string;
  createdAt: string;
}
/** Quem desligou a gamificação aparece sem XP, nível, sequência e conquistas. */
export type PublicProfile =
  | (PublicProfileBase & { gamificationEnabled: false })
  | PublicProfileGamified;
export interface PublicProfileGamified extends PublicProfileBase {
  gamificationEnabled: true;
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
  /** Posição real no ranking (1 = primeiro), também fora do top. */
  rank: number;
  /** A linha do próprio aluno; fora do top, vem por último. */
  isMe: boolean;
}
export type LeaderboardResult =
  | { enabled: false }
  | {
      enabled: true;
      scope: 'global' | 'league';
      league: string | null;
      entries: LeaderboardEntryXp[];
    };
/** Catálogo de conquistas, ou { enabled: false } com a gamificação desligada. */
export type AchievementsResult = AchievementView[] | { enabled: false };
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

/** Desempenho semana a semana (GET /performance/weeks, issue #90). */
export type AreaDaSemana = 'mat' | 'nat' | 'hum' | 'lin';
export interface DiaDaSemana {
  date: string;
  answers: number;
  correct: number;
  minutes: number;
  studied: boolean;
}
export interface SemanaDeEstudo {
  start: string;
  end: string;
  days: DiaDaSemana[];
  answers: number;
  correct: number;
  /** 0..100, ou null sem resposta na semana. */
  accuracy: number | null;
  minutes: number;
  daysStudied: number;
  areas: { area: AreaDaSemana; answers: number; correct: number; accuracy: number | null }[];
  /** Pontos de acerto contra a semana anterior (null se uma delas não teve resposta). */
  delta: number | null;
}
export interface PrioridadeDeEstudo {
  topicId: string;
  topic: string;
  subject: string;
  area: AreaDaSemana | null;
  answers: number;
  correct: number;
  accuracy: number;
  /** Incidência do assunto na prova, 1 a 5. */
  weight: number;
}
export interface DesempenhoSemanal {
  today: string;
  /** A semana atual primeiro. */
  weeks: SemanaDeEstudo[];
  priorities: PrioridadeDeEstudo[];
  unclassified: number;
  streak: number;
  goalMinutesPerDay: number | null;
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
/** Totais do deck depois do voto: o servidor conta um voto por aluno. */
export interface DeckVoteResult {
  id: string;
  upvotes: number;
  downvotes: number;
  myVote: 'up' | 'down';
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
/** Ferramenta aberta no GitHub (tela Ferramentas). */
export interface Tool {
  name: string;
  /** `dono/repositório` no GitHub. */
  repo: string;
  description: string;
  tags: string[];
  url: string;
  /** null quando o servidor ainda não conseguiu falar com o GitHub. */
  stars: number | null;
}
/** Recorte de um simulado personalizado (mesmos campos do backend). */
export interface SimulationFilters {
  subjectAreaIds?: string[];
  subjectIds?: string[];
  topicIds?: string[];
  examSlugs?: string[];
  yearFrom?: number;
  yearTo?: number;
  difficulty?: number;
  language?: string;
  questionCount?: number;
  timeLimitMin?: number;
  pareto?: boolean;
  unseenOnly?: boolean;
  onlyFavorites?: boolean;
  wrongOnly?: boolean;
}
export interface SimulationTemplate {
  id: string;
  name: string;
  /**
   * EXAM = um dia de prova oficial do ENEM, na ordem do caderno.
   * AREA = um bloco de uma área do conhecimento.
   * CUSTOM = montado pelo aluno (só aparece para ele).
   */
  scope: 'AREA' | 'FULL' | 'EXAM' | 'CUSTOM';
  questionCount: number;
  timeLimitMin: number | null;
  subject: { id: string; name: string } | null;
  subjectAreaId?: string | null;
  /** true nos simulados que o próprio aluno salvou — os que ele pode apagar. */
  owned?: boolean;
  /** Recorte salvo, presente só nos simulados do aluno. */
  filters?: SimulationFilters | null;
  exam?: {
    slug: string;
    year: number;
    label: string;
    isReapplication: boolean;
    /** Aplicação: REGULAR, REAPLICACAO, SEGUNDA_APLICACAO, TERCEIRA_APLICACAO,
     * DIGITAL ou REGIONAL. Ausente em backend antigo. */
    kind?: string;
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
  /** Id do simulado salvo, quando o aluno pediu para guardar o recorte. */
  savedTemplateId?: string;
}
/** Prévia de um recorte: quantas questões existem antes de começar. */
export interface SimulationPreview {
  available: number;
  /** Quantas já têm assunto — explica um tema com poucas questões. */
  classified: number;
  questionCount: number;
  timeLimitMin: number;
  description: string;
}
export interface SimulationState {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  rawScore: number | null;
  triScore: number | null;
  answersCount: number;
}
export interface PdfTheme {
  key: string;
  label: string;
  brand: string;
  surface: string;
}
/** Opções do caderno de fórmulas em PDF (todas as caixas ligadas por padrão). */
export interface FormulasPdfOptions {
  formulaIds?: string[];
  subjectIds?: string[];
  topicIds?: string[];
  onlyFavorites?: boolean;
  title?: string;
  studentName?: string;
  theme?: string;
  brandColor?: string;
  cover?: boolean;
  toc?: boolean;
  legend?: boolean;
  descriptions?: boolean;
  twoColumns?: boolean;
}
/** Opções do caderno em PDF. */
export interface PdfOptions extends SimulationFilters {
  templateId?: string;
  title?: string;
  studentName?: string;
  theme?: string;
  brandColor?: string;
  cover?: boolean;
  answerSheet?: boolean;
  answerKey?: boolean;
  explanations?: boolean;
  twoColumns?: boolean;
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
  /** A conta tem senha (a criada pelo Google pode não ter). */
  hasPassword?: boolean;
  /** Há uma conta Google vinculada. */
  googleLinked?: boolean;
}

/**
 * Começo do login com Google. É uma navegação de página inteira (a API
 * redireciona para o Google), não um fetch.
 */
export const GOOGLE_LOGIN_URL = `${API_BASE}/auth/google`;

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
  authOptions: () => request<AuthOptions>('/auth/options'),
  /** Sempre a mesma resposta, tenha o e-mail conta ou não. */
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),
  resetPassword: (token: string, password: string) =>
    request<AuthResponse>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),
  /** Troca o código de uso único da volta do Google pelo login. */
  googleExchange: (code: string) =>
    request<GoogleAuthResponse>('/auth/google/exchange', {
      method: 'POST',
      body: { code },
    }),
  /** Encerra as outras sessões e devolve um token novo para este aparelho. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<AuthResponse>('/users/me/password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
    }),
  /** Sai de todos os aparelhos, inclusive deste. */
  logoutAll: () => request<void>('/auth/logout-all', { method: 'POST' }),

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
  performanceHeatmap: () => request<HeatmapArea[]>('/performance/heatmap'),
  performanceWeeks: (weeks = 8) =>
    request<DesempenhoSemanal>(`/performance/weeks?weeks=${weeks}`),

  weeklyGoals: () => request<WeeklyGoal[]>('/weekly-goals'),
  createWeeklyGoal: (goal: {
    subjectAreaId?: string;
    subjectId?: string;
    topicId?: string;
    targetMinutes?: number;
    targetQuestions?: number;
  }) => request<WeeklyGoal>('/weekly-goals', { method: 'POST', body: goal }),
  updateWeeklyGoal: (
    id: string,
    targets: { targetMinutes?: number; targetQuestions?: number },
  ) =>
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
  /** Inicia um simulado: de um template, só com filtros, ou os dois. */
  startSimulation: (
    templateId: string | null,
    filters?: SimulationFilters & { saveAs?: string },
  ) =>
    request<SimulationStart>('/simulations', {
      method: 'POST',
      body: { ...(templateId ? { templateId } : {}), ...filters },
    }),
  /** Quantas questões o recorte tem — usado ao vivo no montador. */
  simulationPreview: (filters: SimulationFilters) =>
    request<SimulationPreview>('/simulations/preview', {
      method: 'POST',
      body: filters,
    }),
  simulation: (id: string) => request<SimulationState>(`/simulations/${id}`),
  saveSimulationTemplate: (name: string, filters: SimulationFilters) =>
    request<SimulationTemplate & { description: string }>(
      '/simulations/templates',
      { method: 'POST', body: { name, ...filters } },
    ),
  deleteSimulationTemplate: (id: string) =>
    request<{ id: string; archived: boolean }>(`/simulations/templates/${id}`, {
      method: 'DELETE',
    }),
  pdfThemes: () => request<PdfTheme[]>('/simulations/pdf-themes'),
  /**
   * Baixa o caderno em PDF. Não passa pelo `request` porque a resposta é
   * binária — e o token precisa ir no header, então não dá para usar um link.
   */
  simulationPdf: (options: PdfOptions, simulationId?: string) =>
    postPdf(
      `/simulations${simulationId ? `/${simulationId}` : ''}/pdf`,
      options,
      'openem-simulado.pdf',
    ),
  /** Caderno de fórmulas em PDF (capa, sumário, fórmulas e legenda). */
  formulasPdf: (options: FormulasPdfOptions) =>
    postPdf('/formulas/pdf', options, 'formulas.pdf'),
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
    request<
      FlashcardDeckBrief & {
        flashcards: { id: string; front: string; back: string }[];
      }
    >(`/flashcards/decks/${deckId}`),
  createDeck: (data: {
    title: string;
    description: string;
    subject: string;
    topic?: string;
    subtheme?: string;
    icon?: string;
    isPublic?: boolean;
  }) =>
    request<FlashcardDeckBrief>('/flashcards/decks', {
      method: 'POST',
      body: data,
    }),
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
    request<DeckVoteResult>(`/flashcards/decks/${deckId}/vote`, {
      method: 'POST',
      body: { vote },
    }),
  studyQueue: (filters?: {
    subject?: string;
    topic?: string;
    subtheme?: string;
    deckId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (filters?.subject) qs.set('subject', filters.subject);
    if (filters?.topic) qs.set('topic', filters.topic);
    if (filters?.subtheme) qs.set('subtheme', filters.subtheme);
    if (filters?.deckId) qs.set('deckId', filters.deckId);
    return request<FlashcardItem[]>(`/flashcards/study/queue?${qs.toString()}`);
  },
  reviewFlashcard: (flashcardId: string, quality: number) =>
    request<FlashcardReviewResult>(
      `/flashcards/flashcards/${flashcardId}/review`,
      {
        method: 'POST',
        body: { quality },
      },
    ),
  flashcardStats: () => request<FlashcardStats>('/flashcards/stats'),
  flashcardPreview: (flashcardId: string) =>
    request<FlashcardPreview>(`/flashcards/flashcards/${flashcardId}/preview`),
  flashcardForecast: (days = 7) =>
    request<FlashcardForecastDay[]>(`/flashcards/forecast?days=${days}`),
  flashcardDeckProgress: () =>
    request<DeckProgressMap>('/flashcards/decks/progress'),

  studyPlan: () => request<StudyPlan>('/study-plan'),
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
  /** Recomeça o cronograma vazio, com a semana a partir de hoje. */
  clearStudyPlan: () => request<StudyPlan>('/study-plan', { method: 'DELETE' }),

  tools: () => request<Tool[]>('/tools'),

  gamification: () => request<GamificationSummary>('/gamification/me'),
  achievements: () =>
    request<AchievementsResult>('/gamification/achievements'),
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
  forumPosts: (id: string, cursor: string) =>
    request<ForumPostPage>(
      `/community/threads/${id}/posts?cursor=${encodeURIComponent(cursor)}`,
    ),
  createThread: (title: string, body: string, questionId?: string) =>
    request<ForumThread>('/community/threads', {
      method: 'POST',
      body: { title, body, questionId },
    }),
  /** Devolve só a resposta criada. */
  replyThread: (id: string, body: string) =>
    request<ForumPost>(`/community/threads/${id}/posts`, {
      method: 'POST',
      body: { body },
    }),
  togglePostLike: (threadId: string, postId: string) =>
    request<ToggleLikeResult>(
      `/community/threads/${threadId}/posts/${postId}/like`,
      { method: 'POST' },
    ),

  myThemes: () => request<SavedTheme[]>('/themes/mine'),
  communityThemes: (sort: CommunityThemeSort = 'popular', take = 30, skip = 0) =>
    request<SavedTheme[]>(`/themes/community?sort=${sort}&take=${take}&skip=${skip}`),
  createTheme: (input: ThemeInput) =>
    request<SavedTheme>('/themes', { method: 'POST', body: input }),
  updateTheme: (id: string, input: Partial<ThemeInput>) =>
    request<SavedTheme>(`/themes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),
  deleteTheme: (id: string) =>
    request<{ removed: boolean }>(`/themes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  toggleThemeLike: (id: string) =>
    request<ToggleLikeResult>(`/themes/${encodeURIComponent(id)}/like`, {
      method: 'POST',
    }),

  publicProfile: (userId: string) =>
    request<PublicProfile>(`/users/${userId}/profile`),

  xpLeaderboard: (scope: 'global' | 'league' = 'global', limit = 10) =>
    request<LeaderboardResult>(
      `/gamification/leaderboard?scope=${scope}&limit=${limit}`,
    ),

};
