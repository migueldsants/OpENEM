import { useCallback, useEffect, useState } from 'react';
import { api, type Favorite, type Question } from '../api';

export default function Favoritos() {
  const [tab, setTab] = useState<'banco' | 'meus'>('banco');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, f] = await Promise.all([api.questions(20), api.favorites()]);
      setQuestions(q.items);
      setFavorites(f);
      setFavoritedIds(new Set(f.map((fav) => fav.question.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(questionId: string) {
    try {
      if (favoritedIds.has(questionId)) {
        await api.removeFavorite(questionId);
      } else {
        await api.addFavorite(questionId);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  const list =
    tab === 'banco' ? questions : favorites.map((f) => f.question);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Questões favoritas</h1>

      <div className="inline-flex gap-1 rounded-lg bg-slate-800/60 p-1 text-sm">
        <button
          onClick={() => setTab('banco')}
          className={`rounded-md px-3 py-1.5 ${tab === 'banco' ? 'bg-slate-950 text-white' : 'text-slate-400'}`}
        >
          Banco de questões
        </button>
        <button
          onClick={() => setTab('meus')}
          className={`rounded-md px-3 py-1.5 ${tab === 'meus' ? 'bg-slate-950 text-white' : 'text-slate-400'}`}
        >
          Meus favoritos ({favorites.length})
        </button>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          {tab === 'meus'
            ? 'Você ainda não favoritou questões.'
            : 'Nenhuma questão disponível.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((q) => {
            const fav = favoritedIds.has(q.id);
            return (
              <li
                key={q.id}
                className="rounded-xl bg-slate-900/70 ring-1 ring-slate-800 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-emerald-400">
                      {q.topic.subject.name} · {q.topic.name} · nível{' '}
                      {q.difficulty}
                    </p>
                    <p className="mt-1 text-sm">{q.statement}</p>
                  </div>
                  <button
                    onClick={() => toggle(q.id)}
                    title={fav ? 'Remover dos favoritos' : 'Favoritar'}
                    className={`ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                      fav
                        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {fav ? '★ Salva' : '☆ Salvar'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
