import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  getToken,
  HttpError,
  setToken,
  setUnauthorizedHandler,
  type Me,
} from './api';

interface AuthState {
  token: string | null;
  me: Me | null;
  authenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /** Entra com um token já emitido (senha redefinida, Google, troca de senha). */
  signIn: (accessToken: string) => Promise<void>;
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
    } catch (e) {
      // Só encerra a sessão se o token foi rejeitado (401). Falhas de rede ou
      // 5xx (público mobile, internet instável) mantêm a sessão.
      if (e instanceof HttpError && e.status === 401) {
        setToken(null);
        setTokenState(null);
        setMe(null);
      }
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  // Um 401 em qualquer chamada autenticada encerra a sessão (estado React).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null);
      setMe(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

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

  const signIn = useCallback(
    async (accessToken: string) => {
      persist(accessToken);
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
        signIn,
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
