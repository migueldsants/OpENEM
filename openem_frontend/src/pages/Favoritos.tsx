import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type AnswerResult,
  type Favorite,
  type Question,
} from '../api';
import { IconCheck, IconStar, IconX } from '../components/icons';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function FavoriteCard({
  question,
  onRemove,
}: {
  question: Question;
  onRemove: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [sending, setSending] = useState(false);
  const area = areaKey(question.topic.subject.name);

  async function send() {
    if (!chosen) return;
    setSending(true);
    try {
      setResult(await api.answer(question.id, chosen));
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
        <button
          onClick={onRemove}
          aria-label="Remover dos favoritos"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-transparent bg-hum/15 text-hum transition-colors hover:bg-hum/25"
        >
          <IconStar width={18} height={18} filled />
        </button>
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
                {LETTERS[i]}
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

      {!result ? (
        <div className="border-t border-line px-4 py-3">
          <button
            onClick={() => void send()}
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

export default function Favoritos() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setFavorites(await api.favorites());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os favoritos.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function remove(questionId: string) {
    const prev = favorites;
    setFavorites((f) => f.filter((x) => x.question.id !== questionId));
    try {
      await api.removeFavorite(questionId);
    } catch {
      setFavorites(prev); // desfaz em caso de erro
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Favoritas</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Questões salvas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Suas questões marcadas para revisitar quando quiser.
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <p className="card p-6 text-center text-sm text-muted">Carregando…</p>
      ) : favorites.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Você ainda não favoritou questões. Toque na{' '}
          <IconStar
            width={14}
            height={14}
            className="inline align-text-bottom text-hum"
          />{' '}
          ao responder em{' '}
          <NavLink to="/questoes" className="font-medium text-brand">
            Questões
          </NavLink>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <FavoriteCard
              key={f.id}
              question={f.question}
              onRemove={() => void remove(f.question.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
