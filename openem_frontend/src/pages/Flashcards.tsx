import { useCallback, useEffect, useState } from 'react';
import { api, type FlashcardDeckBrief, type FlashcardItem } from '../api';
import { EmptyState } from '../components/EmptyState';
import { IconCheck, IconChevronLeft, IconPlus, IconStack, IconThumbsUp } from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';

const SUBJECT_AREAS = [
  'Matemática e suas Tecnologias',
  'Ciências da Natureza e suas Tecnologias',
  'Ciências Humanas e suas Tecnologias',
  'Linguagens, Códigos e suas Tecnologias',
  'Redação',
];

const GRADES = [
  { label: 'Esqueci', quality: 1, cls: 'text-red border-red/30 hover:bg-red/10' },
  { label: 'Difícil', quality: 3, cls: 'text-hum border-hum/30 hover:bg-hum/10' },
  { label: 'Bom', quality: 4, cls: 'text-brand border-brand/30 hover:bg-brand/10' },
  { label: 'Fácil', quality: 5, cls: 'text-nat border-nat/30 hover:bg-nat/10' },
];

// ---- Componente: Card de estudo (frente → verso → nota) ----
function StudyCard({ card, onGraded }: {
  card: FlashcardItem;
  onGraded: (quality: number) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  async function grade(q: number) {
    setSaving(true);
    try {
      await api.reviewFlashcard(card.flashcardId, q);
    } finally {
      setSaving(false);
      setFlipped(false);
      onGraded(q);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card card-raised overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="text-lg">{card.deckIcon}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{card.deckTitle}</span>
          {card.overdue && <span className="chip text-red">atrasado</span>}
          {!card.overdue && <span className="chip text-muted">estuda hoje</span>}
        </div>

        <div className="p-4 sm:p-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg sm:text-base">
            {card.front}
          </p>

          {flipped ? (
            <>
              <div className="my-3 h-px bg-line" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {card.back}
              </p>
            </>
          ) : (
            <button
              onClick={() => setFlipped(true)}
              className="btn btn-primary mt-4 w-full"
            >
              Virar card ▸
            </button>
          )}
        </div>
      </div>

      {flipped && (
        <div className="card p-4">
          <p className="eyebrow mb-1.5">Como foi sua lembrança?</p>
          <p className="text-xs text-muted mb-3">Avalie honestamente — isso ajusta quando este card volta.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g.quality}
                onClick={() => void grade(g.quality)}
                disabled={saving}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${g.cls}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Componente: Grid de decks ----
function DeckCard({ deck, onStudy, onVote }: {
  deck: FlashcardDeckBrief;
  onStudy: () => void;
  onVote: (vote: 'up' | 'down') => void;
}) {
  return (
    <li className="card card-raised overflow-hidden">
      <button onClick={onStudy} className="block w-full p-4 text-left transition-colors hover:bg-surface-2/50">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-2xl">
            {deck.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display font-bold">{deck.title}</h3>
            <p className="mt-0.5 truncate text-xs text-muted">{deck.subject.replace(' e suas Tecnologias', '')}</p>
            <p className="mt-0.5 text-xs text-muted">{deck._count.flashcards} cards</p>
          </div>
        </div>
      </button>
      <footer className="flex items-center gap-1 border-t border-line px-3 py-2">
        <button
          onClick={() => onVote('up')}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-nat/10 hover:text-nat"
        >
          <IconThumbsUp width={14} height={14} />
          {deck.upvotes}
        </button>
      </footer>
    </li>
  );
}

// ---- Modal: Criar deck ----
function CreateDeckModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Novo deck"
    >
      <div className="card card-raised w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="eyebrow">Novo deck</p>
          <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <IconChevronLeft width={18} height={18} />
          </button>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="eyebrow mb-1.5 block">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Fórmulas de Trigonometria" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Descrição (opcional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que este deck cobre?" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Área</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand">
              {SUBJECT_AREAS.map((s) => (
                <option key={s} value={s}>{s.replace(' e suas Tecnologias', '')}</option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            <span className="text-sm">Deck público (visível para todos)</span>
          </label>
          {error && <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>}
        </div>
        <footer className="border-t border-line px-5 py-4">
          <button onClick={() => void save()} disabled={saving || !title.trim()} className="btn btn-primary w-full">
            {saving ? 'Criando…' : 'Criar deck'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---- Tela principal ----
type Tab = 'mine' | 'public' | 'study';

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
      const [mine, pub, queue] = await Promise.all([
        api.flashcardDecksMine(),
        api.flashcardDecksPublic(),
        api.studyQueue(20),
      ]);
      setMyDecks(mine);
      setPublicDecks(pub);
      setQueue(queue);
      setQueueIdx(0);
      setDone(queue.length === 0);
      setDoneCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function onGraded() {
    const next = queueIdx + 1;
    setDoneCount((c) => c + 1);
    if (next >= queue.length) {
      setDone(true);
    } else {
      setQueueIdx(next);
    }
  }

  const remaining = queue.length - queueIdx;

  return (
    <div className="space-y-5 pb-28 md:pb-24">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Revisão ativa</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Flashcards</h1>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn btn-ghost shrink-0">
          <IconPlus width={18} height={18} />
          Novo deck
        </button>
      </header>

      {/* Tabs */}
      <div className="seg w-fit">
        {(['study', 'public', 'mine'] as const).map((t) => (
          <button key={t} data-active={tab === t} onClick={() => setTab(t)}>
            {t === 'study' ? 'Estudo Otimizado' : t === 'public' ? 'Decks Prontos' : 'Meus Decks'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={3} /><SkeletonCard lines={3} /><SkeletonCard lines={3} />
        </div>
      ) : (
        <>
          {tab === 'study' && (
            done ? (
              <EmptyState
                icon={IconCheck}
                title={doneCount > 0 ? 'Sessão concluída! 🎉' : 'Tudo em dia! 🎉'}
                description={doneCount > 0
                  ? `Você estudou ${doneCount} cards. O SM-2 reagendou os próximos.`
                  : 'Nenhum card vencido agora. Crie um deck ou explore os prontos!'}
                tip="Flashcards com SM-2 fixam o conteúdo no longo prazo"
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{queue[queueIdx]?.front.substring(0, 60)}…</p>
                    <p className="text-xs text-muted">{remaining} restantes na sessão</p>
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums">{queueIdx + 1}<span className="text-sm text-muted">/{queue.length}</span></p>
                </div>
                <StudyCard
                  card={queue[queueIdx]}
                  onGraded={onGraded}
                />
              </div>
            )
          )}

          {tab === 'public' && (
            <div className="space-y-4">
              {publicDecks.length === 0 ? (
                <EmptyState
                  icon={IconStack}
                  title="Nenhum deck público ainda"
                  description="Seja o primeiro a criar um deck e compartilhar com a comunidade."
                  tip="De com uma estrutura simples: pergunta na frente, resposta no verso"
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicDecks.map((d) => (
                    <DeckCard
                      key={d.id}
                      deck={d}
                      onStudy={() => { setTab('study'); void load(); }}
                      onVote={(v) => { void api.voteDeck(d.id, v).then(load); }}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'mine' && (
            <div className="space-y-4">
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
                    <DeckCard
                      key={d.id}
                      deck={d}
                      onStudy={() => { setTab('study'); void load(); }}
                      onVote={() => { /* decks próprios não votam */ }}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {createOpen && <CreateDeckModal onClose={() => setCreateOpen(false)} onCreated={load} />}
    </div>
  );
}
