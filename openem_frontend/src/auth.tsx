import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken, type Me } from './api';

interface AuthState {
  token: string | null;
  me: Me | null;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [me, setMe] = useState<Me | null>(null);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    try {
      setMe(await api.me());
    } catch {
      // Token inválido/expirado: encerra a sessão.
      setToken(null);
      setTokenState(null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const persist = useCallback((accessToken: string) => {
    setToken(accessToken);
    setTokenState(accessToken);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      persist(res.accessToken);
      await refreshMe();
    },
    [persist, refreshMe],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      persist(res.accessToken);
      await refreshMe();
    },
    [persist, refreshMe],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        me,
        authenticated: !!token,
        login,
        register,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
