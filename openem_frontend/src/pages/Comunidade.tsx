import { useEffect, useState } from 'react';
import {
  api,
  type ForumThread,
  type ForumThreadSummary,
} from '../api';
import { IconChat } from '../components/icons';

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

/** Detalhe de um tópico: enunciado, respostas e caixa de resposta. */
function ThreadView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setThread(await api.forumThread(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      setThread(await api.replyThread(id, reply.trim()));
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <p className="card p-6 text-center text-sm text-muted">Carregando…</p>;
  }
  if (!thread) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="btn btn-ghost">
          Voltar
        </button>
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">
          {error ?? 'Tópico não encontrado.'}
        </p>
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
          {thread.author.name} · {timeAgo(thread.createdAt)}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {thread.body}
        </p>
      </article>

      <h2 className="font-display text-sm font-bold text-muted">
        {thread.posts.length}{' '}
        {thread.posts.length === 1 ? 'resposta' : 'respostas'}
      </h2>

      <ul className="space-y-3">
        {thread.posts.map((p) => (
          <li key={p.id} className="card p-4">
            <p className="text-xs font-semibold">
              {p.author.name}{' '}
              <span className="font-normal text-muted">
                · {timeAgo(p.createdAt)}
              </span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {p.body}
            </p>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red">{error}</p>}

      <div className="card p-4">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder="Escreva uma resposta…"
          className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
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
      <header>
        <h1 className="font-display text-xl font-extrabold tracking-tight">
          Novo tópico
        </h1>
      </header>
      <div className="card space-y-3 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="Título (ex.: Dúvida sobre função quadrática)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Descreva sua dúvida ou comentário…"
          className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {error && <p className="text-sm text-red">{error}</p>}
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
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Comunidade</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Fórum de dúvidas
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tire dúvidas e ajude outros estudantes.
          </p>
        </div>
        <button onClick={() => setView('new')} className="btn btn-primary shrink-0">
          Novo tópico
        </button>
      </header>

      {error && (
        <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
      )}

      {loading ? (
        <p className="card p-6 text-center text-sm text-muted">Carregando…</p>
      ) : threads.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          Ainda não há tópicos. Seja o primeiro a perguntar!
        </div>
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
                    {t.author.name} · {timeAgo(t.createdAt)} · {t.replies}{' '}
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
