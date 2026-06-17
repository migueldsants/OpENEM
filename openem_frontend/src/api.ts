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
    throw new Error(
      (Array.isArray(data.message) ? data.message.join(', ') : data.message) ??
        `Erro ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
export interface Question {
  id: string;
  statement: string;
  difficulty: number;
  topic: TopicRef;
}
export interface Favorite {
  id: string;
  createdAt: string;
  question: Question;
}
export interface StudySession {
  id: string;
  dayIndex: number;
  minutes: number;
  done: boolean;
  topic: TopicRef;
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
export interface EssayEvaluation {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  total: number;
  feedback: string | null;
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
export interface Profile {
  goal: string;
  minutesPerDay: number;
  displayName: string | null;
  focusMode: boolean;
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
    patch: Partial<Pick<Profile, 'focusMode' | 'minutesPerDay'>>,
  ) => request<Me>('/users/me/profile', { method: 'PUT', body: patch }),

  questions: (limit = 20) =>
    request<{ items: Question[] }>(`/questions?limit=${limit}`),

  favorites: () => request<Favorite[]>('/favorites'),
  addFavorite: (questionId: string) =>
    request('/favorites', { method: 'POST', body: { questionId } }),
  removeFavorite: (questionId: string) =>
    request(`/favorites/${questionId}`, { method: 'DELETE' }),

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
    request<{ id: string }>('/essays/submissions', {
      method: 'POST',
      body: { promptId, content },
    }),
  essaySubmissions: () =>
    request<EssaySubmissionSummary[]>('/essays/submissions'),
};
