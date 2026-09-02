import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type Subject,
  type Video,
  type VideoNote,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  IconCheck,
  IconPlay,
  IconTrash,
  IconX,
} from '../components/icons';
import { SkeletonCard } from '../components/Skeleton';
import { areaKey, AREA_TEXT } from '../lib/areas';

function fmtTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Player + notas com timestamp clicável (issue #37). */
function VideoDetail({
  video,
  onClose,
  onChange,
}: {
  video: Video;
  onClose: () => void;
  onChange: (v: Video) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [noteTs, setNoteTs] = useState('');
  const [seekTo, setSeekTo] = useState<number | null>(null);

  async function addNote() {
    if (!noteText.trim()) return;
    // Formatos aceitos: "90" (segundos) ou "1:30" (mm:ss).
    const parts = noteTs.split(':').map((p) => Number(p) || 0);
    const ts =
      parts.length > 1
        ? parts[0] * 60 + parts[1]
        : Number(noteTs.replace(',', '.').split('.')[0] ?? 0) || 0;
    if (Number.isNaN(ts) || ts < 0) return;
    const note = await api.addVideoNote(video.id, ts, noteText.trim());
    onChange({ ...video, notes: [...video.notes, note].sort((a, b) => a.timestampSec - b.timestampSec) });
    setNoteText('');
    setNoteTs('');
  }

  async function removeNote(note: VideoNote) {
    onChange({
      ...video,
      notes: video.notes.filter((n) => n.id !== note.id),
    });
    try {
      await api.deleteVideoNote(note.id);
    } catch {
      onChange({ ...video, notes: [...video.notes, note] }); // rollback
    }
  }

  async function toggleWatched() {
    const updated = await api.toggleVideoWatched(video.id);
    onChange(updated);
  }

  async function exportMd() {
    const blob = new Blob([buildMarkdown(video)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title.slice(0, 60)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-snug">
            {video.title}
          </h2>
          {video.subjectName && (
            <p className={`text-xs ${AREA_TEXT[areaKey(video.subjectName)]}`}>
              {video.subjectName.replace(' e suas Tecnologias', '')}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="Fechar vídeo" className="btn btn-ghost shrink-0">
          <IconX width={16} height={16} />
        </button>
      </div>

      {/* Player embed — ?start= pula para o timestamp da nota clicada. */}
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
        <iframe
          key={seekTo ?? 'start'}
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}${seekTo ? `?start=${seekTo}` : ''}&autoplay=${seekTo ? 1 : 0}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void toggleWatched()} className="btn btn-ghost">
          <IconCheck
            width={14}
            height={14}
            filled={video.watched}
            className={video.watched ? 'text-nat' : ''}
          />
          {video.watched ? 'Assistido' : 'Marcar assistido'}
        </button>
        {video.notes.length > 0 && (
          <button onClick={() => void exportMd()} className="btn btn-ghost">
            Exportar notas (.md)
          </button>
        )}
      </div>

      {/* Notas */}
      <section className="card p-4">
        <h3 className="font-display text-sm font-bold">
          Notas ({video.notes.length})
        </h3>
        <ul className="mt-2 space-y-1.5">
          {video.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <button
                onClick={() => setSeekTo(n.timestampSec)}
                className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-data text-[11px] font-bold tabular-nums text-brand hover:bg-brand/10"
                title={`Pular o vídeo para ${fmtTimestamp(n.timestampSec)}`}
              >
                {fmtTimestamp(n.timestampSec)}
              </button>
              <span className="min-w-0 flex-1 text-sm">{n.content}</span>
              <button
                onClick={() => void removeNote(n)}
                aria-label={`Remover nota ${fmtTimestamp(n.timestampSec)}`}
                className="shrink-0 text-muted transition-colors hover:text-red"
              >
                <IconTrash width={13} height={13} />
              </button>
            </li>
          ))}
          {video.notes.length === 0 && (
            <li className="text-sm text-muted">
              Nenhuma nota — marque instantes importantes durante o vídeo.
            </li>
          )}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <input
            value={noteTs}
            onChange={(e) => setNoteTs(e.target.value)}
            placeholder="1:30"
            aria-label="Instante da nota"
            className="input w-20 shrink-0 text-center font-data tabular-nums"
          />
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addNote()}
            placeholder="Anotação neste instante…"
            aria-label="Conteúdo da nota"
            className="input min-w-0 flex-1"
          />
          <button
            onClick={() => void addNote()}
            disabled={!noteText.trim()}
            className="btn btn-primary shrink-0"
          >
            Anotar
          </button>
        </div>
      </section>
    </div>
  );
}

function buildMarkdown(video: Video): string {
  const lines = [
    `# ${video.title}`,
    '',
    `Link: https://www.youtube.com/watch?v=${video.youtubeId}`,
    '',
    ...video.notes.map(
      (n) =>
        `- [${fmtTimestamp(n.timestampSec)}](https://www.youtube.com/watch?v=${video.youtubeId}&t=${n.timestampSec}s) — ${n.content}`,
    ),
  ];
  return lines.join('\n');
}

/** Biblioteca de vídeos de estudo (issue #37). */
export default function Videos() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVideos(await api.videos(subjectId || undefined));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar seus vídeos.',
      );
      setVideos([]);
    }
  }, [subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api
      .subjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  async function add() {
    if (!url.trim()) return;
    setError(null);
    try {
      const created = await api.addVideo(url.trim(), subjectId || undefined);
      setVideos((cur) => [created, ...(cur ?? [])]);
      setUrl('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar o vídeo.',
      );
    }
  }

  async function toggleWatched(v: Video) {
    try {
      const updated = await api.toggleVideoWatched(v.id);
      setVideos((cur) =>
        cur?.map((x) => (x.id === v.id ? updated : x)) ?? cur,
      );
      if (selected?.id === v.id) setSelected(updated);
    } catch {
      /* silencioso */
    }
  }

  async function remove(v: Video) {
    setVideos((cur) => cur?.filter((x) => x.id !== v.id) ?? cur);
    if (selected?.id === v.id) setSelected(null);
    try {
      await api.deleteVideo(v.id);
    } catch {
      void load();
    }
  }

  const bySubject = useMemo(() => {
    const map = new Map<string, Video[]>();
    for (const v of videos ?? []) {
      const key = v.subjectName ?? 'Sem matéria';
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [videos]);

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Videoteca</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Vídeos
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cole links de aulas do YouTube, organize por matéria e anote
          instantes importantes.
        </p>
      </header>

      <ErrorBanner message={error} />

      {/* Input de novo vídeo */}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder="Cole o link do YouTube…"
          aria-label="Link do YouTube"
          className="input min-w-0 flex-1"
        />
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          aria-label="Matéria do vídeo"
          className="input w-44 shrink-0"
        >
          <option value="">Sem matéria</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name.replace(' e suas Tecnologias', '')}
            </option>
          ))}
        </select>
        <button
          onClick={() => void add()}
          disabled={!url.trim()}
          className="btn btn-primary shrink-0"
        >
          Salvar
        </button>
      </div>

      {videos === null ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : selected ? (
        <VideoDetail
          video={selected}
          onClose={() => setSelected(null)}
          onChange={(v) => {
            setSelected(v);
            setVideos((cur) =>
              cur?.map((x) => (x.id === v.id ? v : x)) ?? cur,
            );
          }}
        />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={IconPlay}
          title="Sua videoteca está vazia"
          description="Cole o link de uma aula do YouTube acima para começar."
          tip="Os metadados (título e capa) vêm direto do YouTube"
        />
      ) : (
        bySubject.map(([subjectName, list]) => (
          <section key={subjectName} className="card p-5">
            <h2
              className={`font-display text-lg font-bold ${
                AREA_TEXT[areaKey(subjectName)]
              }`}
            >
              {subjectName.replace(' e suas Tecnologias', '')}
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {list.map((v) => (
                <li key={v.id} className="card flex gap-3 overflow-hidden p-3">
                  <button
                    onClick={() => setSelected(v)}
                    className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2"
                    aria-label={`Assistir ${v.title}`}
                  >
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-muted">
                        <IconPlay width={22} height={22} />
                      </span>
                    )}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-semibold">
                      {v.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {v.notes.length}{' '}
                      {v.notes.length === 1 ? 'nota' : 'notas'}
                    </p>
                    <div className="mt-auto flex items-center gap-1 pt-1">
                      <button
                        onClick={() => void toggleWatched(v)}
                        aria-label={v.watched ? 'Marcar como não assistido' : 'Marcar como assistido'}
                        aria-pressed={v.watched}
                        className={`grid size-7 place-items-center rounded-md transition-colors ${
                          v.watched
                            ? 'bg-nat/12 text-nat'
                            : 'text-muted hover:bg-surface-2'
                        }`}
                      >
                        <IconCheck width={14} height={14} />
                      </button>
                      <button
                        onClick={() => void remove(v)}
                        aria-label={`Remover ${v.title}`}
                        className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-red/10 hover:text-red"
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}