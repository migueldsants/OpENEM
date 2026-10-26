import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorBanner } from '../components/ErrorBanner';
import { fragmentParam } from '../lib/conta';

/**
 * Tela do link do e-mail. O token vem no fragmento (`#token=`), que o
 * navegador não manda a servidor nenhum; a tela o tira da barra de endereço
 * assim que lê.
 */
export default function RedefinirSenha() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => fragmentParam(location.hash, 'token'));
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
    // Só na abertura: depois o fragmento já saiu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (senha !== confirma) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await api.resetPassword(token, senha);
      await signIn(res.accessToken);
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado.');
      setSalvando(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Criar senha nova">
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Este link está incompleto. Abra de novo o link do e-mail ou peça
          outro.
        </p>
        <Link to="/esqueci-senha" className="btn btn-primary mt-5 w-full">
          Pedir outro link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar senha nova">
      <form onSubmit={salvar} className="mt-4 space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Ao salvar, você entra com a senha nova e sai da conta em todos os
          outros aparelhos.
        </p>
        <label className="block">
          <span className="eyebrow">Senha nova</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="input mt-1.5"
            placeholder="mínimo 8 caracteres"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Repita a senha nova</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            className="input mt-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={salvando}
          className="btn btn-primary w-full"
        >
          {salvando ? 'Um instante…' : 'Salvar e entrar'}
        </button>
        {erro && <ErrorBanner message={erro} wrap />}
      </form>
      {erro && (
        <Link
          to="/esqueci-senha"
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          Pedir outro link
        </Link>
      )}
    </AuthLayout>
  );
}
