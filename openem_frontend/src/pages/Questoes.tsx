import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type AnswerResult,
  type GamificationDelta,
  type Question,
  type Subject,
} from '../api';
import {
  IconBolt,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconFlame,
  IconStar,
  IconTrophy,
  IconX,
} from '../components/icons';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

const DIFFICULTIES = [1, 2, 3, 4, 5];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface AnswerState {
  chosen: string | null;
  result: AnswerResult | null;
}

function GamificationFeedback({ g }: { g: GamificationDelta }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 animate-rise">
      <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
        <IconBolt width={13} height={13} filled />+{g.xpGained} XP
      </span>
      {g.breakdown.comboMultiplier > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red/12 px-2.5 py-1 text-xs font-semibold text-red">
          <IconFlame width={13} height={13} filled />
          combo ×{g.breakdown.comboMultiplier}
        </span>
      )}
      {g.breakdown.dailyBonus > 0 && (
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
          +{g.breakdown.dailyBonus} bônus diário
        </span>
      )}
      {g.leveledUp && (
        <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
          Subiu para o nível {g.level}!
        </span>
      )}
      {g.leagueChanged && (
        <span className="rounded-full bg-mat/15 px-2.5 py-1 text-xs font-bold text-mat">
          Nova liga: {g.league.name}!
        </span>
      )}
      {g.newAchievements.map((a) => (
        <span
          key={a.code}
          title={a.description}
          className="inline-flex items-center gap-1 rounded-full bg-hum/15 px-2.5 py-1 text-xs font-semibold text-hum"
        >
          <IconTrophy width={13} height={13} filled />
          {a.name}
        </span>
      ))}
    </div>
  );
}

/** Card da questão atual — controlado: o estado de resposta vive no pai. */
function QuestionView({
  question,
  state,
  favorited,
  onChoose,
  onToggleFavorite,
}: {
  question: Question;
  state: AnswerState;
  favorited: boolean;
  onChoose: (alternativeId: string) => void;
  onToggleFavorite: () => void;
}) {
  const area = areaKey(question.topic.subject.name);
  const { chosen, result } = state;

  return (
    <div className="card card-raised overflow-hidden animate-rise">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold ${AREA_TEXT[area]}`}>
              {question.topic.subject.name.replace(' e suas Tecnologias', '')}
            </span>
            <span className="text-muted">· {question.topic.name}</span>
          </p>
          <p className="mt-2 text-[0.95rem] leading-relaxed sm:text-base">
            {question.statement}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="chip">nível {question.difficulty}</span>
          <button
            onClick={onToggleFavorite}
            aria-pressed={favorited}
            aria-label={
              favorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'
            }
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

      <div className="space-y-2 px-4 pb-4 sm:px-5">
        {question.alternatives.map((alt, i) => {
          const isChosen = chosen === alt.id;
          const isCorrect = result?.correctAlternativeId === alt.id;
          const isWrongPick = !!result && isChosen && !result.isCorrect;
          const stateCls = result
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
              onClick={() => onChoose(alt.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${stateCls}`}
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

      {result && (
        <div
          className={`border-t px-4 py-3 sm:px-5 ${
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

/** Painel lateral de filtros (drawer), com staging e Aplicar. */
function FilterDrawer({
  open,
  subjects,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  subjects: Subject[];
  initial: { subjectId: string; difficulty: number; onlyFavorites: boolean };
  onClose: () => void;
  onApply: (f: {
    subjectId: string;
    difficulty: number;
    onlyFavorites: boolean;
  }) => void;
}) {
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [onlyFavorites, setOnlyFavorites] = useState(initial.onlyFavorites);

  // Re-semeia o staging sempre que o drawer abre.
  useEffect(() => {
    if (open) {
      setSubjectId(initial.subjectId);
      setDifficulty(initial.difficulty);
      setOnlyFavorites(initial.onlyFavorites);
    }
  }, [open, initial.subjectId, initial.difficulty, initial.onlyFavorites]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-surface shadow-xl animate-rise">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold">Filtros</h2>
          <button
            onClick={onClose}
            aria-label="Fechar filtros"
            className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconX width={18} height={18} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div>
            <span className="eyebrow">Área</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setSubjectId('')}
                className={`chip ${!subjectId ? 'ring-1 ring-brand' : ''}`}
              >
                Todas
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
          </div>

          <div>
            <span className="eyebrow">Nível de dificuldade</span>
            <div className="seg mt-2">
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
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={onlyFavorites}
              onChange={(e) => setOnlyFavorites(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-sm">Só questões favoritas</span>
          </label>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
          <button
            onClick={() => {
              setSubjectId('');
              setDifficulty(0);
              setOnlyFavorites(false);
            }}
            className="btn btn-ghost"
          >
            Limpar
          </button>
          <button
            onClick={() => onApply({ subjectId, difficulty, onlyFavorites })}
            className="btn btn-primary flex-1"
          >
            Aplicar
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default function Questoes() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favoriteQuestions, setFavoriteQuestions] = useState<Question[]>([]);

  // Filtros aplicados (o drawer faz o staging e confirma no Aplicar).
  const [subjectId, setSubjectId] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Buffer paginado (modo banco) + ponteiro da questão atual.
  const [fetched, setFetched] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [bankTotal, setBankTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de resposta por questão (preservado ao revisitar).
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});

  // Catálogo de áreas e favoritos (uma vez).
  useEffect(() => {
    void (async () => {
      try {
        const [subs, favs] = await Promise.all([api.subjects(), api.favorites()]);
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
        setBankTotal(res.meta.total);
        setFetched((cur) => (replace ? res.items : [...cur, ...res.items]));
        return res.items.length;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Não foi possível buscar questões.',
        );
        return 0;
      } finally {
        setLoading(false);
      }
    },
    [subjectId, difficulty],
  );

  // Favoritas: derivadas em memória (refletem toggles ao vivo, sem refetch).
  const favFiltered = useMemo(
    () =>
      favoriteQuestions.filter(
        (q) =>
          (!subjectId || q.topic.subject.id === subjectId) &&
          (!difficulty || q.difficulty === difficulty),
      ),
    [favoriteQuestions, subjectId, difficulty],
  );

  const items = onlyFavorites ? favFiltered : fetched;
  const total = onlyFavorites ? items.length : bankTotal;

  // (Re)carrega do começo só quando os filtros aplicados mudam (não em toggles).
  useEffect(() => {
    setIdx(0);
    if (!onlyFavorites) void fetchPage(1, true);
  }, [fetchPage, onlyFavorites]);

  // Mantém o ponteiro válido se a lista encolher (ex.: desfavoritar a atual).
  useEffect(() => {
    if (idx > 0 && idx >= items.length) {
      setIdx(Math.max(0, items.length - 1));
    }
  }, [items.length, idx]);

  const current = items[idx];
  const canPrev = idx > 0;
  const canNext =
    idx < items.length - 1 || (!onlyFavorites && page < pages);
  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.result).length,
    [answers],
  );

  const activeFilters =
    (subjectId ? 1 : 0) + (difficulty ? 1 : 0) + (onlyFavorites ? 1 : 0);

  async function goNext() {
    if (idx < items.length - 1) {
      setIdx(idx + 1);
      return;
    }
    if (!onlyFavorites && page < pages) {
      const added = await fetchPage(page + 1, false);
      if (added > 0) setIdx((i) => i + 1);
    }
  }

  function choose(alternativeId: string) {
    if (!current || answers[current.id]?.result) return;
    setAnswers((cur) => ({
      ...cur,
      [current.id]: { chosen: alternativeId, result: null },
    }));
  }

  async function submit() {
    if (!current) return;
    const chosen = answers[current.id]?.chosen;
    if (!chosen) return;
    setError(null);
    try {
      const result = await api.answer(current.id, chosen);
      setAnswers((cur) => ({ ...cur, [current.id]: { chosen, result } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    }
  }

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

  const state = current
    ? answers[current.id] ?? { chosen: null, result: null }
    : { chosen: null, result: null };
  const answered = !!state.result;

  return (
    <div className="space-y-4 pb-28 md:pb-24">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Banco de questões</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Questões comentadas
          </h1>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="btn btn-ghost shrink-0"
        >
          <IconFilter width={18} height={18} />
          Filtros
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">
              {activeFilters}
            </span>
          )}
        </button>
      </header>

      {/* Resumo dos filtros ativos */}
      {activeFilters > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {subjectId && (
            <span className="chip">
              {subjects
                .find((s) => s.id === subjectId)
                ?.name.replace(' e suas Tecnologias', '')}
            </span>
          )}
          {difficulty > 0 && <span className="chip">Nível {difficulty}</span>}
          {onlyFavorites && <span className="chip">Favoritas</span>}
          <button
            onClick={() => {
              setSubjectId('');
              setDifficulty(0);
              setOnlyFavorites(false);
            }}
            className="text-muted underline-offset-2 hover:underline"
          >
            limpar
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {!current ? (
        loading ? (
          <div className="card p-6" aria-busy>
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <SkeletonText width="40%" />
            </div>
            <div className="mt-4 space-y-2">
              <SkeletonText width="95%" />
              <SkeletonText width="80%" />
              <SkeletonText width="60%" />
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          </div>
        ) : (
          <p className="card p-8 text-center text-sm text-muted">
            {onlyFavorites
              ? 'Você ainda não favoritou questões com esses filtros.'
              : 'Nenhuma questão encontrada. Ajuste os filtros.'}
          </p>
        )
      ) : (
        <QuestionView
          key={current.id}
          question={current}
          state={state}
          favorited={favoritedIds.has(current.id)}
          onChoose={choose}
          onToggleFavorite={() => toggleFavorite(current)}
        />
      )}

      {/* Barra de ação fixa — acima da tabbar no mobile. */}
      {current && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-20 px-4 md:bottom-4 md:pl-64">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-line bg-surface/90 px-3 py-2.5 shadow-[var(--shadow)] backdrop-blur">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={!canPrev}
              aria-label="Questão anterior"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
            >
              <IconChevronLeft width={20} height={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <p className="font-display text-sm font-bold tabular-nums">
                {idx + 1}
                <span className="text-muted"> / {total || items.length}</span>
              </p>
              <p className="text-[0.68rem] text-muted">{answeredCount} respondidas</p>
            </div>

            {answered ? (
              <button
                onClick={goNext}
                disabled={!canNext || loading}
                className="btn btn-primary shrink-0"
              >
                {loading ? 'Carregando…' : 'Próxima'}
                <IconChevronRight width={18} height={18} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!state.chosen}
                className="btn btn-primary shrink-0"
              >
                Responder
              </button>
            )}
          </div>
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        subjects={subjects}
        initial={{ subjectId, difficulty, onlyFavorites }}
        onClose={() => setDrawerOpen(false)}
        onApply={(f) => {
          setSubjectId(f.subjectId);
          setDifficulty(f.difficulty);
          setOnlyFavorites(f.onlyFavorites);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}
