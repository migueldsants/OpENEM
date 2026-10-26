import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { AuthNotice, GoogleLogo } from './AuthLayout';
import { ErrorBanner } from './ErrorBanner';

/**
 * Cartão "Segurança" do Perfil: trocar a senha e sair de todos os
 * dispositivos. Trocar a senha encerra as sessões dos outros aparelhos; este
 * continua logado com o token novo que a API devolve.
 */
export function SegurancaConta() {
  const { me, signIn, logout } = useAuth();
  // Backend antigo, sem o campo: toda conta tinha senha.
  const temSenha = me?.hasPassword ?? true;

  const [trocando, setTrocando] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [saindo, setSaindo] = useState(false);

  function fecharFormulario() {
    setTrocando(false);
    setAtual('');
    setNova('');
    setConfirma('');
    setErro(null);
  }

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    if (nova !== confirma) {
      setErro('As duas senhas novas não são iguais.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await api.changePassword(atual, nova);
      await signIn(res.accessToken);
      fecharFormulario();
      setOk('Senha trocada. Os outros aparelhos saíram da conta.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível trocar.');
    } finally {
      setSalvando(false);
    }
  }

  async function sairDeTodos() {
    setSaindo(true);
    setErro(null);
    try {
      await api.logoutAll();
      logout();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível sair.');
      setSaindo(false);
    }
  }

  return (
    <section className="card p-4" aria-labelledby="seguranca-titulo">
      <p id="seguranca-titulo" className="eyebrow">
        Segurança
      </p>

      {me?.googleLinked && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          <GoogleLogo size={16} />
          Conta Google vinculada: você pode entrar pelo Google.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {ok && <AuthNotice>{ok}</AuthNotice>}
        {erro && <ErrorBanner message={erro} wrap />}
      </div>

      {temSenha ? (
        trocando ? (
          <form onSubmit={trocar} className="mt-3 space-y-3">
            <label className="block">
              <span className="eyebrow">Senha atual</span>
              <input
                type="password"
                required
                maxLength={72}
                autoComplete="current-password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                className="input mt-1.5"
              />
            </label>
            <label className="block">
              <span className="eyebrow">Senha nova</span>
              <input
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
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
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={salvando}
                className="btn btn-primary"
              >
                {salvando ? 'Salvando…' : 'Salvar senha nova'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={fecharFormulario}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted">
              Trocar a senha tira a sua conta de todos os outros aparelhos.
            </p>
            <button
              type="button"
              className="btn btn-ghost mt-2"
              onClick={() => {
                setOk(null);
                setTrocando(true);
              }}
            >
              Trocar senha
            </button>
          </div>
        )
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A sua conta entra pelo Google e ainda não tem senha. Para entrar
          também com e-mail e senha, saia e use "Esqueci minha senha" na tela de
          entrada.
        </p>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-sm font-medium">Sair de todos os dispositivos</p>
        <p className="mt-0.5 text-xs text-muted">
          Encerra a sessão em todos os aparelhos, inclusive neste. Use se entrou
          num computador emprestado ou acha que outra pessoa usa a sua conta.
        </p>
        {confirmarSaida ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saindo}
              className="btn btn-primary"
              onClick={() => void sairDeTodos()}
            >
              {saindo ? 'Saindo…' : 'Sim, sair de todos'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmarSaida(false)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-ghost mt-2"
            onClick={() => setConfirmarSaida(true)}
          >
            Sair de todos os dispositivos
          </button>
        )}
      </div>
    </section>
  );
}
