import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register, authenticated } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<'...' | 'online' | 'offline'>('...');
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((h) => setHealth(h.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setHealth('offline'));
  }, []);

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="px-6 pt-10 pb-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight">
              Op<span className="text-emerald-400">ENEM</span>
            </span>
            <span
              className={`ml-auto text-xs rounded-full px-2 py-1 ${
                health === 'online'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : health === 'offline'
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-slate-700/40 text-slate-300'
              }`}
            >
              API: {health}
            </span>
          </div>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Preparação gratuita e personalizada para o ENEM. Simulados fiéis,
            estatísticas que mostram onde você erra e revisão inteligente — no
            seu tempo, no seu celular.
          </p>
        </div>
      </header>

      <main className="flex-1 px-6">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl bg-slate-900/70 ring-1 ring-slate-800 p-6 shadow-xl">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-800/60 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-md py-2 transition ${
                  mode === 'login' ? 'bg-slate-950 text-white' : 'text-slate-400'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-md py-2 transition ${
                  mode === 'register'
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-400'
                }`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs text-slate-400">E-mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 ring-1 ring-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-emerald-500"
                  placeholder="voce@exemplo.com"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Senha</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-950 ring-1 ring-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-emerald-500"
                  placeholder="mínimo 8 caracteres"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading
                  ? 'Enviando…'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </form>

            {message && (
              <p className="mt-4 text-center text-sm text-rose-300">{message}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
