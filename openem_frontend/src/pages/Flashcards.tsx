import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type FlashcardDeckBrief, type FlashcardForecastDay, type FlashcardItem, type FlashcardPreview, type FlashcardStats } from '../api';
import { EmptyState } from '../components/EmptyState';
import { Markdown } from '../components/Markdown';
import {
  IconAtom,
  IconBook,
  IconCheck,
  IconChevronDown,
  IconFormula,
  IconGlobe,
  IconNote,
  IconPlus,
  IconStack,
  IconX,
} from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import {
  areaKey,
  shortArea,
  AREA_DOT,
  AREA_TEXT,
  AREA_BADGE,
  AREA_RING,
  type AreaKey,
} from '../lib/areas';

// Ícone Phosphor por área do conhecimento.
const AREA_ICON: Record<AreaKey, (props: { width?: number; height?: number; weight?: string }) => React.ReactElement> = {
  mat: IconFormula as any,
  nat: IconAtom as any,
  hum: IconGlobe as any,
  lin: IconBook as any,
  red: IconNote as any,
  default: IconStack as any,
};

const SUBJECT_AREAS = [
  'Matemática e suas Tecnologias',
  'Ciências da Natureza e suas Tecnologias',
  'Ciências Humanas e suas Tecnologias',
  'Linguagens, Códigos e suas Tecnologias',
  'Redação',
];

const GRADES = [
  { label: 'Esqueci', quality: 1, cls: 'border-red/40 text-red hover:bg-red/10' },
  { label: 'Difícil', quality: 3, cls: 'border-hum/40 text-hum hover:bg-hum/10' },
  { label: 'Bom', quality: 4, cls: 'border-brand/40 text-brand hover:bg-brand/10' },
  { label: 'Fácil', quality: 5, cls: 'border-nat/40 text-nat hover:bg-nat/10' },
];

type Tab = 'study' | 'tree' | 'mine';

const TABS: { key: Tab; label: string }[] = [
  { key: 'study', label: 'Estudar' },
  { key: 'tree', label: 'Decks Prontos' },
  { key: 'mine', label: 'Meus Decks' },
];

// =============================================================================
// DASHBOARD — faixa compacta de estatísticas + mini previsão inline.
// =============================================================================
function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <span className={`chip ${accent ?? 'text-muted'}`} title={label}>
      <span className="opacity-70">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

function StatsBar({ stats, forecast }: { stats: FlashcardStats | null; forecast: FlashcardForecastDay[] }) {
  if (!stats || stats.total === 0) return null;
  const maxFc = Math.max(...forecast.map((f) => f.count), 1);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <StatPill label="Vencidos" value={stats.overdue} accent={stats.overdue > 0 ? 'text-red' : ''} />
      <StatPill label="Streak" value={`${stats.streak}d`} accent="text-hum" />
      <StatPill label="Retenção" value={`${stats.retention}%`} accent="text-nat" />
      <StatPill label="Maduros" value={stats.mature} />
      {/* Mini gráfico inline de 7 dias */}
      {forecast.length > 0 && (
        <div className="ml-auto flex items-end gap-0.5" title="Próximas revisões">
          {forecast.map((f) => (
            <div
              key={f.day}
              className={`w-1.5 rounded-full ${f.overdue ? 'bg-brand' : 'bg-brand/30'}`}
              style={{ height: `${Math.max(6, Math.round((f.count / maxFc) * 20))}px` }}
              title={`${f.label}: ${f.count} cards`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ESTUDO — Card com frente/verso Markdown e avaliação SM-2.
// =============================================================================
function StudyCard({
  card,
  index,
  total,
  onGraded,
}: {
  card: FlashcardItem;
  index: number;
  total: number;
  onGraded: (quality: number) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FlashcardPreview | null>(null);
  const area = areaKey(card.deckTopic ?? card.deckTitle);

  useEffect(() => {
    setFlipped(false);
    setPreview(null);
    setGradeError(null);
  }, [card.flashcardId]);

  // Ao virar o card, busca o preview de agendamento SM-2.
  useEffect(() => {
    if (flipped && !preview) {
      void api.flashcardPreview(card.flashcardId).then(setPreview).catch(() => {});
    }
  }, [flipped, card.flashcardId, preview]);

  async function grade(q: number) {
    setSaving(true);
    setGradeError(null);
    try {
      await api.reviewFlashcard(card.flashcardId, q);
      onGraded(q);
    } catch (e) {
      // Não avança o card: erro de rede/API não pode fingir que a revisão foi salva.
      setGradeError(
        e instanceof Error ? e.message : 'Não foi possível salvar. Tente de novo.',
      );
    } finally {
      setSaving(false);
    }
  }

  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

  // Formata intervalo em texto legível: "agora", "1 dia", "3 dias".
  function fmtInterval(d: number): string {
    if (d === 0) return 'agora';
    if (d === 1) return 'amanhã';
    if (d < 30) return `${d} dias`;
    const months = Math.round(d / 30);
    return months === 1 ? '1 mês' : `${months} meses`;
  }

  // Mapa quality -> intervalo do preview.
  const previewMap = new Map(preview?.previews.map((p) => [p.quality, p.intervalD]) ?? []);

  return (
    <div className="space-y-4">
      {/* Progresso da sessão */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>
            Card <span className="font-semibold text-fg">{index + 1}</span> de {total}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all duration-300 ${AREA_DOT[area]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="card card-raised overflow-hidden animate-rise">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <span className={`h-7 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
          <div className="min-w-0 flex-1">
            <span className={`text-sm font-semibold ${AREA_TEXT[area]}`}>
              {shortArea(card.deckTopic)}
            </span>
            {card.deckSubtheme && (
              <span className="text-muted text-sm"> · {card.deckSubtheme}</span>
            )}
          </div>
          {card.overdue ? (
            <span className="chip text-red">atrasado</span>
          ) : card.repetition === 0 ? (
            <span className="chip text-brand">novo</span>
          ) : (
            <span className="chip text-muted">revisão</span>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Pergunta
          </p>
          <Markdown className="text-[0.95rem] sm:text-base">{card.front}</Markdown>

          {flipped ? (
            <>
              <div className="my-4 h-px bg-line" />
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Resposta
              </p>
              <Markdown className="text-[0.95rem] text-muted sm:text-base">
                {card.back}
              </Markdown>
            </>
          ) : (
            <button
              onClick={() => setFlipped(true)}
              className="btn btn-primary mt-5 w-full"
            >
              Mostrar resposta
            </button>
          )}
        </div>
      </div>

      {/* Avaliação — só após virar */}
      {flipped && (
        <div className="card p-4 animate-rise">
          <h2 className="font-display text-base font-bold">
            Como foi sua lembrança?
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Sua resposta define quando este card volta para revisão.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g) => {
              const interval = previewMap.get(g.quality);
              return (
                <button
                  key={g.quality}
                  onClick={() => void grade(g.quality)}
                  disabled={saving}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${g.cls}`}
                >
                  <span>{saving ? '…' : g.label}</span>
                  {interval != null && !saving && (
                    <span className="text-[0.65rem] font-normal opacity-70">
                      {fmtInterval(interval)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {preview && preview.current.repetition > 0 && (
            <p className="mt-2.5 text-center text-xs text-muted">
              Repetição #{preview.current.repetition + 1} · facilidade {preview.current.easeFactor.toFixed(2)}
            </p>
          )}
          {gradeError && (
            <p className="mt-2.5 rounded-lg bg-red/10 px-3 py-2 text-center text-xs text-red">
              {gradeError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FOCO — sessão de estudo ativa: só o card, centralizado, sem header/tabs.
// =============================================================================
function StudyFocus({
  queue,
  currentIdx,
  onGraded,
  onExit,
}: {
  queue: FlashcardItem[];
  currentIdx: number;
  onGraded: (idx: number) => void;
  onExit: () => void;
}) {
  const current = queue[currentIdx];
  if (!current) return null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-xl flex-col justify-center">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <IconX width={14} height={14} />
          Encerrar sessão
        </button>
      </div>
      <StudyCard
        key={current.flashcardId}
        card={current}
        index={currentIdx}
        total={queue.length}
        onGraded={() => onGraded(currentIdx + 1)}
      />
    </div>
  );
}

// =============================================================================
// ÁRVORE — Decks Prontos como cards de área expansíveis, com subníveis compactos.
// Níveis: Área (card colorido) > Matéria > Subtema > Deck.
// Cada nível tem botão "Estudar" que monta a fila filtrada por aquele escopo.
// =============================================================================

/** Botão "Estudar" dos subníveis — sempre visível no mobile (touch não tem hover), reveal no hover do desktop. */
function HoverStudyButton({ count, onStudy }: { count: number; onStudy: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onStudy(); }}
      title={`Estudar ${count} cards`}
      className="btn btn-primary shrink-0 rounded-full px-2.5 py-0.5 text-[0.66rem] font-semibold transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
    >
      Estudar
    </button>
  );
}

/** Resumo de progresso: novos / vistos / revistos. */
function ProgressHint({ progress }: { progress: { newCards: number; seen: number; reviewed: number } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.68rem] tabular-nums">
      {progress.newCards > 0 && (
        <span className="text-brand" title={`${progress.newCards} novos`}>
          {progress.newCards} novo{progress.newCards !== 1 ? 's' : ''}
        </span>
      )}
      {progress.seen > progress.reviewed && (
        <span className="text-hum" title={`${progress.seen - progress.reviewed} vistos 1x`}>
          {progress.seen - progress.reviewed} visto{progress.seen - progress.reviewed !== 1 ? 's' : ''}
        </span>
      )}
      {progress.reviewed > 0 && (
        <span className="text-nat" title={`${progress.reviewed} revistos 2x+`}>
          {progress.reviewed} revisado{progress.reviewed !== 1 ? 's' : ''}
        </span>
      )}
    </span>
  );
}

function DeckTree({
  decks,
  progressMap,
  onStudyScope,
}: {
  decks: FlashcardDeckBrief[];
  progressMap: Record<string, { total: number; newCards: number; seen: number; reviewed: number }>;
  onStudyScope: (
    scope: { subject?: string; topic?: string; subtheme?: string },
  ) => void;
}) {
  // Agrupa: área (subject) → matéria (topic) → subtema (subtheme) → decks.
  const tree = useMemo(() => {
    const byArea = new Map<
      string,
      Map<string, Map<string, FlashcardDeckBrief[]>>
    >();
    for (const d of decks) {
      const area = d.subject;
      const topic = d.topic ?? 'Geral';
      const subtheme = d.subtheme ?? 'Geral';
      if (!byArea.has(area)) byArea.set(area, new Map());
      const byTopic = byArea.get(area)!;
      if (!byTopic.has(topic)) byTopic.set(topic, new Map());
      const bySub = byTopic.get(topic)!;
      if (!bySub.has(subtheme)) bySub.set(subtheme, []);
      bySub.get(subtheme)!.push(d);
    }
    return byArea;
  }, [decks]);

  const [openArea, setOpenArea] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<Set<string>>(new Set());
  const [openSub, setOpenSub] = useState<Set<string>>(new Set());

  // Accordion de área: só uma aberta por vez; ao trocar, reseta os sub-níveis.
  function selectArea(area: string) {
    setOpenArea((cur) => (cur === area ? null : area));
    setOpenTopic(new Set());
    setOpenSub(new Set());
  }

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  function totalCards(items: FlashcardDeckBrief[]): number {
    return items.reduce((s, d) => s + d._count.flashcards, 0);
  }

  // Agrega progresso de um conjunto de decks.
  function aggProgress(items: FlashcardDeckBrief[]) {
    return items.reduce(
      (acc, d) => {
        const p = progressMap[d.id] ?? { total: d._count.flashcards, newCards: d._count.flashcards, seen: 0, reviewed: 0 };
        acc.newCards += p.newCards;
        acc.seen += p.seen;
        acc.reviewed += p.reviewed;
        return acc;
      },
      { newCards: 0, seen: 0, reviewed: 0 },
    );
  }

  const totalCount = totalCards(decks);

  return (
    <div className="space-y-4">
      {/* Banner "Revisar tudo" */}
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand/12 to-brand/4 px-5 py-4 ring-1 ring-brand/20">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/15">
          <IconStack width={24} height={24} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-fg">Revisar tudo</p>
          <p className="text-xs text-muted">
            {decks.length} decks · {totalCount} cards · mistura todas as áreas com prioridade Pareto
          </p>
        </div>
        <button
          onClick={() => onStudyScope({})}
          className="btn btn-primary shrink-0"
        >
          Começar
        </button>
      </div>

      {/* Accordion vertical de áreas (uma aberta por vez) */}
      <div className="space-y-2.5">
        {[...tree.entries()].map(([area, subjects]) => {
          const areaDecks = [...subjects.values()]
            .flatMap((m) => [...m.values()].flat());
          const areaCards = totalCards(areaDecks);
          const ak = areaKey(area);
          const isAreaOpen = openArea === area;
          return (
            <div
              key={area}
              className={`card overflow-hidden ring-1 transition-all ${AREA_RING[ak]} ${isAreaOpen ? 'card-raised' : ''}`}
            >
              {/* Cabeçalho da área — colorido com emoji */}
              <button
                onClick={() => selectArea(area)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${AREA_BADGE[ak]}`}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface/60">
                  {(() => { const AreaIcon = AREA_ICON[ak]; return <AreaIcon width={24} height={24} weight="duotone" />; })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">
                    {area.replace(' e suas Tecnologias', '')}
                  </p>
                  <p className="text-xs opacity-80">
                    {areaDecks.length} decks
                  </p>
                  <ProgressHint progress={aggProgress(areaDecks)} />
                </div>
                <IconChevronDown
                  width={18}
                  height={18}
                  className={`shrink-0 opacity-60 transition-transform ${isAreaOpen ? '' : '-rotate-90'}`}
                />
              </button>

              {/* Subníveis (matéria → subtema → deck) */}
              {isAreaOpen && (
                <div className="border-t border-line bg-surface px-3 py-2.5">
                  <ul className="space-y-1">
                    {[...subjects.entries()].map(([topic, subthemes]) => {
                      const topicDecks = [...subthemes.values()].flat();
                      const topicCards = totalCards(topicDecks);
                      const tk = areaKey(topic);
                      const tKey = `${area}/${topic}`;
                      const isTopicOpen = openTopic.has(tKey);
                      return (
                        <li key={topic}>
                          {/* Nível 2 — Matéria */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenTopic((s) => toggle(s, tKey))}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenTopic((s) => toggle(s, tKey)); }}
                            className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-2"
                          >
                            <IconChevronDown
                              width={14}
                              height={14}
                              className={`shrink-0 text-muted transition-transform ${isTopicOpen ? '' : '-rotate-90'}`}
                            />
                            <span className={`size-2.5 shrink-0 rounded-full ${AREA_DOT[tk]}`} />
                            <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${AREA_TEXT[tk]}`}>
                              {topic}
                            </span>
                            <ProgressHint progress={aggProgress(topicDecks)} />
                            <HoverStudyButton
                              count={topicCards}
                              onStudy={() => onStudyScope({ subject: area, topic })}
                            />
                          </div>

                          {/* Nível 3 — Subtemas + Decks */}
                          {isTopicOpen && (
                            <ul className="ml-5 space-y-0.5 border-l border-dashed border-line pl-3">
                              {[...subthemes.entries()].map(([subtheme, dDecks]) => {
                                const subCards = totalCards(dDecks);
                                const subKey = `${area}/${topic}/${subtheme}`;
                                const isSubOpen = openSub.has(subKey);
                                const showSubHeader = subthemes.size > 1 || subtheme !== 'Geral';
                                return (
                                  <li key={subtheme} className="group">
                                    {showSubHeader && (
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setOpenSub((s) => toggle(s, subKey))}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenSub((s) => toggle(s, subKey)); }}
                                        className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
                                      >
                                        <IconChevronDown
                                          width={12}
                                          height={12}
                                          className={`shrink-0 text-muted transition-transform ${isSubOpen ? '' : '-rotate-90'}`}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                                          {subtheme}
                                        </span>
                                        <ProgressHint progress={aggProgress(dDecks)} />
                                        <HoverStudyButton
                                          count={subCards}
                                          onStudy={() => onStudyScope({ subject: area, topic, subtheme })}
                                        />
                                      </div>
                                    )}

                                    {/* Nível 4 — Decks individuais */}
                                    {(isSubOpen || !showSubHeader) && (
                                      <ul className={`${showSubHeader ? 'ml-4' : ''} space-y-0.5`}>
                                        {dDecks.map((d) => (
                                          <li key={d.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
                                            <span className={`size-1.5 shrink-0 rounded-full ${AREA_DOT[tk]}`} />
                                            <span className="min-w-0 flex-1 truncate text-sm text-fg">
                                              {d.title}
                                              {d.weight >= 4 && (
                                                <span className="ml-1.5 inline-flex items-center rounded bg-hum/12 px-1 py-0.5 text-[0.58rem] font-semibold text-hum align-middle">
                                                  P{d.weight}
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0 text-xs text-muted tabular-nums">
                                              {progressMap[d.id] ? `${progressMap[d.id].seen}/${d._count.flashcards}` : d._count.flashcards}
                                            </span>
                                            <HoverStudyButton
                                              count={d._count.flashcards}
                                              onStudy={() => onStudyScope({ subject: area, topic, subtheme })}
                                            />
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Rodapé da área: "Estudar toda a área" */}
                  <button
                    onClick={() => onStudyScope({ subject: area })}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
                  >
                    <span className={`size-2 rounded-full ${AREA_DOT[ak]}`} />
                    Estudar toda a área · {areaCards} cards
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MEUS DECKS — grid + modal de criação.
// =============================================================================
function CreateDeckModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState(SUBJECT_AREAS[0]);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createDeck({
        title: title.trim(),
        description: description.trim(),
        subject,
        isPublic,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o deck.');
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Novo deck"
    >
      <div
        className="card card-raised w-full max-w-md animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold">Novo deck</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <IconX width={18} height={18} />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="eyebrow mb-1.5 block">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fórmulas de Trigonometria"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Descrição (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que este deck cobre?"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Área</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {SUBJECT_AREAS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(' e suas Tecnologias', '')}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-sm">Deck público (visível para todos)</span>
          </label>
          {error && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
          )}
        </div>
        <footer className="border-t border-line px-5 py-4">
          <button
            onClick={() => void save()}
            disabled={saving || !title.trim()}
            className="btn btn-primary w-full"
          >
            {saving ? 'Criando…' : 'Criar deck'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// =============================================================================
// Tela principal
// =============================================================================
export default function Flashcards() {
  const [tab, setTab] = useState<Tab>('study');
  const [myDecks, setMyDecks] = useState<FlashcardDeckBrief[]>([]);
  const [publicDecks, setPublicDecks] = useState<FlashcardDeckBrief[]>([]);
  const [queue, setQueue] = useState<FlashcardItem[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [forecast, setForecast] = useState<FlashcardForecastDay[]>([]);
  const [deckProgress, setDeckProgress] = useState<Record<string, { total: number; newCards: number; seen: number; reviewed: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, pub, studyQueue, st, fc, dp] = await Promise.all([
        api.flashcardDecksMine(),
        api.flashcardDecksPublic(),
        api.studyQueue(),
        api.flashcardStats(),
        api.flashcardForecast(7),
        api.flashcardDeckProgress(),
      ]);
      setMyDecks(mine);
      setPublicDecks(pub);
      setQueue(studyQueue);
      setQueueIdx(0);
      setDone(studyQueue.length === 0);
      setDoneCount(0);
      setStats(st);
      setForecast(fc);
      setDeckProgress(dp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onGraded(next: number) {
    setDoneCount((c) => c + 1);
    if (next >= queue.length) {
      setDone(true);
    } else {
      setQueueIdx(next);
    }
  }

  // Iniciar estudo de um escopo da árvore (área/matéria/subtema): busca a fila
  // filtrada no backend e abre a aba Estudar já posicionada no primeiro card.
  async function studyScope(scope: {
    subject?: string;
    topic?: string;
    subtheme?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const scoped = await api.studyQueue(scope);
      setQueue(scoped);
      setQueueIdx(0);
      setDone(scoped.length === 0);
      setDoneCount(0);
      setTab('study');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }

  // Sessão ativa: modo foco (sem header/tabs; card é o protagonista).
  const studying = !loading && tab === 'study' && !done && queue.length > 0;

  // Encerrar a sessão manualmente: mostra o resumo se já estudou algo.
  function exitStudy() {
    if (doneCount > 0) setDone(true);
    else setTab('tree');
  }

  if (studying) {
    return (
      <div className="pb-28 md:pb-24">
        {error && (
          <p className="mb-3 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
        )}
        <StudyFocus
          queue={queue}
          currentIdx={queueIdx}
          onGraded={onGraded}
          onExit={exitStudy}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 md:pb-24">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Revisão ativa</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Flashcards
          </h1>
          <p className="mt-1 text-sm text-muted">
            Repetição espaçada com prioridade Pareto — vencidos primeiro, depois novos por peso.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn btn-ghost shrink-0">
          <IconPlus width={18} height={18} />
          Novo deck
        </button>
      </header>

      {/* Tabs */}
      <div className="seg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : (
        <>
          {tab === 'study' &&
            (done ? (
              <>
                {doneCount > 0 ? (
                  /* Sessão concluída — resumo */
                  <div className="card p-5 text-center animate-rise">
                    <p className="font-display text-2xl font-bold text-nat">{doneCount}</p>
                    <p className="text-sm text-muted">
                      {doneCount === 1 ? 'card estudado' : 'cards estudados'} nesta sessão
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Cada card foi reagendado: hoje, amanhã, em 3 ou em 7 dias, conforme sua avaliação.
                    </p>
                  </div>
                ) : (
                  /* Fila vazia — nada para revisar agora */
                  <EmptyState
                    icon={IconCheck}
                    title="Tudo em dia!"
                    description="Nenhum card vencido ou novo neste escopo agora. As próximas revisões chegam conforme o agendamento (hoje, 1, 3 ou 7 dias)."
                    action={{ label: 'Explorar decks prontos', onClick: () => setTab('tree') }}
                    tip="Explore outros escopos na aba Decks Prontos"
                  />
                )}
                <StatsBar stats={stats} forecast={forecast} />
              </>
            ) : null /* sessão ativa é renderizada pelo modo foco acima */)}

          {tab === 'tree' && (
            <>
              <p className="text-sm text-muted">
                {publicDecks.length} decks ·{' '}
                {publicDecks.reduce((s, d) => s + d._count.flashcards, 0)} cards
              </p>
              {publicDecks.length === 0 ? (
                <EmptyState
                  icon={IconStack}
                  title="Nenhum deck público ainda"
                  description="Seja o primeiro a criar um deck e compartilhar com a comunidade."
                  tip="Estrutura simples: pergunta na frente, resposta no verso"
                />
              ) : (
                <DeckTree
                  decks={publicDecks}
                  progressMap={deckProgress}
                  onStudyScope={(scope) => { void studyScope(scope); }}
                />
              )}
            </>
          )}

          {tab === 'mine' && (
            <>
              <p className="text-sm text-muted">
                {myDecks.length} {myDecks.length === 1 ? 'deck' : 'decks'} seus
              </p>
              {myDecks.length === 0 ? (
                <EmptyState
                  icon={IconStack}
                  title="Nenhum deck ainda"
                  description="Crie decks personalizados por matéria ou tema."
                  tip="Comece com os decks prontos da aba ao lado"
                />
              ) : (
                <DeckTree
                  decks={myDecks}
                  progressMap={deckProgress}
                  onStudyScope={(scope) => { void studyScope(scope); }}
                />
              )}
            </>
          )}
        </>
      )}

      {createOpen && (
        <CreateDeckModal onClose={() => setCreateOpen(false)} onCreated={load} />
      )}
    </div>
  );
}
