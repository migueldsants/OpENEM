import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type ForumPost,
  type ForumThreadSummary,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';
import { IconChat, IconHeart, IconQuestion } from '../components/icons';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import {
  mapPost,
  openThread,
  type ThreadState,
  withPage,
  withReply,
} from '../lib/forum-thread';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

/** Renderiza o corpo de um post, convertendo menções @usuarioId em links. */
function renderBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9_-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      const id = part.slice(1);
      return (
        <Link
          key={i}
          to={`/usuarios/${id}`}
          className="font-medium text-brand hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Detalhe de um tópico: enunciado, respostas e caixa de resposta. */
function ThreadView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [thread, setThread] = useState<ThreadState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setThread(openThread(await api.forumThread(id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function loadMore() {
    const cursor = thread?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await api.forumPosts(id, cursor);
      setThread((prev) => (prev ? withPage(prev, page) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const post = await api.replyThread(id, reply.trim());
      setThread((prev) => (prev ? withReply(prev, post) : prev));
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (toggling) return;
    setToggling(postId);
    // Otimista: atualiza UI imediatamente.
    setThread((prev) =>
      prev
        ? mapPost(prev, postId, (p) => ({
            ...p,
            liked: !liked,
            likes: Math.max(0, p.likes + (liked ? -1 : 1)),
          }))
        : prev,
    );
    try {
      await api.togglePostLike(id, postId);
    } catch (err) {
      // Reverte em caso de erro.
      setThread((prev) =>
        prev
          ? mapPost(prev, postId, (p) => ({
              ...p,
              liked,
              likes: Math.max(0, p.likes + (liked ? 1 : -1)),
            }))
          : prev,
      );
      setError(err instanceof Error ? err.message : 'Não foi possível curtir.');
    } finally {
      setToggling(null);
    }
  }

  function renderPost(p: ForumPost) {
    return (
      <li key={p.id} className="card p-4">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs font-semibold">
            <Link
              to={`/usuarios/${p.author.id}`}
              className="font-medium text-brand hover:underline"
            >
              {p.author.name}
            </Link>{' '}
            <span className="font-normal text-muted">
              · {timeAgo(p.createdAt)}
            </span>
          </p>
          <button
            onClick={() => void toggleLike(p.id, p.liked)}
            disabled={toggling === p.id}
            aria-pressed={p.liked}
            aria-label={p.liked ? 'Descurtir' : 'Curtir'}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              p.liked
                ? 'bg-danger/12 text-danger'
                : 'bg-surface-2 text-muted hover:text-fg'
            }`}
          >
            <IconHeart width={16} height={16} filled={p.liked} />
            {p.likes}
          </button>
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
          {renderBody(p.body)}
        </p>
      </li>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-24" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </div>
    );
  }
  if (!thread) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="btn btn-ghost">
          Voltar
        </button>
        <ErrorBanner message={error ?? 'Tópico não encontrado.'} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn btn-ghost">
        Voltar
      </button>

      <article className="card card-raised p-5">
        <h1 className="font-display text-xl font-extrabold tracking-tight">
          {thread.title}
        </h1>
        <p className="mt-1 text-xs text-muted">
          <Link
            to={`/usuarios/${thread.author.id}`}
            className="font-medium text-brand hover:underline"
          >
            {thread.author.name}
          </Link>{' '}
          · {timeAgo(thread.createdAt)}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {renderBody(thread.body)}
        </p>
      </article>

      <h2 className="font-display text-sm font-bold text-muted">
        {thread.replies} {thread.replies === 1 ? 'resposta' : 'respostas'}
      </h2>

      <ul className="space-y-3">
        {thread.posts.length === 0 && thread.sent.length === 0 && (
          <li>
            <EmptyState
              icon={IconChat}
              title="Sem respostas ainda"
              description="Quebre o gelo e seja a primeira pessoa a responder."
              dense
            />
          </li>
        )}
        {thread.posts.map(renderPost)}
        {thread.nextCursor && (
          <li className="flex justify-center">
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="btn btn-ghost"
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais respostas'}
            </button>
          </li>
        )}
        {thread.sent.map(renderPost)}
      </ul>

      <ErrorBanner message={error} />

      <div className="card p-4">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          aria-label="Sua resposta"
          placeholder="Escreva uma resposta… (use @ para mencionar alguém)"
          className="input resize-y"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => void send()}
            disabled={!reply.trim() || sending}
            className="btn btn-primary"
          >
            {sending ? 'Enviando…' : 'Responder'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Formulário de novo tópico. */
function NewThread({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (title.trim().length < 3 || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.createThread(title.trim(), body.trim());
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar.');
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="btn btn-ghost">
        Voltar
      </button>
      <PageHeader eyebrow="Comunidade" title="Novo tópico" />
      <div className="card space-y-4 p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Ex.: Dúvida sobre função quadrática"
            className="input"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Sua dúvida</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Descreva o que você não entendeu ou quer discutir…"
            className="input resize-y"
          />
        </label>
        <ErrorBanner message={error} />
        <div className="flex justify-end">
          <button
            onClick={() => void submit()}
            disabled={title.trim().length < 3 || !body.trim() || sending}
            className="btn btn-primary"
          >
            {sending ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

type View = 'list' | 'new' | { id: string };

export default function Comunidade() {
  const [view, setView] = useState<View>('list');
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setThreads(await api.forumThreads());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (view === 'new') {
    return (
      <NewThread
        onCreated={() => {
          setView('list');
          void load();
        }}
        onCancel={() => setView('list')}
      />
    );
  }
  if (typeof view === 'object') {
    return <ThreadView id={view.id} onBack={() => setView('list')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fórum de dúvidas"
        title="Comunidade"
        subtitle="Tire dúvidas e ajude outros estudantes."
        actions={
          <button onClick={() => setView('new')} className="btn btn-primary">
            Novo tópico
          </button>
        }
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
      ) : threads.length === 0 ? (
        <EmptyState
          icon={IconQuestion}
          title="Nenhum tópico ainda"
          description="Seja o primeiro a perguntar e ajudar outros estudantes."
          action={{ onClick: () => setView('new'), label: 'Criar tópico' }}
          tip="Dúvidas, dicas e resumos: a comunidade responde"
        />
      ) : (
        <ul className="space-y-3">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setView({ id: t.id })}
                className="card card-raised flex w-full items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
                  <IconChat width={20} height={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {t.title}
                  </span>
                  <span className="text-xs text-muted">
                    <Link
                      to={`/usuarios/${t.author.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {t.author.name}
                    </Link>{' '}
                    · {timeAgo(t.createdAt)} · {t.replies}{' '}
                    {t.replies === 1 ? 'resposta' : 'respostas'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
