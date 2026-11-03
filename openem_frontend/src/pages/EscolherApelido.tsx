import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { CampoApelido } from '../components/CampoApelido';
import { ErrorBanner } from '../components/ErrorBanner';
import { erroDeFormato, normalizarApelido } from '../lib/apelido';

/**
 * Antes do app, para quem ainda não tem apelido: contas criadas antes dele
 * ser obrigatório e contas novas pelo Google, que chegam sem formulário de
 * cadastro. Sem apelido, o aluno apareceria como "Estudante" no fórum e no
 * ranking.
 */
export default function EscolherApelido() {
  const { refreshMe, logout } = useAuth();
  const [apelido, setApelido] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const nickname = normalizarApelido(apelido);
    const erro = erroDeFormato(nickname);
    if (erro) {
      setError(erro);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ nickname });
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-7">
        <p className="eyebrow">Antes de continuar</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Escolha seu apelido
        </h1>
        <p className="mt-2 text-sm text-muted">
          É como os outros alunos veem você no fórum, no ranking e nos temas
          publicados. Seu e-mail continua privado.
        </p>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <form onSubmit={salvar} className="space-y-4">
        <CampoApelido
          value={apelido}
          onChange={setApelido}
          disabled={saving}
          autoFocus
        />
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary w-full"
        >
          {saving ? 'Salvando…' : 'Continuar'}
        </button>
      </form>
      <button
        type="button"
        onClick={logout}
        className="btn btn-ghost mt-3 w-full"
      >
        Sair
      </button>
    </div>
  );
}
