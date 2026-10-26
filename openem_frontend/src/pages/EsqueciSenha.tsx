import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AuthOptions } from '../api';
import { AuthLayout, AuthNotice } from '../components/AuthLayout';
import { ErrorBanner } from '../components/ErrorBanner';

/**
 * "Esqueci minha senha": manda um link por e-mail. A resposta é a mesma com
 * ou sem conta, então a tela nunca diz se o e-mail está cadastrado.
 */
export default function EsqueciSenha() {
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .authOptions()
      .then(setOptions)
      .catch(() => setOptions(null));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const res = await api.forgotPassword(email.trim());
      setEnviado(res.message);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setEnviando(false);
    }
  }

  const voltar = (
    <Link
      to="/"
      className="mt-5 inline-block text-sm font-semibold text-brand hover:underline"
    >
      Voltar para a entrada
    </Link>
  );

  if (options && !options.passwordReset) {
    return (
      <AuthLayout title="Esqueci minha senha">
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Este servidor não está configurado para mandar e-mail, então a senha
          não pode ser recuperada por aqui. Fale com quem cuida do OpENEM que
          você usa (a escola ou o cursinho).
        </p>
        {voltar}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Esqueci minha senha">
      {enviado ? (
        <div className="mt-4 space-y-3">
          <AuthNotice>{enviado}</AuthNotice>
          <p className="text-sm leading-relaxed text-muted">
            Não chegou? Confira a caixa de spam e se o e-mail está certo. Pedir
            de novo invalida o link anterior.
          </p>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => setEnviado(null)}
          >
            Pedir outro link
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Digite o e-mail da sua conta. Se ele estiver cadastrado, você
            recebe um link para criar uma senha nova, válido por 30 minutos.
          </p>
          <label className="block">
            <span className="eyebrow">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1.5"
              placeholder="voce@exemplo.com"
            />
          </label>
          <button
            type="submit"
            disabled={enviando}
            className="btn btn-primary w-full"
          >
            {enviando ? 'Um instante…' : 'Mandar o link'}
          </button>
          {erro && <ErrorBanner message={erro} wrap />}
        </form>
      )}
      {voltar}
    </AuthLayout>
  );
}
