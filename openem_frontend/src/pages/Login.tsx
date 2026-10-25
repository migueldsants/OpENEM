import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, HttpError } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import ThemeToggle from '../components/ThemeToggle';
import { AREAS, AREA_DOT } from '../lib/areas';
import { countdown } from '../lib/rate-limit';
import { PRIVACIDADE_URL, TERMOS_URL } from '../lib/site';

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
  // Vindo da exclusão da conta (Perfil): confirma que deu certo.
  const contaExcluida =
    (useLocation().state as { contaExcluida?: boolean } | null)?.contaExcluida ===
    true;
  const [health, setHealth] = useState<'…' | 'online' | 'offline'>('…');
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Aceite dos Termos e da Política: sem ele o backend não cria a conta.
  const [aceite, setAceite] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 429 (muitas tentativas): até quando o botão fica parado, com a contagem.
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const restante =
    blockedUntil === null ? 0 : Math.ceil((blockedUntil - now) / 1000);
  const bloqueado = restante > 0;

  useEffect(() => {
    if (blockedUntil === null) return;
    const id = window.setInterval(() => {
      const agora = Date.now();
      setNow(agora);
      if (agora >= blockedUntil) {
        setBlockedUntil(null);
        setMessage(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [blockedUntil]);

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
    if (mode === 'register' && !aceite) {
      setMessage(
        'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.',
      );
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, aceite);
      navigate('/', { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Algo deu errado.');
      if (err instanceof HttpError && err.status === 429) {
        const agora = Date.now();
        setNow(agora);
        setBlockedUntil(agora + (err.retryAfterSec ?? 30) * 1000);
      }
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
            Simulados fiéis ao ENEM, as questões oficiais das provas e um
            cronograma que você monta do seu jeito. Gratuito, de verdade.
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
              {mode === 'register' && (
                <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
                  <input
                    type="checkbox"
                    required
                    checked={aceite}
                    onChange={(e) => setAceite(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span>
                    Li e aceito os{' '}
                    <a
                      href={TERMOS_URL}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-brand hover:underline"
                    >
                      Termos de Uso
                    </a>{' '}
                    e a{' '}
                    <a
                      href={PRIVACIDADE_URL}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold text-brand hover:underline"
                    >
                      Política de Privacidade
                    </a>
                    . Se tenho menos de 18 anos, uso o OpENEM com a ciência do
                    meu responsável.
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={loading || bloqueado}
                className="btn btn-primary w-full"
              >
                {bloqueado
                  ? `Aguarde ${countdown(restante)}`
                  : loading
                    ? 'Um instante…'
                    : mode === 'login'
                      ? 'Entrar'
                      : 'Criar conta'}
              </button>
            </form>

            {contaExcluida && !message && (
              <p
                role="status"
                className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"
              >
                Sua conta e os seus dados foram excluídos.
              </p>
            )}

            {message && (
              <div className="mt-4">
                {/* A mensagem fica parada: num role="alert", a contagem
                    seria lida de novo a cada segundo. Ela vai no botão. */}
                <ErrorBanner message={message} />
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            100% gratuito e open-source · AGPL-3.0
          </p>
          <p className="mt-1.5 text-center text-xs text-muted">
            <a href={PRIVACIDADE_URL} className="hover:text-fg hover:underline">
              Privacidade
            </a>
            {' · '}
            <a href={TERMOS_URL} className="hover:text-fg hover:underline">
              Termos de uso
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
