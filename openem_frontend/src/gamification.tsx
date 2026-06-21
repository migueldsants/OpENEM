import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, type GamificationSummary } from './api';
import { useAuth } from './auth';

interface GamificationState {
  summary: GamificationSummary | null;
  refresh: () => Promise<void>;
}

const GamificationContext = createContext<GamificationState | null>(null);

/** Busca o resumo de gamificação uma vez e o compartilha (shell, Home, Progresso). */
export function GamificationProvider({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();
  const [summary, setSummary] = useState<GamificationSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await api.gamification());
    } catch {
      /* silencioso: a tela ainda funciona sem o resumo */
    }
  }, []);

  useEffect(() => {
    if (authenticated) void refresh();
    else setSummary(null);
  }, [authenticated, refresh]);

  return (
    <GamificationContext.Provider value={{ summary, refresh }}>
      {children}
    </GamificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGamification(): GamificationState {
  const ctx = useContext(GamificationContext);
  if (!ctx)
    throw new Error('useGamification deve ser usado dentro de <GamificationProvider>');
  return ctx;
}
