import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type AnswerResult,
  type GamificationDelta,
  type Question,
  type QuestionNoteRef,
  type ReviewItem,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { GamificationFeedback } from '../components/GamificationFeedback';
import {
  IconCheck,
  IconClock,
  IconNote,
  IconStack,
  IconX,
} from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Mapeia a autoavaliação para a qualidade SM-2 (0..5).
const GRADES: { label: string; quality: number; cls: string }[] = [
  { label: 'Esqueci', quality: 1, cls: 'text-red' },
  { label: 'Difícil', quality: 3, cls: 'text-hum' },
  { label: 'Bom', quality: 4, cls: 'text-brand' },
  { label: 'Fácil', quality: 5, cls: 'text-nat' },
];

function overdueLabel(dueAt: string): string {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'vence hoje';
  if (days === 1) return 'atrasado 1 dia';
  return `atrasado ${days} dias`;
}

/** Card de prática de uma questão durante a revisão. */
function PracticeCard({
  question,
  note,
  onAwarded,
}: {
  question: Question;
  note: QuestionNoteRef | null;
  onAwarded: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [sending, setSending] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

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
    <div className="card card-raised overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-relaxed">
            {question.statement}
          </p>
          {note && (
            <button
              onClick={() => setNoteOpen((o) => !o)}
              aria-label={noteOpen ? 'Ocultar anotação' : 'Ver anotação'}
              title={noteOpen ? 'Ocultar anotação' : 'Ver anotação'}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-hum/30 bg-hum/10 text-hum transition-colors hover:bg-hum/20"
            >
              <IconNote width={16} height={16} filled />
            </button>
          )}
        </div>
        {note && noteOpen && (
          <div className="mt-3 rounded-lg border border-hum/20 bg-hum/5 px-3 py-2.5 text-sm text-fg">
            <p className="eyebrow mb-1">Sua anotação</p>
            <p className="whitespace-pre-wrap leading-relaxed">{note.content}</p>
          </div>
        )}
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
          {result.gamification && <GamificationFeedback g={result.gamification} />}
        </div>
      )}
    </div>
  );
}

/** Sessão de revisão de um assunto: pratica questões e autoavalia a lembrança. */
function ReviewSession({
  item,
  onDone,
  onCancel,
}: {
  item: ReviewItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { refresh } = useGamification();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, QuestionNoteRef>>({});
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeDelta, setGradeDelta] = useState<GamificationDelta | null>(null);
  const area = areaKey(item.topic.subject.name);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.questions({ topicId: item.topic.id, limit: 5 });
        setQuestions(res.items);
        // Busca anotações pessoais das questões carregadas (issue #39).
        if (res.items.length > 0) {
          const notes = await api.questionNotesForQuestions(
            res.items.map((q) => q.id),
          );
          setNotesMap(
            Object.fromEntries(notes.map((n) => [n.questionId, n])),
          );
        }
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [item.topic.id]);

  async function grade(quality: number) {
    setGrading(true);
    setError(null);
    try {
      const res = await api.gradeReview(item.id, quality);
      const delta = (res as { gamification?: GamificationDelta }).gamification;
      if (delta) {
        setGradeDelta(delta);
        void refresh();
      }
      // Pequeno atraso para o usuário ver o XP antes de fechar a sessão.
      setTimeout(() => onDone(), delta ? 1400 : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setGrading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="btn btn-ghost shrink-0">
          Voltar
        </button>
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${AREA_TEXT[area]}`}>
            {item.topic.subject.name}
          </p>
          <h1 className="truncate font-display text-xl font-extrabold tracking-tight">
            {item.topic.name}
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={IconStack}
          title="Sem questões neste assunto"
          description="Avalie sua lembrança abaixo mesmo assim."
          bare
          dense
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <PracticeCard
              key={q.id}
              question={q}
              note={notesMap[q.id] ?? null}
              onAwarded={() => void refresh()}
            />
          ))}
        </div>
      )}

      {/* Autoavaliação → reagenda por SM-2. */}
      <section className="card p-5">
        <h2 className="font-display text-base font-bold">Como foi sua lembrança?</h2>
        <p className="mt-0.5 text-xs text-muted">
          Sua resposta define quando este assunto volta para revisão.
        </p>
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <button
              key={g.quality}
              onClick={() => void grade(g.quality)}
              disabled={grading}
              className={`rounded-lg border border-line py-2.5 text-sm font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50 ${g.cls}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {gradeDelta && <GamificationFeedback g={gradeDelta} />}
      </section>
    </div>
  );
}

export default function Revisao() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ReviewItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQueue(await api.reviewQueue());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a revisão.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function finishItem(id: string) {
    setQueue((q) => q.filter((x) => x.id !== id));
    setActive(null);
  }

  if (active) {
    return (
      <ReviewSession
        item={active}
        onDone={() => finishItem(active.id)}
        onCancel={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Revisão inteligente</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          O que revisar hoje
        </h1>
        <p className="mt-1 text-sm text-muted">
          Assuntos priorizados pela repetição espaçada — os mais atrasados primeiro.
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={IconClock}
          title="Tudo em dia! 🎉"
          description={
            <>
              Nenhum assunto vencido agora.{' '}
              <NavLink to="/questoes" className="font-medium text-brand">
                Praticar questões
              </NavLink>{' '}
              mantém sua revisão em dia.
            </>
          }
          tip="Revisão espaçada mantém a memória fresca"
        />
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => {
            const area = areaKey(item.topic.subject.name);
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActive(item)}
                  className="card card-raised flex w-full items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5"
                >
                  <span
                    className={`h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`text-xs font-semibold ${AREA_TEXT[area]}`}>
                      {item.topic.subject.name.replace(
                        ' e suas Tecnologias',
                        '',
                      )}
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {item.topic.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      <IconClock width={13} height={13} />
                      {overdueLabel(item.dueAt)}
                    </span>
                  </span>
                  <span className="btn btn-primary shrink-0">Revisar</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
