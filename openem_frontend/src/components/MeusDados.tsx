import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  arquivoDeDados,
  limparDadosDoAparelho,
  nomeDoArquivoDeDados,
} from '../lib/conta';
import { baixarArquivo } from '../lib/download';
import { PRIVACIDADE_URL, TERMOS_URL } from '../lib/site';
import { ErrorBanner } from './ErrorBanner';
import { Portal, useDialog } from './Modal';

const BOTAO_PERIGO =
  'btn border-danger/40 text-danger hover:bg-danger/10 disabled:hover:bg-transparent';

/** Confirmação da exclusão: a senha atual é o que autoriza. */
function ExcluirConta({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const painelRef = useRef<HTMLDivElement>(null);
  const [senha, setSenha] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useDialog(painelRef, () => {
    if (!excluindo) onClose();
  });

  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    if (!senha || excluindo) return;
    setExcluindo(true);
    setErro(null);
    try {
      await api.deleteAccount(senha);
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Não foi possível excluir a conta.',
      );
      setExcluindo(false);
      return;
    }
    await limparDadosDoAparelho();
    logout();
    navigate('/login', { replace: true, state: { contaExcluida: true } });
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
        onClick={() => !excluindo && onClose()}
      >
        <div
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="excluir-conta-titulo"
          tabIndex={-1}
          className="card card-raised w-full max-w-md p-5 outline-none animate-rise"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="excluir-conta-titulo"
            className="font-display text-lg font-extrabold tracking-tight"
          >
            Excluir a conta
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Apaga para sempre o seu perfil, respostas, simulados, revisões,
            flashcards, cronograma, metas, vídeos, temas e XP, e também os
            tópicos e respostas que você escreveu no fórum (um tópico seu sai
            com as respostas dos outros). Não dá para desfazer: se quiser uma
            cópia, baixe seus dados antes.
          </p>
          <form onSubmit={excluir} className="mt-4 space-y-4">
            <label className="block">
              <span className="eyebrow">Sua senha</span>
              <input
                type="password"
                autoFocus
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={excluindo}
                className="input mt-1.5"
              />
            </label>
            <ErrorBanner message={erro} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={excluindo}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!senha || excluindo}
                className={BOTAO_PERIGO}
              >
                {excluindo ? 'Excluindo…' : 'Excluir para sempre'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

/** Cartão do Perfil com os direitos do titular (LGPD, art. 18). */
export function MeusDados() {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  async function baixar() {
    setBaixando(true);
    setErro(null);
    try {
      const dados = await api.exportMyData();
      baixarArquivo(arquivoDeDados(dados), nomeDoArquivoDeDados());
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : 'Não foi possível baixar os dados.',
      );
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="card p-4">
      <p className="eyebrow">Privacidade e dados</p>
      <p className="mt-1 text-sm text-muted">
        Baixe uma cópia de tudo o que o OpENEM guarda sobre você, ou exclua a
        conta. O que é coletado e para quê está na{' '}
        <a href={PRIVACIDADE_URL} className="font-semibold text-brand hover:underline">
          Política de Privacidade
        </a>
        ; as regras de uso, nos{' '}
        <a href={TERMOS_URL} className="font-semibold text-brand hover:underline">
          Termos de Uso
        </a>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void baixar()}
          disabled={baixando}
          className="btn btn-ghost"
        >
          {baixando ? 'Preparando…' : 'Baixar meus dados'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className={BOTAO_PERIGO}
        >
          Excluir conta
        </button>
      </div>
      {erro && (
        <div className="mt-3">
          <ErrorBanner message={erro} />
        </div>
      )}
      {confirmar && <ExcluirConta onClose={() => setConfirmar(false)} />}
    </div>
  );
}
