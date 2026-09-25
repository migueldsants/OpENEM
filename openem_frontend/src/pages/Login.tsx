import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import ThemeToggle from '../components/ThemeToggle';
import { AREAS, AREA_DOT } from '../lib/areas';

type Mode = 'login' | 'register';

/** Motivo do cartão-resposta do ENEM: uma linha de alternativas A–E. */
function AnswerRow({ correct }: { correct: number }) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  return (
    <div className="flex items-center gap-2">
      {letters.map((l, i) => (
        <span
          key={l}
          className={`grid size-7 place-items-center rounded-full border text-xs font-semibold ${
            i === correct
              ? 'border-transparent bg-brand text-brand-ink'
              : 'border-line text-muted'
          }`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

export default function Login() {
  const { login, register, authenticated } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState<'…' | 'online' | 'offline'>('…');
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
      setMessage(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:gap-16">
        {/* Hero */}
        <section className="animate-rise">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Op
              <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
                ENEM
              </span>
            </span>
            {/* Só avisa quando algo está errado: "API online" não diz nada ao aluno. */}
            {health === 'offline' && (
              <span className="chip ml-1 text-danger" role="status">
                <span className="size-2 rounded-full bg-danger" />
                Servidor fora do ar
              </span>
            )}
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <h1 className="mt-8 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            A preparação que{' '}
            <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
              cabe no seu tempo
            </span>
            .
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Simulados fiéis ao ENEM, redação com nota por competência e um
            cronograma que prioriza onde você mais erra. Gratuito, de verdade.
          </p>

          <div className="mt-8 card card-raised inline-flex flex-col gap-3 p-4">
            <p className="eyebrow">Questão 42 · Matemática</p>
            <AnswerRow correct={2} />
          </div>

          <ul className="mt-8 flex flex-wrap gap-2">
            {AREAS.map(({ key, label }) => (
              <li key={key} className="chip">
                <span className={`size-2.5 rounded-full ${AREA_DOT[key]}`} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* Card de autenticação */}
        <section className="animate-rise">
          <div className="card card-raised mx-auto max-w-sm p-6">
            <div className="seg w-full">
              <button
                type="button"
                data-active={mode === 'login'}
                onClick={() => setMode('login')}
                className="flex-1"
              >
                Entrar
              </button>
              <button
                type="button"
                data-active={mode === 'register'}
                onClick={() => setMode('register')}
                className="flex-1"
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="eyebrow">E-mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input mt-1.5"
                  placeholder="voce@exemplo.com"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Senha</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input mt-1.5"
                  placeholder="mínimo 8 caracteres"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading
                  ? 'Um instante…'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </form>

            {message && (
              <div className="mt-4">
                <ErrorBanner message={message} />
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            100% gratuito e open-source · AGPL-3.0
          </p>
        </section>
      </div>
    </div>
  );
}
