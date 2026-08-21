import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type FlashcardDeckBrief, type FlashcardItem } from '../api';
import { EmptyState } from '../components/EmptyState';
import { Markdown } from '../components/Markdown';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconPlus,
  IconStack,
  IconThumbsUp,
  IconX,
} from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import {
  areaKey,
  shortArea,
  AREA_DOT,
  AREA_TEXT,
  AREA_BADGE,
} from '../lib/areas';

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
  const area = areaKey(card.deckTopic ?? card.deckTitle);

  useEffect(() => {
    setFlipped(false);
  }, [card.flashcardId]);

  async function grade(q: number) {
    setSaving(true);
    try {
      await api.reviewFlashcard(card.flashcardId, q);
    } finally {
      setSaving(false);
      onGraded(q);
    }
  }

  const pct = total > 0 ? Math.round((index / total) * 100) : 0;

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
          <span className="text-base">{card.deckIcon}</span>
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
          ) : (
            <span className="chip text-muted">hoje</span>
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
            {GRADES.map((g) => (
              <button
                key={g.quality}
                onClick={() => void grade(g.quality)}
                disabled={saving}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${g.cls}`}
              >
                {saving ? '…' : g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CAMINHO — fila de estudo organizada por peso Pareto e vencimento SM-2.
// =============================================================================
function StudyPath({
  queue,
  currentIdx,
  onGraded,
}: {
  queue: FlashcardItem[];
  currentIdx: number;
  onGraded: (idx: number) => void;
}) {
  // Agrupa a fila por matéria (topic) para mostrar o caminho.
  const groups = useMemo(() => {
    const map = new Map<string, FlashcardItem[]>();
    for (const c of queue) {
      const key = c.deckTopic ?? 'Geral';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()];
  }, [queue]);

  const current = queue[currentIdx];
  const doneCount = currentIdx;

  return (
    <div className="space-y-5">
      {/* Trilho de matérias */}
      <div className="flex flex-wrap items-center gap-1.5">
        {groups.map(([topic, cards], gi) => {
          const done = cards.every(
            (c) => queue.indexOf(c) < currentIdx,
          );
          const groupStart = queue.indexOf(cards[0]);
          const inProgress = !done && groupStart <= currentIdx;
          const area = areaKey(topic);
          return (
            <div key={topic} className="flex items-center gap-1.5">
              {gi > 0 && (
                <IconChevronRight width={14} height={14} className="text-muted" />
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  done
                    ? `${AREA_BADGE[area]} opacity-60`
                    : inProgress
                      ? `${AREA_BADGE[area]} ring-1 ring-current`
                      : 'bg-surface-2 text-muted'
                }`}
              >
                {done ? (
                  <IconCheck width={12} height={12} />
                ) : (
                  <span className={`size-1.5 rounded-full ${AREA_DOT[area]}`} />
                )}
                {topic.replace(' e suas Tecnologias', '')}
                <span className="opacity-75">
                  {Math.min(
                    cards.length,
                    Math.max(0, doneCount - groupStart),
                  )}
                  /{cards.length}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Card atual */}
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
// ÁRVORE — decks agrupados por área → matéria → subtema (colorido + recolhível).
// =============================================================================
function DeckLeaf({
  deck,
  onStudy,
  onVote,
}: {
  deck: FlashcardDeckBrief;
  onStudy: () => void;
  onVote: (vote: 'up' | 'down') => void;
}) {
  const area = areaKey(deck.topic ?? deck.subject);
  return (
    <li>
      <div className="card card-raised overflow-hidden transition-transform hover:-translate-y-0.5">
        <div className="flex items-center gap-3 p-4">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-xl text-2xl ${AREA_BADGE[area]}`}
          >
            {deck.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-sm font-bold">
              {deck.title}
            </h4>
            <p className="mt-0.5 text-xs text-muted">
              {deck._count.flashcards}{' '}
              {deck._count.flashcards === 1 ? 'card' : 'cards'}
              {deck.weight >= 4 && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-hum/12 px-1 py-0.5 text-[0.62rem] font-semibold text-hum align-middle">
                  Peso {deck.weight}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onStudy}
            className="btn btn-primary shrink-0 text-xs"
          >
            Estudar
          </button>
        </div>
        <footer className="flex items-center gap-1 border-t border-line px-3 py-2">
          <button
            onClick={() => onVote('up')}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-nat/10 hover:text-nat"
          >
            <IconThumbsUp width={14} height={14} />
            {deck.upvotes}
          </button>
        </footer>
      </div>
    </li>
  );
}

function DeckTree({
  decks,
  onStudy,
  onVote,
}: {
  decks: FlashcardDeckBrief[];
  onStudy: (deckId: string) => void;
  onVote: (deckId: string, vote: 'up' | 'down') => void;
}) {
  // Agrupa: área (subject) → matéria (topic) → subtema (subtheme) → decks.
  const tree = useMemo(() => {
    const byArea = new Map<string, Map<string, Map<string, FlashcardDeckBrief[]>>>();
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
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {[...tree.entries()].map(([area, subjects]) => {
        const areaCards = [...subjects.values()]
          .flatMap((m) => [...m.values()].flat())
          .reduce((s, d) => s + d._count.flashcards, 0);
        const ak = areaKey(area);
        const isOpen = openArea === area;
        return (
          <div key={area} className="overflow-hidden rounded-xl border border-line">
            {/* Cabeçalho da área */}
            <button
              onClick={() => setOpenArea(isOpen ? null : area)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${AREA_BADGE[ak]}`}
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg`}>
                <IconChevronDown
                  width={18}
                  height={18}
                  className={isOpen ? '' : '-rotate-90 transition-transform'}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold">{area.replace(' e suas Tecnologias', '')}</p>
                <p className="text-xs text-muted">
                  {[...subjects.values()].flatMap((m) => [...m.values()].flat()).length}{' '}
                  decks · {areaCards} cards
                </p>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line bg-surface-2/40 px-3 py-3">
                {[...subjects.entries()].map(([topic, subthemes]) => {
                  const topicCards = [...subthemes.values()]
                    .flat()
                    .reduce((s, d) => s + d._count.flashcards, 0);
                  const tk = areaKey(topic);
                  const isTopicOpen = openTopic === `${area}/${topic}`;
                  return (
                    <div key={topic} className="ml-8 mb-2">
                      <button
                        onClick={() => setOpenTopic(isTopicOpen ? null : `${area}/${topic}`)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                      >
                        <span className={`size-2 rounded-full ${AREA_DOT[tk]}`} />
                        <span className={`flex-1 truncate font-semibold ${AREA_TEXT[tk]}`}>
                          {topic}
                        </span>
                        <span className="text-xs text-muted">{topicCards} cards</span>
                        <IconChevronDown
                          width={16}
                          height={16}
                          className={`text-muted transition-transform ${isTopicOpen ? '' : '-rotate-90'}`}
                        />
                      </button>

                      {isTopicOpen && (
                        <div className="ml-4 mt-1.5 space-y-1.5">
                          {[...subthemes.entries()].map(([subtheme, dDecks]) => (
                            <div key={subtheme}>
                              {subthemes.size > 1 && (
                                <p className="px-2 py-1 text-xs font-semibold text-muted">
                                  {subtheme}
                                </p>
                              )}
                              <ul className="ml-3 grid gap-2 sm:grid-cols-2">
                                {dDecks.map((d) => (
                                  <DeckLeaf
                                    key={d.id}
                                    deck={d}
                                    onStudy={() => onStudy(d.id)}
                                    onVote={(v) => onVote(d.id, v)}
                                  />
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, pub, studyQueue] = await Promise.all([
        api.flashcardDecksMine(),
        api.flashcardDecksPublic(),
        api.studyQueue(30),
      ]);
      setMyDecks(mine);
      setPublicDecks(pub);
      setQueue(studyQueue);
      setQueueIdx(0);
      setDone(studyQueue.length === 0);
      setDoneCount(0);
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

  // Iniciar estudo direto de um deck: filtra a fila para começar por seus cards.
  function studyDeck(deck: FlashcardDeckBrief) {
    const deckCards = queue.filter((c) => c.deckTitle === deck.title);
    if (deckCards.length > 0) {
      // Reordena: cards do deck clicado primeiro, depois o resto.
      const reordered = [...deckCards, ...queue.filter((c) => c.deckTitle !== deck.title)];
      setQueue(reordered);
      setQueueIdx(0);
      setDone(false);
      setDoneCount(0);
    }
    setTab('study');
  }

  const overdueCount = queue.filter((c) => c.overdue).length;

  return (
    <div className="space-y-5 pb-28 md:pb-24">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Revisão ativa</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Flashcards
          </h1>
          <p className="mt-1 text-sm text-muted">
            Repetição espaçada com prioridade Pareto — mais atrasados primeiro.
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
              <EmptyState
                icon={IconCheck}
                title={doneCount > 0 ? 'Sessão concluída! 🎉' : 'Tudo em dia! 🎉'}
                description={
                  doneCount > 0
                    ? `Você estudou ${doneCount} ${doneCount === 1 ? 'card' : 'cards'}. O SM-2 reagendou os próximos.`
                    : 'Nenhum card vencido agora. Explore os decks prontos!'
                }
                tip="Flashcards com SM-2 fixam o conteúdo no longo prazo"
              />
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="chip">
                    {queue.length} cards na sessão
                  </span>
                  {overdueCount > 0 && (
                    <span className="chip text-red">{overdueCount} atrasados</span>
                  )}
                </div>
                <StudyPath
                  queue={queue}
                  currentIdx={queueIdx}
                  onGraded={onGraded}
                />
              </>
            ))}

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
                  onStudy={(deckId) => {
                    const deck = publicDecks.find((d) => d.id === deckId);
                    if (deck) studyDeck(deck);
                  }}
                  onVote={(deckId, v) => {
                    void api.voteDeck(deckId, v).then(load);
                  }}
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
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myDecks.map((d) => (
                    <DeckLeaf
                      key={d.id}
                      deck={d}
                      onStudy={() => studyDeck(d)}
                      onVote={() => {}}
                    />
                  ))}
                </ul>
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
