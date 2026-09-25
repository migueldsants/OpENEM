import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  api,
  type AnswerResult,
  type ExamRef,
  type Question,
  type QuestionFacets,
  type Subject,
} from '../api';
import { useAuth } from '../auth';
import { EmptyState } from '../components/EmptyState';
import { QuestionExplanation } from '../components/QuestionExplanation';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';
import { GamificationFeedback } from '../components/GamificationFeedback';
import {
  IconBoard,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconNote,
  IconStack,
  IconStar,
  IconTarget,
  IconX,
} from '../components/icons';
import { QuestNoteModal } from '../components/QuestNoteModal';
import { DockOffset } from '../components/DockOffset';
import { useDialog } from '../components/Modal';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';
import { Markdown } from '../components/Markdown';
import {
  areaSourceName,
  codeLabel,
  hasCalibratedDifficulty,
  normalizeCodeQuery,
  subjectLabel,
  topicLabel,
} from '../lib/question';

// Overlay "Anotar" é lazy (carrega o editor + mathlive só quando aberto).
const AnnotateOverlay = lazy(() =>
  import('../board/AnnotateOverlay').then((m) => ({ default: m.AnnotateOverlay })),
);

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Frase para leitor de tela: o resultado e, no erro, a letra certa. */
function anuncioResultado(
  result: AnswerResult,
  alternatives: { id: string; letter?: string | null }[],
): string {
  if (result.isCorrect) return 'Você acertou!';
  const i = alternatives.findIndex((a) => a.id === result.correctAlternativeId);
  if (i < 0) return 'Não foi dessa vez.';
  return `Não foi dessa vez. A resposta certa é a ${alternatives[i].letter ?? LETTERS[i]}.`;
}

interface AnswerState {
  chosen: string | null;
  result: AnswerResult | null;
}

/** Card da questão atual — controlado: o estado de resposta vive no pai. */
function QuestionView({
  question,
  state,
  favorited,
  hasNote,
  onChoose,
  onToggleFavorite,
  onAnnotate,
  onNote,
}: {
  question: Question;
  state: AnswerState;
  favorited: boolean;
  hasNote: boolean;
  onChoose: (alternativeId: string) => void;
  onToggleFavorite: () => void;
  onAnnotate: () => void;
  onNote: () => void;
}) {
  const area = areaKey(areaSourceName(question));
  const { chosen, result } = state;

  return (
    <div className="card card-raised overflow-hidden animate-rise">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={`font-semibold ${AREA_TEXT[area]}`}>
              {subjectLabel(question)}
            </span>
            {topicLabel(question) && (
              <span className="text-muted">· {topicLabel(question)}</span>
            )}
            {codeLabel(question) && (
              <span className="rounded-lg bg-surface-2 px-1.5 py-0.5 font-mono text-xs tracking-tight text-muted">
                {codeLabel(question)}
              </span>
            )}
          </p>
          {/* Markdown: os enunciados oficiais trazem imagens, tabelas e LaTeX. */}
          <Markdown className="mt-2 text-[0.95rem] leading-relaxed sm:text-base">
            {question.statement}
          </Markdown>
          {question.questionPrompt && (
            <Markdown className="mt-3 text-[0.95rem] font-medium leading-relaxed sm:text-base">
              {question.questionPrompt}
            </Markdown>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Todas as questões oficiais entram no nível padrão: mostrar "nível 3"
              em milhares de questões seria desinformação. O código já diz a prova. */}
          {hasCalibratedDifficulty(question) && (
            <span className="chip">nível {question.difficulty}</span>
          )}
          <button
            onClick={onNote}
            aria-label={hasNote ? 'Ver/editar anotação' : 'Anotar esta questão'}
            title={hasNote ? 'Ver/editar anotação' : 'Adicionar nota'}
            className={`grid size-9 place-items-center rounded-lg border transition-colors ${
              hasNote
                ? 'border-transparent bg-warning/15 text-warning'
                : 'border-line text-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <IconNote width={18} height={18} filled={hasNote} />
          </button>
          <button
            onClick={onAnnotate}
            aria-label="Anotar no quadro"
            title="Anotar no quadro"
            className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconBoard width={18} height={18} />
          </button>
          <button
            onClick={onToggleFavorite}
            aria-pressed={favorited}
            aria-label={
              favorited ? 'Remover dos favoritos' : 'Salvar nos favoritos'
            }
            className={`grid size-9 place-items-center rounded-lg border transition-colors ${
              favorited
                ? 'border-transparent bg-warning/15 text-warning'
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
              ? 'border-success bg-success/10'
              : isWrongPick
                ? 'border-danger bg-danger/10'
                : 'border-line text-muted'
            : isChosen
              ? 'border-brand bg-brand/8'
              : 'border-line hover:bg-surface-2';
          return (
            <button
              key={alt.id}
              type="button"
              disabled={!!result}
              aria-pressed={result ? undefined : isChosen}
              onClick={() => onChoose(alt.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${stateCls}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
                  isChosen && !result
                    ? 'bg-brand text-brand-ink'
                    : 'bg-surface-2 text-muted'
                }`}
              >
                {alt.letter ?? LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">
                {alt.imageUrl ? (
                  <img
                    src={alt.imageUrl}
                    alt={`Alternativa ${alt.letter ?? LETTERS[i]}`}
                    loading="lazy"
                    decoding="async"
                    className="h-auto max-w-full rounded-lg"
                  />
                ) : (
                  alt.text
                )}
              </span>
              {result && isCorrect && (
                <>
                  <IconCheck width={16} height={16} className="shrink-0 text-success" />
                  <span className="sr-only">(resposta correta)</span>
                </>
              )}
              {isWrongPick && (
                <>
                  <IconX width={16} height={16} className="shrink-0 text-danger" />
                  <span className="sr-only">(sua resposta)</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Sempre montado: região viva criada junto com o texto nem sempre é lida. */}
      <p className="sr-only" aria-live="polite">
        {result ? anuncioResultado(result, question.alternatives) : ''}
      </p>

      {result && (
        <div
          className={`border-t px-4 py-3 sm:px-5 ${
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
            key={question.id}
            questionId={question.id}
            explanation={result.explanation}
            source={result.explanationSource}
            offline={result.offlineQueued}
          />
          {result.gamification && <GamificationFeedback g={result.gamification} />}
        </div>
      )}
    </div>
  );
}

/** Filtros aplicados à lista de questões. */
interface Filtros {
  areaId: string;
  subjectId: string;
  topicId: string;
  examSlug: string;
  onlyFavorites: boolean;
}

const SEM_FILTROS: Filtros = {
  areaId: '',
  subjectId: '',
  topicId: '',
  examSlug: '',
  onlyFavorites: false,
};

/** Matérias sem questão objetiva: Redação é a prova discursiva. */
const SEM_QUESTOES = new Set(['Redação']);

function semTecnologias(nome: string): string {
  return nome.replace(' e suas Tecnologias', '');
}

/**
 * Painel lateral de filtros (drawer), com staging e Aplicar.
 *
 * Área → matéria → assunto, em cascata, com a contagem de questões ao lado.
 * Matéria e assunto sem nenhuma questão ficam de fora: a maior parte do banco
 * oficial ainda não foi classificada por assunto, e oferecer "Funções (0)"
 * seria mandar o aluno para uma lista vazia.
 */
function FilterDrawer({
  open,
  subjects,
  exams,
  facets,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  subjects: Subject[];
  exams: ExamRef[];
  facets: QuestionFacets | null;
  initial: Filtros;
  onClose: () => void;
  onApply: (f: Filtros) => void;
}) {
  const [f, setF] = useState<Filtros>(initial);
  const painelRef = useRef<HTMLElement>(null);
  useDialog(painelRef, onClose, open);

  // Re-semeia o staging sempre que o drawer abre.
  useEffect(() => {
    if (open) setF(initial);
  }, [open, initial]);

  const contagem = useMemo(
    () => ({
      area: new Map((facets?.areas ?? []).map((a) => [a.id, a.count])),
      topic: new Map((facets?.topics ?? []).map((t) => [t.id, t.count])),
      exam: new Map((facets?.exams ?? []).map((e) => [e.slug, e.count])),
    }),
    [facets],
  );

  const areas = useMemo(() => {
    const porId = new Map<string, { id: string; name: string }>();
    for (const s of subjects) {
      if (s.subjectArea) porId.set(s.subjectArea.id, s.subjectArea);
    }
    return [...porId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects]);

  // Matérias da área escolhida que têm ao menos uma questão classificada.
  const materias = useMemo(
    () =>
      subjects
        .filter(
          (s) =>
            !SEM_QUESTOES.has(s.name) &&
            (!f.areaId || s.subjectArea?.id === f.areaId),
        )
        .map((s) => ({
          ...s,
          count: s.topics.reduce(
            (acc, t) => acc + (contagem.topic.get(t.id) ?? 0),
            0,
          ),
        }))
        .filter((s) => s.count > 0),
    [subjects, f.areaId, contagem],
  );

  const assuntos = useMemo(() => {
    const materia = subjects.find((s) => s.id === f.subjectId);
    return (materia?.topics ?? [])
      .map((t) => ({ ...t, count: contagem.topic.get(t.id) ?? 0 }))
      .filter((t) => t.count > 0);
  }, [subjects, f.subjectId, contagem]);

  if (!open) return null;

  const chip = (ativo: boolean) => `chip ${ativo ? 'ring-1 ring-brand' : ''}`;
  const qtd = (n: number | undefined) =>
    n != null ? (
      <span className="tabular-nums text-muted">{n.toLocaleString('pt-BR')}</span>
    ) : null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={painelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-surface shadow-xl outline-none animate-rise"
      >
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
                onClick={() => setF({ ...f, areaId: '', subjectId: '', topicId: '' })}
                className={chip(!f.areaId)}
              >
                Todas {qtd(facets?.total)}
              </button>
              {areas.map((a) => {
                const ativo = f.areaId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() =>
                      setF({
                        ...f,
                        areaId: ativo ? '' : a.id,
                        subjectId: '',
                        topicId: '',
                      })
                    }
                    className={chip(ativo)}
                  >
                    <span
                      className={`size-2.5 rounded-full ${AREA_DOT[areaKey(a.name)]}`}
                    />
                    {semTecnologias(a.name)} {qtd(contagem.area.get(a.id))}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="eyebrow">Matéria</span>
            {materias.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {materias.map((m) => {
                  const ativo = f.subjectId === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setF({
                          ...f,
                          areaId: m.subjectArea?.id ?? f.areaId,
                          subjectId: ativo ? '' : m.id,
                          topicId: '',
                        })
                      }
                      className={chip(ativo)}
                    >
                      {m.name} {qtd(m.count)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">
                As questões oficiais ainda não foram classificadas por matéria
                {f.areaId ? ' nesta área' : ''}. Por enquanto, filtre pela área
                e pela prova.
              </p>
            )}
          </div>

          {f.subjectId && assuntos.length > 0 && (
            <div>
              <span className="eyebrow">Assunto</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {assuntos.map((t) => {
                  const ativo = f.topicId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setF({ ...f, topicId: ativo ? '' : t.id })}
                      className={chip(ativo)}
                    >
                      {t.name} {qtd(t.count)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="filtro-prova" className="eyebrow">
              Prova
            </label>
            <select
              id="filtro-prova"
              value={f.examSlug}
              onChange={(e) => setF({ ...f, examSlug: e.target.value })}
              className="input mt-2 w-full"
            >
              <option value="">Todas as provas</option>
              {exams.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.label}
                  {contagem.exam.has(e.slug)
                    ? ` · ${contagem.exam.get(e.slug)} questões`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={f.onlyFavorites}
              onChange={(e) => setF({ ...f, onlyFavorites: e.target.checked })}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-sm">Só questões favoritas</span>
          </label>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
          <button onClick={() => setF(SEM_FILTROS)} className="btn btn-ghost">
            Limpar
          </button>
          <button onClick={() => onApply(f)} className="btn btn-primary flex-1">
            Aplicar
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export default function Questoes() {
  const { refresh } = useGamification();
  const { me } = useAuth();
  // Língua estrangeira do aluno: sem ela, cada questão de LE apareceria duas
  // vezes (o banco guarda a versão em inglês e a em espanhol).
  const language = me?.profile?.foreignLanguage ?? 'ingles';
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<ExamRef[]>([]);
  const [facets, setFacets] = useState<QuestionFacets | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favoriteQuestions, setFavoriteQuestions] = useState<Question[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Filtros aplicados (o drawer faz o staging e confirma no Aplicar).
  // topicId pode vir do deep-link do mapa de calor (issue #43).
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...SEM_FILTROS,
    topicId: searchParams.get('topicId') ?? '',
  }));
  const { areaId, subjectId, topicId, examSlug, onlyFavorites } = filtros;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Busca por código: o campo atualiza na hora, a busca espera o aluno parar
  // de digitar para não disparar uma requisição por tecla.
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCode(codeInput.trim()), 400);
    return () => clearTimeout(t);
  }, [codeInput]);

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

  // Anotações pessoais (issue #39): questões com nota.
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<string | null>(null);

  // Overlay "Anotar" — board scratch vinculado à questão atual (issue #32).
  const [annotateFor, setAnnotateFor] = useState<string | null>(null);

  // Catálogo de áreas, favoritos e anotações (uma vez).
  useEffect(() => {
    void (async () => {
      try {
        const [subs, favs, notes, provas] = await Promise.all([
          api.subjects(),
          api.favorites(),
          api.questionNotes(),
          api.exams(),
        ]);
        setSubjects(subs);
        setExams(provas);
        setFavoritedIds(new Set(favs.map((f) => f.question.id)));
        setFavoriteQuestions(favs.map((f) => f.question));
        setNotedIds(new Set(notes.map((n) => n.question.id)));
      } catch (err) {
        // Antes silencioso (issue #49): sem catálogo os filtros somem sem causa.
        setCatalogError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar matérias e favoritos.',
        );
      }
    })();
  }, []);

  // Contagens dos filtros: dependem da língua (a versão na outra língua sai).
  useEffect(() => {
    void api
      .questionFacets(language)
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [language]);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.questions({
          subjectAreaId: areaId || undefined,
          subjectId: subjectId || undefined,
          topicId: topicId || undefined,
          examSlug: examSlug || undefined,
          code: code || undefined,
          language,
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
    [areaId, subjectId, topicId, examSlug, code, language],
  );

  // Favoritas: derivadas em memória (refletem toggles ao vivo, sem refetch).
  const favFiltered = useMemo(() => {
    const prefixo = code ? normalizeCodeQuery(code) : '';
    return favoriteQuestions.filter(
      (q) =>
        (!areaId || q.subjectArea?.id === areaId) &&
        (!subjectId || q.topic?.subject.id === subjectId) &&
        (!topicId || q.topic?.id === topicId) &&
        (!examSlug || q.examYear?.slug === examSlug) &&
        (!prefixo || (q.code ?? '').startsWith(prefixo)),
    );
  }, [favoriteQuestions, areaId, subjectId, topicId, examSlug, code]);

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
    (areaId ? 1 : 0) +
    (subjectId ? 1 : 0) +
    (topicId ? 1 : 0) +
    (examSlug ? 1 : 0) +
    (onlyFavorites ? 1 : 0);

  // O drawer re-semeia o staging quando `initial` muda: precisa ser estável.
  const filtrosIniciais = useMemo(() => filtros, [filtros]);

  /** Nome do tópico filtrado (deep-link do heatmap, issue #43). */
  const topicName = useMemo(() => {
    if (!topicId) return null;
    for (const s of subjects) {
      const t = s.topics.find((x) => x.id === topicId);
      if (t) return t.name;
    }
    return null;
  }, [subjects, topicId]);

  function clearTopicFilter() {
    setFiltros((f) => ({ ...f, topicId: '' }));
    // Remove o query param do deep-link para não re-aplicar no próximo mount.
    setSearchParams((cur) => {
      const next = new URLSearchParams(cur);
      next.delete('topicId');
      return next;
    });
  }

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
      void refresh();
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
    <div className="space-y-6 pb-28 md:pb-24">
      <PageHeader
        eyebrow="Banco oficial do ENEM"
        title="Questões"
        actions={
          <button onClick={() => setDrawerOpen(true)} className="btn btn-ghost">
            <IconFilter width={18} height={18} />
            Filtros
            {activeFilters > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">
                {activeFilters}
              </span>
            )}
          </button>
        }
      />

      {/* Busca pelo código da questão: ENEM-2023-136, "2023 136", "2023". */}
      <div className="relative">
        <input
          type="search"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="Buscar por código: ENEM-2023-136"
          aria-label="Buscar questão pelo código"
          className="input w-full font-mono text-sm"
        />
      </div>

      {/* Resumo dos filtros ativos */}
      {activeFilters > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {areaId && !subjectId && (
            <span className="chip">
              {semTecnologias(
                subjects.find((s) => s.subjectArea?.id === areaId)?.subjectArea
                  ?.name ?? 'Área',
              )}
            </span>
          )}
          {subjectId && (
            <span className="chip">
              {subjects.find((s) => s.id === subjectId)?.name}
            </span>
          )}
          {examSlug && (
            <span className="chip">
              {exams.find((e) => e.slug === examSlug)?.label ?? examSlug}
            </span>
          )}
          {topicId && (
            <span className="chip">
              <IconTarget width={14} height={14} />
              {topicName ?? 'Assunto'}
              <button
                onClick={clearTopicFilter}
                aria-label="Remover filtro de assunto"
                className="ml-0.5 text-muted hover:text-danger"
              >
                ×
              </button>
            </span>
          )}
          {onlyFavorites && <span className="chip">Favoritas</span>}
          <button
            onClick={() => {
              if (topicId) clearTopicFilter();
              setFiltros(SEM_FILTROS);
            }}
            className="text-muted underline-offset-2 hover:underline"
          >
            limpar
          </button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {!error && catalogError && <ErrorBanner message={catalogError} />}

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
          <EmptyState
            icon={IconStack}
            title="Nenhuma questão encontrada"
            description={
              onlyFavorites
                ? 'Você ainda não favoritou questões com esses filtros.'
                : code
                  ? `Nenhuma questão com o código ${normalizeCodeQuery(code)}.`
                  : 'Ajuste os filtros para ver outras questões.'
            }
            tip="Tente outra área, outra prova ou remova os favoritos"
          />
        )
      ) : (
        <QuestionView
          key={current.id}
          question={current}
          state={state}
          favorited={favoritedIds.has(current.id)}
          hasNote={notedIds.has(current.id)}
          onChoose={choose}
          onToggleFavorite={() => toggleFavorite(current)}
          onAnnotate={() => setAnnotateFor(current.id)}
          onNote={() => setNoteFor(current.id)}
        />
      )}

      {/* Barra de ação fixa, acima da tabbar no mobile. No desktop acompanha a
          coluna de conteúdo (sidebar 15rem + respiro 2.5rem, mesma largura). */}
      {current && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[4.75rem] z-20 px-4 md:bottom-4 md:pl-[17.5rem] md:pr-10">
          <DockOffset />
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-line bg-surface/90 px-3 py-2.5 shadow-[var(--shadow)] backdrop-blur xl:max-w-4xl 2xl:max-w-5xl">
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
              <p className="text-xs text-muted">{answeredCount} respondidas</p>
            </div>

            {/* Um botão só, que muda de papel: trocar o elemento derrubaria o
                foco de quem responde pelo teclado. */}
            <button
              onClick={answered ? goNext : submit}
              disabled={answered ? !canNext || loading : !state.chosen}
              className="btn btn-primary shrink-0"
            >
              {answered ? (
                <>
                  {loading ? 'Carregando…' : 'Próxima'}
                  <IconChevronRight width={18} height={18} />
                </>
              ) : (
                'Responder'
              )}
            </button>
          </div>
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        subjects={subjects}
        exams={exams}
        facets={facets}
        initial={filtrosIniciais}
        onClose={() => setDrawerOpen(false)}
        onApply={(f) => {
          // O assunto do deep-link do mapa de calor sai da URL ao ser trocado.
          if (topicId && f.topicId !== topicId) clearTopicFilter();
          setFiltros(f);
          setDrawerOpen(false);
        }}
      />

      {annotateFor && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-bg text-sm text-muted">
              Carregando editor…
            </div>
          }
        >
          <AnnotateOverlay
            questionId={annotateFor}
            questionTitle={current?.statement ?? 'Questão'}
            onClose={() => setAnnotateFor(null)}
          />
        </Suspense>
      )}

      {noteFor && (
        <QuestNoteModal
          questionId={noteFor}
          questionStatement={current?.statement ?? 'Questão'}
          onClose={() => {
            setNoteFor(null);
            // Recarrega o conjunto de notas para refletir salva/remoção.
            void api.questionNotes().then((notes) =>
              setNotedIds(new Set(notes.map((n) => n.question.id))),
            );
          }}
        />
      )}
    </div>
  );
}
