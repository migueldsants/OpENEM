import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type AnswerResult,
  type Question,
  type Subject,
} from '../api';
import { IconCheck, IconStar, IconX } from '../components/icons';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

function QuestionCard({
  question,
  favorited,
  onToggleFavorite,
}: {
  question: Question;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = areaKey(question.topic.subject.name);
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  async function send() {
    if (!chosen) return;
    setSending(true);
    setError(null);
    try {
      setResult(await api.answer(question.id, chosen));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="card card-raised overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold ${AREA_TEXT[area]}`}>
              {question.topic.subject.name}
            </span>
            <span className="text-muted">· {question.topic.name}</span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{question.statement}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="chip">nível {question.difficulty}</span>
          <button
            onClick={onToggleFavorite}
            aria-pressed={favorited}
            aria-label={favorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            className={`grid size-9 place-items-center rounded-lg border transition-colors ${
              favorited
                ? 'border-transparent bg-hum/15 text-hum'
                : 'border-line text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <IconStar width={18} height={18} filled={favorited} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 px-4 pb-4">
        {question.alternatives.map((alt, i) => {
          const isChosen = chosen === alt.id;
          const isCorrect = result?.correctAlternativeId === alt.id;
          const isWrongPick = !!result && isChosen && !result.isCorrect;
          const state = result
            ? isCorrect
              ? 'border-nat bg-nat/10'
              : isWrongPick
                ? 'border-red bg-red/10'
                : 'border-line opacity-60'
            : isChosen
              ? 'border-brand bg-brand/8'
              : 'border-line hover:bg-surface-2';
          return (
            <button
              key={alt.id}
              type="button"
              disabled={!!result}
              onClick={() => setChosen(alt.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${state}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                  isChosen && !result
                    ? 'bg-brand text-brand-ink'
                    : 'bg-surface-2 text-muted'
                }`}
              >
                {letters[i]}
              </span>
              <span className="min-w-0 flex-1">{alt.text}</span>
              {result && isCorrect && (
                <IconCheck width={16} height={16} className="shrink-0 text-nat" />
              )}
              {isWrongPick && (
                <IconX width={16} height={16} className="shrink-0 text-red" />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="px-4 pb-3 text-sm text-red">{error}</p>
      )}

      {!result ? (
        <div className="border-t border-line px-4 py-3">
          <button
            onClick={send}
            disabled={!chosen || sending}
            className="btn btn-primary"
          >
            {sending ? 'Conferindo…' : 'Responder'}
          </button>
        </div>
      ) : (
        <div
          className={`border-t px-4 py-3 ${
            result.isCorrect ? 'border-nat/30 bg-nat/5' : 'border-red/30 bg-red/5'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              result.isCorrect ? 'text-nat' : 'text-red'
            }`}
          >
            {result.isCorrect ? 'Você acertou!' : 'Não foi dessa vez.'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {result.explanation}
          </p>
        </div>
      )}
    </li>
  );
}

const DIFFICULTIES = [1, 2, 3, 4, 5];

export default function Questoes() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favoriteQuestions, setFavoriteQuestions] = useState<Question[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catálogo de áreas e favoritos (uma vez).
  useEffect(() => {
    void (async () => {
      try {
        const [subs, favs] = await Promise.all([
          api.subjects(),
          api.favorites(),
        ]);
        setSubjects(subs);
        setFavoritedIds(new Set(favs.map((f) => f.question.id)));
        setFavoriteQuestions(favs.map((f) => f.question));
      } catch {
        /* silencioso: a busca de questões reporta erro se necessário */
      }
    })();
  }, []);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.questions({
          subjectId: subjectId || undefined,
          difficulty: difficulty || undefined,
          page: nextPage,
          limit: 10,
        });
        setPages(res.meta.pages);
        setPage(res.meta.page);
        setQuestions((cur) => (replace ? res.items : [...cur, ...res.items]));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Não foi possível buscar questões.',
        );
      } finally {
        setLoading(false);
      }
    },
    [subjectId, difficulty],
  );

  // Recarrega a 1ª página quando os filtros mudam (no modo banco).
  useEffect(() => {
    if (!onlyFavorites) void fetchPage(1, true);
  }, [fetchPage, onlyFavorites]);

  async function toggleFavorite(q: Question) {
    const isFav = favoritedIds.has(q.id);
    try {
      if (isFav) await api.removeFavorite(q.id);
      else await api.addFavorite(q.id);
      setFavoritedIds((cur) => {
        const next = new Set(cur);
        if (isFav) next.delete(q.id);
        else next.add(q.id);
        return next;
      });
      setFavoriteQuestions((cur) =>
        isFav ? cur.filter((x) => x.id !== q.id) : [...cur, q],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  const list = onlyFavorites
    ? favoriteQuestions.filter(
        (q) =>
          (!subjectId || q.topic.subject.id === subjectId) &&
          (!difficulty || q.difficulty === difficulty),
      )
    : questions;

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Banco de questões</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Questões comentadas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Responda e veja na hora se acertou, com o comentário.
        </p>
      </header>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubjectId('')}
            className={`chip ${!subjectId ? 'ring-1 ring-brand' : ''}`}
          >
            Todas as áreas
          </button>
          {subjects.map((s) => {
            const area = areaKey(s.name);
            const active = subjectId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSubjectId(active ? '' : s.id)}
                className={`chip ${active ? 'ring-1 ring-brand' : ''}`}
              >
                <span className={`size-2.5 rounded-full ${AREA_DOT[area]}`} />
                {s.name.replace(' e suas Tecnologias', '')}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="seg">
            <button
              data-active={difficulty === 0}
              onClick={() => setDifficulty(0)}
            >
              Todos
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                data-active={difficulty === d}
                onClick={() => setDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-muted">Só favoritas</span>
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {list.length === 0 && !loading ? (
        <p className="card p-6 text-center text-sm text-muted">
          {onlyFavorites
            ? 'Você ainda não favoritou questões com esses filtros.'
            : 'Nenhuma questão encontrada. Tente outro filtro.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              favorited={favoritedIds.has(q.id)}
              onToggleFavorite={() => toggleFavorite(q)}
            />
          ))}
        </ul>
      )}

      {!onlyFavorites && page < pages && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchPage(page + 1, false)}
            disabled={loading}
            className="btn btn-ghost"
          >
            {loading ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  );
}
