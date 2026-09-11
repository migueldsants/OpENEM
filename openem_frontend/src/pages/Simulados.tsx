import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type SimulationResult,
  type SimulationStart,
  type SimulationTemplate,
  type Subject,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { QuestionExplanation } from '../components/QuestionExplanation';
import { ErrorBanner } from '../components/ErrorBanner';
import { GamificationFeedback } from '../components/GamificationFeedback';
import { IconBook, IconCheck, IconClock, IconFilter, IconStack, IconX } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';
import { Markdown } from '../components/Markdown';
import {
  areaSourceName,
  codeLabel,
  hasCalibratedDifficulty,
  subjectLabel,
  topicLabel,
} from '../lib/question';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const STORAGE_KEY = 'openem.simulado.ativo';

type Phase = 'list' | 'running' | 'result';

interface ActiveState {
  start: SimulationStart;
  answers: Record<string, string>;
  timeSpent: Record<string, number>;
}

function loadActive(): ActiveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveState;
    if (!parsed.start?.id || !Array.isArray(parsed.start.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveActive(state: ActiveState | null): void {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  else localStorage.removeItem(STORAGE_KEY);
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Filtros do simulado personalizado (issue #40). */
interface SimulationFilters {
  subjectId?: string;
  topicId?: string;
  questionCount?: number;
  pareto?: boolean;
}

const QUICK_COUNTS = [5, 10, 15, 20, 30];
const CUSTOM_TEMPLATE_ID = 'seed-template-custom';

/**
 * Builder de simulado personalizado (issue #40): matéria > tópico,
 * quantidade (rápido 5–10 vs completo) e ordenação por frequência ENEM.
 */
function CustomBuilder({
  onStart,
  starting,
}: {
  onStart: (filters: SimulationFilters) => void;
  starting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [count, setCount] = useState(10);
  const [pareto, setPareto] = useState(true);

  useEffect(() => {
    if (!open || subjects !== null) return;
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [open, subjects]);

  const topics =
    subjects?.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <div className="card card-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          <IconFilter width={20} height={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Simulado personalizado
          </span>
          <span className="block text-xs text-muted">
            Escolha matéria, assunto e quantas questões quer
          </span>
        </span>
        <span className="btn btn-primary shrink-0">
          {open ? 'Fechar' : 'Montar'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line p-4">
          {subjects === null ? (
            <p className="text-xs text-muted" aria-busy>
              Carregando matérias…
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-muted">
                  Matéria
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setTopicId(''); // tópico depende da matéria
                    }}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
                  >
                    <option value="">Todas as matérias</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-muted">
                  Assunto (opcional)
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    disabled={!subjectId}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg disabled:opacity-50"
                  >
                    <option value="">
                      {subjectId ? 'Todos os assuntos' : 'Escolha uma matéria'}
                    </option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="block text-xs font-medium text-muted">
                  Quantidade de questões
                </span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {QUICK_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      data-active={count === n}
                      className="chip"
                    >
                      {n}
                      {n <= 10 && (
                        <span className="text-[0.6rem] text-muted">rápido</span>
                      )}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={3}
                    max={90}
                    value={count}
                    onChange={(e) =>
                      setCount(
                        Math.min(
                          90,
                          Math.max(3, Number(e.target.value) || 3),
                        ),
                      )
                    }
                    aria-label="Quantidade de questões"
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-center text-sm font-data tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={pareto}
                  onChange={(e) => setPareto(e.target.checked)}
                  className="size-4 accent-[var(--color-brand)]"
                />
                Priorizar assuntos mais frequentes no ENEM (Pareto)
              </label>

              <button
                type="button"
                onClick={() =>
                  onStart({
                    subjectId: subjectId || undefined,
                    topicId: topicId || undefined,
                    questionCount: count,
                    pareto,
                  })
                }
                disabled={starting}
                className="btn btn-primary w-full"
              >
                {starting ? 'Iniciando…' : `Iniciar com ${count} questões`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "Linguagens, Códigos e suas Tecnologias" → "Linguagens". */
function areaCurta(nome: string): string {
  return nome
    .replace(' e suas Tecnologias', '')
    .replace('Linguagens, Códigos', 'Linguagens')
    .replace('Ciências da ', '')
    .replace('Ciências ', '');
}

/** 330 → "5h30", 300 → "5h". */
function duracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Os dois dias de uma aplicação (regular ou reaplicação). */
interface Aplicacao {
  label: string;
  isReapplication: boolean;
  dias: SimulationTemplate[];
}

/** Provas oficiais agrupadas por ano: regular primeiro, reaplicação depois. */
function agruparProvas(templates: SimulationTemplate[]) {
  const porAno = new Map<number, Map<string, Aplicacao>>();
  for (const t of templates) {
    if (t.scope !== 'EXAM' || !t.exam) continue;
    const ano = porAno.get(t.exam.year) ?? new Map<string, Aplicacao>();
    const ap = ano.get(t.exam.slug) ?? {
      label: t.exam.isReapplication ? 'Reaplicação' : 'Aplicação regular',
      isReapplication: t.exam.isReapplication,
      dias: [],
    };
    ap.dias.push(t);
    ano.set(t.exam.slug, ap);
    porAno.set(t.exam.year, ano);
  }
  return [...porAno.entries()]
    .sort(([a], [b]) => b - a)
    .map(([ano, aps]) => ({
      ano,
      aplicacoes: [...aps.values()]
        .sort((a, b) => Number(a.isReapplication) - Number(b.isReapplication))
        .map((ap) => ({
          ...ap,
          dias: ap.dias.sort((a, b) => (a.day ?? 0) - (b.day ?? 0)),
        })),
    }));
}

/**
 * Provas oficiais do ENEM: cada dia é um simulado com as questões na ordem do
 * caderno e o tempo oficial. Anos mais recentes ficam abertos; os demais
 * aparecem sob demanda, para a lista não virar um paredão de 20 anos.
 */
function ProvasOficiais({
  templates,
  starting,
  onStart,
}: {
  templates: SimulationTemplate[];
  starting: string | null;
  onStart: (t: SimulationTemplate) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const anos = useMemo(() => agruparProvas(templates), [templates]);
  if (anos.length === 0) return null;
  const visiveis = verTodas ? anos : anos.slice(0, 3);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold">Provas oficiais do ENEM</h2>
        <p className="mt-0.5 text-xs text-muted">
          Cada dia completo, na ordem do caderno e com o tempo oficial de prova.
        </p>
      </div>

      <ul className="space-y-3">
        {visiveis.map(({ ano, aplicacoes }) => (
          <li key={ano} className="card card-raised p-4">
            <p className="font-display text-base font-bold">ENEM {ano}</p>
            <div className="mt-3 space-y-3">
              {aplicacoes.map((ap) => (
                <div key={ap.label}>
                  {aplicacoes.length > 1 && (
                    <p className="mb-1.5 text-xs font-semibold text-muted">
                      {ap.label}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ap.dias.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onStart(t)}
                        disabled={starting !== null}
                        className="rounded-xl border border-line p-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {t.day}º dia
                          </span>
                          <span className="text-xs font-medium text-brand">
                            {starting === t.id ? 'Iniciando…' : 'Iniciar'}
                          </span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                          {(t.areas ?? []).map((a) => (
                            <span
                              key={a}
                              className={`inline-flex items-center gap-1 ${AREA_TEXT[areaKey(a)]}`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${AREA_DOT[areaKey(a)]}`}
                              />
                              {areaCurta(a)}
                            </span>
                          ))}
                        </span>
                        <span className="mt-1 flex items-center gap-3 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <IconStack width={13} height={13} />
                            {t.questionCount} questões
                          </span>
                          {t.timeLimitMin != null && (
                            <span className="inline-flex items-center gap-1">
                              <IconClock width={13} height={13} />
                              {duracao(t.timeLimitMin)}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {anos.length > 3 && (
        <button
          onClick={() => setVerTodas((v) => !v)}
          className="btn btn-ghost w-full"
        >
          {verTodas
            ? 'Mostrar só as mais recentes'
            : `Ver todas as provas (${anos.length} anos)`}
        </button>
      )}
    </section>
  );
}

/** Lista de templates disponíveis para iniciar um simulado. */
function TemplateList({
  resumeAvailable,
  onResume,
  onStart,
}: {
  resumeAvailable: boolean;
  onResume: () => void;
  onStart: (
    template: SimulationTemplate,
    filters?: SimulationFilters,
  ) => void | Promise<void>;
}) {
  const [templates, setTemplates] = useState<SimulationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [customStarting, setCustomStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setTemplates(await api.simulationTemplates());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os simulados.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function start(template: SimulationTemplate) {
    setStarting(template.id);
    setError(null);
    try {
      await onStart(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar.');
    } finally {
      setStarting(null);
    }
  }

  async function startCustom(filters: SimulationFilters) {
    setCustomStarting(true);
    setError(null);
    try {
      await onStart(
        { id: CUSTOM_TEMPLATE_ID } as SimulationTemplate,
        filters,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar.');
    } finally {
      setCustomStarting(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Simulados</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Treine no padrão ENEM
        </h1>
        <p className="mt-1 text-sm text-muted">
          Faça uma prova oficial do ENEM, dia por dia, ou monte o seu simulado
          por área, matéria e assunto.
        </p>
      </header>

      {resumeAvailable && (
        <button
          onClick={onResume}
          className="card card-raised flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
            <IconClock width={20} height={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Retomar simulado em andamento
            </span>
            <span className="block text-xs text-muted">
              Você tem um simulado que ainda não foi finalizado.
            </span>
          </span>
          <span className="btn btn-primary shrink-0">Retomar</span>
        </button>
      )}

      {error && (
        <ErrorBanner message={error} />
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : templates.some((t) => t.scope === 'EXAM') ? (
        <ProvasOficiais
          templates={templates}
          starting={starting}
          onStart={(t) => void start(t)}
        />
      ) : (
        <EmptyState
          icon={IconBook}
          title="Nenhuma prova oficial disponível ainda"
          description="As provas entram com a importação do banco do ENEM (npm run db:import:enem)."
          tip="Enquanto isso, monte um simulado personalizado abaixo"
        />
      )}

      {/* Simulado personalizado (issue #40): área/matéria/assunto + quantidade. */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Monte o seu</h2>
        <CustomBuilder
          onStart={(f) => void startCustom(f)}
          starting={customStarting}
        />
      </section>

      {/* Outros simulados que não são prova oficial nem o personalizado. */}
      {templates.some(
        (t) => t.scope !== 'EXAM' && t.id !== CUSTOM_TEMPLATE_ID,
      ) && (
        <ul className="space-y-3">
          {templates
            .filter((t) => t.scope !== 'EXAM' && t.id !== CUSTOM_TEMPLATE_ID)
            .map((t) => {
            const area = t.subject ? areaKey(t.subject.name) : null;
            return (
              <li key={t.id} className="card card-raised overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-1 h-10 w-1 shrink-0 rounded-full ${
                      area ? AREA_DOT[area] : 'bg-brand'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span
                        className={`font-semibold ${
                          area ? AREA_TEXT[area] : 'text-brand'
                        }`}
                      >
                        {t.scope === 'FULL' ? 'Prova completa' : 'Por área'}
                      </span>
                      {t.subject && (
                        <span className="text-muted">· {t.subject.name}</span>
                      )}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold">{t.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <IconStack width={14} height={14} />
                        {t.questionCount} questões
                      </span>
                      {t.timeLimitMin != null && (
                        <span className="inline-flex items-center gap-1">
                          <IconClock width={14} height={14} />
                          {t.timeLimitMin} min
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => void start(t)}
                    disabled={starting === t.id}
                    className="btn btn-primary shrink-0"
                  >
                    {starting === t.id ? 'Iniciando…' : 'Iniciar'}
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

/** Player do simulado: cronômetro, navegação e seleção de alternativas. */
function Player({
  state,
  onChange,
  onFinish,
  onAbort,
}: {
  state: ActiveState;
  onChange: (next: ActiveState) => void;
  onFinish: (result: SimulationResult) => void;
  onAbort: () => void;
}) {
  const { start, answers } = state;
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enteredAt = useRef(Date.now());

  const startedMs = Date.parse(start.startedAt);
  const elapsedSec = Math.floor((now - startedMs) / 1000);
  const limitSec = start.timeLimitMin != null ? start.timeLimitMin * 60 : null;
  const remaining = limitSec != null ? limitSec - elapsedSec : null;

  // Tique do cronômetro.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Acumula o tempo gasto na questão atual antes de sair dela.
  const commitTime = useCallback(
    (questionId: string) => {
      const spent = Math.round((Date.now() - enteredAt.current) / 1000);
      enteredAt.current = Date.now();
      if (spent <= 0) return;
      onChange({
        ...state,
        timeSpent: {
          ...state.timeSpent,
          [questionId]: (state.timeSpent[questionId] ?? 0) + spent,
        },
      });
    },
    [onChange, state],
  );

  const questions = start.questions;
  const current = questions[index];
  const answeredCount = Object.keys(answers).length;

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    // Garante o tempo da questão corrente no payload.
    const spent = Math.round((Date.now() - enteredAt.current) / 1000);
    const timeSpent = { ...state.timeSpent };
    if (current) {
      timeSpent[current.id] = (timeSpent[current.id] ?? 0) + Math.max(0, spent);
    }
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        chosenId: answers[q.id],
        timeSpentSec: timeSpent[q.id] ?? 0,
      }));
      const result = await api.finishSimulation(start.id, payload);
      onFinish(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível finalizar.',
      );
      setFinishing(false);
    }
  }, [answers, current, finishing, onFinish, questions, start.id, state.timeSpent]);

  // Encerra automaticamente quando o tempo acaba.
  useEffect(() => {
    if (remaining != null && remaining <= 0 && !finishing) void finish();
  }, [remaining, finishing, finish]);

  function choose(altId: string) {
    onChange({ ...state, answers: { ...answers, [current.id]: altId } });
  }

  function go(to: number) {
    if (to < 0 || to >= questions.length) return;
    commitTime(current.id);
    setIndex(to);
  }

  if (!current) return null;
  const area = areaKey(areaSourceName(current));
  const lowTime = remaining != null && remaining <= 60;

  return (
    <div className="space-y-4">
      {/* Cabeçalho fixo com progresso e cronômetro. */}
      <div className="flex items-center gap-3">
        <button onClick={onAbort} className="btn btn-ghost shrink-0">
          Sair
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              Questão {index + 1} de {questions.length}
            </span>
            <span>{answeredCount} respondidas</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-display text-sm font-bold tabular-nums ${
            lowTime ? 'bg-red/12 text-red' : 'bg-surface-2 text-fg'
          }`}
        >
          <IconClock width={16} height={16} />
          {remaining != null
            ? formatClock(remaining)
            : formatClock(elapsedSec)}
        </span>
      </div>

      {/* Questão atual */}
      <div className="card card-raised overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-xs">
              <span className={`font-semibold ${AREA_TEXT[area]}`}>
                {subjectLabel(current)}
              </span>
              {topicLabel(current) && (
                <span className="text-muted">· {topicLabel(current)}</span>
              )}
              {codeLabel(current) && (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.7rem] tracking-tight text-muted">
                  {codeLabel(current)}
                </span>
              )}
            </p>
            <Markdown className="mt-1.5 text-sm leading-relaxed">
              {current.statement}
            </Markdown>
            {current.questionPrompt && (
              <Markdown className="mt-2 text-sm font-medium leading-relaxed">
                {current.questionPrompt}
              </Markdown>
            )}
          </div>
          {hasCalibratedDifficulty(current) && (
            <span className="chip shrink-0">nível {current.difficulty}</span>
          )}
        </div>

        <div className="space-y-1.5 px-4 pb-4">
          {current.alternatives.map((alt, i) => {
            const isChosen = answers[current.id] === alt.id;
            return (
              <button
                key={alt.id}
                type="button"
                onClick={() => choose(alt.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  isChosen ? 'border-brand bg-brand/8' : 'border-line hover:bg-surface-2'
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                    isChosen ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
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
                      className="h-auto max-w-full rounded"
                    />
                  ) : (
                    alt.text
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <ErrorBanner message={error} />
      )}

      {/* Navegação */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="btn btn-ghost"
        >
          Anterior
        </button>
        {index < questions.length - 1 ? (
          <button onClick={() => go(index + 1)} className="btn btn-primary ml-auto">
            Próxima
          </button>
        ) : (
          <button
            onClick={() => void finish()}
            disabled={finishing}
            className="btn btn-primary ml-auto"
          >
            {finishing ? 'Corrigindo…' : 'Finalizar simulado'}
          </button>
        )}
      </div>

      {/* Grade de navegação rápida entre questões */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const done = !!answers[q.id];
          const active = i === index;
          return (
            <button
              key={q.id}
              onClick={() => go(i)}
              aria-label={`Ir para a questão ${i + 1}`}
              className={`grid size-8 place-items-center rounded-md text-xs font-semibold transition-colors ${
                active
                  ? 'bg-brand text-brand-ink'
                  : done
                    ? 'bg-nat/15 text-nat'
                    : 'bg-surface-2 text-muted hover:text-fg'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tela de resultado: nota, TRI e gabarito comentado por questão. */
function Result({
  start,
  result,
  onBack,
}: {
  start: SimulationStart;
  result: SimulationResult;
  onBack: () => void;
}) {
  const detailByQuestion = new Map(result.details.map((d) => [d.questionId, d]));

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Resultado</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Simulado finalizado
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Acertos</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {result.correct}
            <span className="text-base font-semibold text-muted">
              /{result.total}
            </span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Aproveitamento</p>
          <p className="mt-1 font-display text-2xl font-extrabold">
            {result.percentage}%
          </p>
        </div>
        {result.triScore != null && (
          <div className="card p-4">
            <p className="text-xs text-muted">Nota TRI</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-brand">
              {Math.round(result.triScore)}
            </p>
          </div>
        )}
      </div>

      {result.gamification && (
        <div className="card card-raised p-4">
          <p className="text-xs text-muted">Recompensa</p>
          <GamificationFeedback g={result.gamification} />
        </div>
      )}

      <button onClick={onBack} className="btn btn-primary">
        Voltar aos simulados
      </button>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Gabarito comentado</h2>
        <ul className="space-y-3">
          {start.questions.map((q, qi) => {
            const detail = detailByQuestion.get(q.id);
            const area = areaKey(areaSourceName(q));
            return (
              <li key={q.id} className="card card-raised overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-1 h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="text-muted">Questão {qi + 1}</span>
                      <span className={`font-semibold ${AREA_TEXT[area]}`}>
                        {subjectLabel(q)}
                      </span>
                      {q.code && (
                        <span className="font-mono text-[0.7rem] text-muted">
                          {q.code}
                        </span>
                      )}
                    </p>
                    <Markdown className="mt-1.5 text-sm leading-relaxed">
                      {q.statement}
                    </Markdown>
                  </div>
                  {detail && (
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                        detail.isCorrect
                          ? 'bg-nat/15 text-nat'
                          : detail.chosenId
                            ? 'bg-red/12 text-red'
                            : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {detail.isCorrect ? (
                        <IconCheck width={16} height={16} />
                      ) : (
                        <IconX width={16} height={16} />
                      )}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 px-4 pb-3">
                  {q.alternatives.map((alt, i) => {
                    const isCorrect = detail?.correctAlternativeId === alt.id;
                    const isWrongPick =
                      !!detail && detail.chosenId === alt.id && !detail.isCorrect;
                    const cls = isCorrect
                      ? 'border-nat bg-nat/10'
                      : isWrongPick
                        ? 'border-red bg-red/10'
                        : 'border-line opacity-70';
                    return (
                      <div
                        key={alt.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${cls}`}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 text-xs font-semibold text-muted">
                          {LETTERS[i]}
                        </span>
                        <span className="min-w-0 flex-1">{alt.text}</span>
                        {isCorrect && (
                          <IconCheck width={16} height={16} className="shrink-0 text-nat" />
                        )}
                        {isWrongPick && (
                          <IconX width={16} height={16} className="shrink-0 text-red" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {detail && (
                  <div className="border-t border-line bg-surface-2/40 px-4 py-3">
                    {!detail.chosenId && (
                      <p className="mb-1 text-xs font-semibold text-muted">
                        Você deixou em branco.
                      </p>
                    )}
                    <QuestionExplanation
                      questionId={q.id}
                      explanation={detail.explanation}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default function Simulados() {
  const { refresh } = useGamification();
  const [phase, setPhase] = useState<Phase>('list');
  const [active, setActive] = useState<ActiveState | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);

  // Detecta um simulado em andamento salvo localmente.
  useEffect(() => {
    setResumeAvailable(!!loadActive());
  }, []);

  function updateActive(next: ActiveState) {
    setActive(next);
    saveActive(next);
  }

  async function handleStart(
    template: SimulationTemplate,
    filters?: SimulationFilters,
  ) {
    const start = await api.startSimulation(template.id, filters);
    const state: ActiveState = { start, answers: {}, timeSpent: {} };
    saveActive(state);
    setActive(state);
    setPhase('running');
  }

  function handleResume() {
    const saved = loadActive();
    if (!saved) {
      setResumeAvailable(false);
      return;
    }
    setActive(saved);
    setPhase('running');
  }

  function handleFinish(res: SimulationResult) {
    saveActive(null);
    setResumeAvailable(false);
    setResult(res);
    setPhase('result');
    void refresh();
  }

  function handleAbort() {
    // Mantém o progresso salvo para permitir retomar depois.
    setResumeAvailable(true);
    setActive(null);
    setPhase('list');
  }

  function backToList() {
    setResult(null);
    setActive(null);
    setPhase('list');
  }

  if (phase === 'running' && active) {
    return (
      <Player
        state={active}
        onChange={updateActive}
        onFinish={handleFinish}
        onAbort={handleAbort}
      />
    );
  }

  if (phase === 'result' && active && result) {
    return <Result start={active.start} result={result} onBack={backToList} />;
  }

  return (
    <TemplateList
      resumeAvailable={resumeAvailable}
      onResume={handleResume}
      onStart={(t, f) => handleStart(t, f)}
    />
  );
}
