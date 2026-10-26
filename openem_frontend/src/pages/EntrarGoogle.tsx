import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorBanner } from '../components/ErrorBanner';
import { ERROS_GOOGLE, erroGoogle, fragmentParam } from '../lib/conta';

type Estado =
  | { tipo: 'entrando' }
  | { tipo: 'erro'; mensagem: string }
  /** A senha antiga foi desativada: avisa antes de entrar. */
  | { tipo: 'aviso'; token: string };

/**
 * Volta do Google (`/entrar/google#code=...` ou `#erro=...`). O código vale
 * uma vez e por dois minutos: a tela o troca pelo login logo ao abrir.
 */
export default function EntrarGoogle() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [volta] = useState(() => ({
    code: fragmentParam(location.hash, 'code'),
    erro: fragmentParam(location.hash, 'erro'),
  }));
  const [estado, setEstado] = useState<Estado>(() =>
    volta.code
      ? { tipo: 'entrando' }
      : { tipo: 'erro', mensagem: erroGoogle(volta.erro) },
  );
  // O StrictMode roda o efeito duas vezes, e o código só vale uma.
  const trocado = useRef(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
    if (!volta.code || trocado.current) return;
    trocado.current = true;
    api
      .googleExchange(volta.code)
      .then(async (res) => {
        if (res.passwordDisabled) {
          setEstado({ tipo: 'aviso', token: res.accessToken });
          return;
        }
        await signIn(res.accessToken);
        navigate('/', { replace: true });
      })
      .catch((err: unknown) =>
        setEstado({
          tipo: 'erro',
          mensagem: err instanceof Error ? err.message : ERROS_GOOGLE.falha,
        }),
      );
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado.tipo === 'entrando') {
    return (
      <AuthLayout title="Entrando com o Google">
        <p className="mt-3 text-sm text-muted" role="status">
          Um instante…
        </p>
      </AuthLayout>
    );
  }

  if (estado.tipo === 'aviso') {
    return (
      <AuthLayout title="Pronto, você entrou">
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A sua conta agora entra pelo Google. Por segurança, a senha que ela
          tinha foi desativada, porque o e-mail nunca tinha sido confirmado.
          Para voltar a entrar também com senha, use "Esqueci minha senha" na
          tela de entrada.
        </p>
        <button
          type="button"
          className="btn btn-primary mt-5 w-full"
          onClick={async () => {
            await signIn(estado.token);
            navigate('/', { replace: true });
          }}
        >
          Continuar
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Não deu para entrar">
      <div className="mt-4">
        <ErrorBanner message={estado.mensagem} wrap />
      </div>
      <Link to="/" className="btn btn-primary mt-5 w-full">
        Voltar para a entrada
      </Link>
    </AuthLayout>
  );
}
