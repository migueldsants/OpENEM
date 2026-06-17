// Cliente de API mínimo. Em dev, o Vite faz proxy de /api e /health para o backend.
const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch('/health').then((r) => r.json() as Promise<{ status: string; database: string }>),
  register: (email: string, password: string) =>
    postJson<AuthResponse>('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    postJson<AuthResponse>('/auth/login', { email, password }),
};
