import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type AnswerResult,
  type Favorite,
  type Question,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { QuestionExplanation } from '../components/QuestionExplanation';
import { ErrorBanner } from '../components/ErrorBanner';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconCheck, IconStar, IconX } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';
import { areaSourceName, subjectLabel, topicLabel } from '../lib/question';
import { PageHeader } from '../components/PageHeader';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function FavoriteCard({
  question,
  onRemove,
  onAwarded,
}: {
  question: Question;
  onRemove: () => void;
  onAwarded: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [sending, setSending] = useState(false);
  const area = areaKey(areaSourceName(question));

  async function send() {
    if (!chosen) return;
    setSending(true);
    try {
      const res = await api.answer(question.id, chosen);
      setResult(res);
      if (res.gamification) onAwarded();
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
              {subjectLabel(question)}
            </span>
            {topicLabel(question) && (
              <span className="text-muted">· {topicLabel(question)}</span>
            )}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{question.statement}</p>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remover dos favoritos"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-transparent bg-warning/15 text-warning transition-colors hover:bg-warning/25"
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
              ? 'border-success bg-success/10'
              : isWrongPick
                ? 'border-danger bg-danger/10'
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
                className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                  isChosen && !result
                    ? 'bg-brand text-brand-ink'
                    : 'bg-surface-2 text-muted'
                }`}
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{alt.text}</span>
              {result && isCorrect && (
                <IconCheck width={16} height={16} className="shrink-0 text-success" />
              )}
              {isWrongPick && (
                <IconX width={16} height={16} className="shrink-0 text-danger" />
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
            result.isCorrect ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              result.isCorrect ? 'text-success' : 'text-danger'
            }`}
          >
            {result.isCorrect ? 'Você acertou!' : 'Não foi dessa vez.'}
          </p>
          <QuestionExplanation
            questionId={question.id}
            explanation={result.explanation}
            source={result.explanationSource}
            offline={result.offlineQueued}
          />
          {result.gamification && <GamificationFeedback g={result.gamification} />}
        </div>
      )}
    </li>
  );
}

export default function Favoritos() {
  const { refresh } = useGamification();
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Questões salvas"
        title="Favoritos"
        subtitle="Suas questões marcadas para revisitar quando quiser."
      />

      {error && (
        <ErrorBanner message={error} />
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={IconStar}
          title="Nenhuma favorita ainda"
          description={
            <>
              Toque na{' '}
              <IconStar
                width={14}
                height={14}
                className="inline align-text-bottom text-warning"
              />{' '}
              ao responder em{' '}
              <NavLink to="/questoes" className="font-medium text-brand">
                Questões
              </NavLink>
              .
            </>
          }
          tip="Favoritas ficam salvas para revisar quando quiser"
        />
      ) : (
        <ul className="space-y-3">
          {favorites.map((f) => (
            <FavoriteCard
              key={f.id}
              question={f.question}
              onRemove={() => void remove(f.question.id)}
              onAwarded={() => void refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
