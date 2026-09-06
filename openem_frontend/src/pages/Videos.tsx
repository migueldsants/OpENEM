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
import Reveal from '../components/Reveal';
import { areaKey, AREA_DOT, AREA_TEXT, shortSubject } from '../lib/areas';
import { embedUrl, fmtTimestamp, parseTimestamp } from '../lib/video';

/** Player + notas com timestamp clicável (issue #37). */
function VideoDetail({
  video,
  subjects,
  onClose,
  onChange,
}: {
  video: Video;
  subjects: Subject[];
  onClose: () => void;
  onChange: (v: Video) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const [noteTs, setNoteTs] = useState('');
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    if (!noteText.trim()) return;
    const ts = parseTimestamp(noteTs);
    if (ts === null) {
      setError('Instante inválido — use 90, 1:30 ou 1:30:00 (máx. 24h).');
      return;
    }
    setError(null);
    try {
      const note = await api.addVideoNote(video.id, ts, noteText.trim());
      onChange({
        ...video,
        notes: [...video.notes, note].sort(
          (a, b) => a.timestampSec - b.timestampSec,
        ),
      });
      setNoteText('');
      setNoteTs('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar a nota.',
      );
    }
  }

  async function removeNote(note: VideoNote) {
    onChange({
      ...video,
      notes: video.notes.filter((n) => n.id !== note.id),
    });
    try {
      await api.deleteVideoNote(note.id);
    } catch {
      // Rollback preservando a ordem cronológica das notas.
      onChange({
        ...video,
        notes: [...video.notes, note].sort(
          (a, b) => a.timestampSec - b.timestampSec,
        ),
      });
      setError('Não foi possível remover a nota.');
    }
  }

  async function toggleWatched() {
    try {
      onChange(await api.toggleVideoWatched(video.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível atualizar.',
      );
    }
  }

  /** Re-classifica a matéria do vídeo já salvo (PATCH /videos/:id). */
  async function changeSubject(subjectId: string) {
    try {
      onChange(await api.updateVideoSubject(video.id, subjectId || null));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível mudar a matéria.',
      );
    }
  }

  function exportMd() {
    const blob = new Blob([buildMarkdown(video)], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title.slice(0, 60)}.md`;
    a.click();
    // Revogar de imediato aborta o download em Firefox/Safari.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
              {shortSubject(video.subjectName)}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="btn btn-ghost shrink-0"
        >
          <IconX width={16} height={16} />
        </button>
      </div>

      <ErrorBanner message={error} />

      {/* Player embed — `start` pula para o timestamp da nota clicada. */}
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
        <iframe
          key={seekTo ?? 'start'}
          src={embedUrl(video.youtubeId, seekTo)}
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
        <select
          value={video.subjectId ?? ''}
          onChange={(e) => void changeSubject(e.target.value)}
          aria-label="Matéria deste vídeo"
          className="input w-44 shrink-0"
        >
          <option value="">Sem matéria</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {shortSubject(s.name)}
            </option>
          ))}
        </select>
        {video.notes.length > 0 && (
          <button onClick={exportMd} className="btn btn-ghost">
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
            className="input w-24 shrink-0 text-center font-data tabular-nums"
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

/** Card de um vídeo: a capa 16:9 é o elemento âncora, não uma miniatura. */
function VideoCard({
  video,
  onOpen,
  onToggleWatched,
  onRemove,
}: {
  video: Video;
  onOpen: () => void;
  onToggleWatched: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="card lift flex flex-col overflow-hidden">
      <div className="relative">
      <button
        onClick={onOpen}
        aria-label={`Assistir ${video.title}`}
        className="group block aspect-video w-full overflow-hidden bg-surface-2"
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              video.watched ? 'opacity-60 saturate-50' : ''
            }`}
          />
        ) : (
          // Sem thumb (oEmbed falhou / vídeo privado): placeholder com
          // identidade, em vez de um retângulo vazio.
          <span className="bubble-field grid h-full place-items-center bg-surface-2">
            <span className="grid size-12 place-items-center rounded-full bg-brand/12 text-brand">
              <IconPlay width={22} height={22} />
            </span>
          </span>
        )}
        {/* Alvo de play que aparece no hover/foco. */}
        <span
          className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <span className="grid size-11 place-items-center rounded-full bg-white/90 pl-0.5 text-black shadow">
            <IconPlay width={20} height={20} />
          </span>
        </span>
      </button>
      {/* Selos ficam fora do botão: dentro dele o aria-label os esconderia. */}
      {video.watched && (
        <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-nat px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <IconCheck width={11} height={11} aria-hidden /> Assistido
        </span>
      )}
      {video.notes.length > 0 && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 font-data text-[10px] font-semibold text-white">
          {video.notes.length} {video.notes.length === 1 ? 'nota' : 'notas'}
        </span>
      )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-pretty">
          {video.title}
        </p>
        <div className="mt-auto flex items-center gap-1 border-t border-line pt-2">
          <button
            onClick={onToggleWatched}
            aria-label={
              video.watched
                ? 'Marcar como não assistido'
                : 'Marcar como assistido'
            }
            aria-pressed={video.watched}
            className={`grid size-8 place-items-center rounded-lg transition-colors ${
              video.watched
                ? 'bg-nat/12 text-nat'
                : 'text-muted hover:bg-surface-2 hover:text-nat'
            }`}
          >
            <IconCheck width={15} height={15} />
          </button>
          <button
            onClick={onRemove}
            aria-label={`Remover ${video.title}`}
            className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-red/10 hover:text-red"
          >
            <IconTrash width={15} height={15} />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Biblioteca de vídeos de estudo (issue #37). */
export default function Videos() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  // Filtrar a lista e classificar o vídeo novo são coisas distintas: um único
  // `subjectId` para as duas fazia o filtro esconder a lista ao classificar
  // (e classificar sem querer ao filtrar).
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setVideos(await api.videos(filterSubjectId || undefined));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar seus vídeos.',
      );
      setVideos([]);
    }
  }, [filterSubjectId]);

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
      const created = await api.addVideo(url.trim(), newSubjectId || undefined);
      // Com um filtro ativo, o vídeo novo pode não pertencer à visão atual.
      if (!filterSubjectId || filterSubjectId === created.subjectId) {
        setVideos((cur) => [created, ...(cur ?? [])]);
      }
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
      setVideos((cur) => cur?.map((x) => (x.id === v.id ? updated : x)) ?? cur);
      if (selected?.id === v.id) setSelected(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível atualizar.',
      );
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

  /** Reflete no detalhe e na lista a mesma versão do vídeo. */
  function applyChange(v: Video) {
    setSelected(v);
    setVideos((cur) => cur?.map((x) => (x.id === v.id ? v : x)) ?? cur);
  }

  const watchedCount = videos?.filter((v) => v.watched).length ?? 0;

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
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Videoteca</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Vídeos
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted text-pretty">
          Cole links de aulas do YouTube, organize por matéria e anote
          instantes importantes.
        </p>
      </header>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/* Novo vídeo: a matéria escolhida aqui classifica só o vídeo salvo. */}
      <section className="card card-raised p-4">
        <p className="eyebrow">Adicionar aula</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 basis-full sm:basis-0 sm:flex-1">
            <IconPlay
              width={15}
              height={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
              placeholder="Cole o link do YouTube…"
              aria-label="Link do YouTube"
              className="input w-full pl-9"
            />
          </div>
          <select
            value={newSubjectId}
            onChange={(e) => setNewSubjectId(e.target.value)}
            aria-label="Matéria do novo vídeo"
            className="input min-w-0 flex-1 sm:w-40 sm:flex-none"
          >
            <option value="">Sem matéria</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {shortSubject(s.name)}
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
      </section>

      {videos === null ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : selected ? (
        <VideoDetail
          video={selected}
          subjects={subjects}
          onClose={() => setSelected(null)}
          onChange={applyChange}
        />
      ) : (
        <>
          {/* Filtro da lista — independente da classificação acima. */}
          <div className="flex items-center gap-2">
            <label htmlFor="video-filter" className="eyebrow shrink-0">
              Filtrar
            </label>
            <select
              id="video-filter"
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className="input w-52"
            >
              <option value="">Todas as matérias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortSubject(s.name)}
                </option>
              ))}
            </select>
            {videos.length > 0 && (
              <span className="ml-auto shrink-0 font-data text-xs text-muted">
                {watchedCount}/{videos.length} assistidos
              </span>
            )}
          </div>

          {videos.length === 0 ? (
            <EmptyState
              icon={IconPlay}
              title={
                filterSubjectId
                  ? 'Nenhum vídeo nesta matéria'
                  : 'Sua videoteca está vazia'
              }
              description={
                filterSubjectId
                  ? 'Remova o filtro para ver todos os seus vídeos.'
                  : 'Cole o link de uma aula do YouTube acima para começar.'
              }
              action={
                filterSubjectId
                  ? { onClick: () => setFilterSubjectId(''), label: 'Ver todos' }
                  : undefined
              }
              tip="Os metadados (título e capa) vêm direto do YouTube"
            />
          ) : (
            <div className="space-y-7">
              {bySubject.map(([subjectName, list], i) => {
                const area = areaKey(subjectName);
                return (
                  <Reveal as="section" key={subjectName} delay={i * 60}>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${AREA_DOT[area]}`}
                        aria-hidden
                      />
                      <h2
                        className={`font-display text-lg font-bold ${AREA_TEXT[area]}`}
                      >
                        {shortSubject(subjectName)}
                      </h2>
                      <span
                        className={`rule-area h-px flex-1 opacity-25 ${AREA_TEXT[area]}`}
                        aria-hidden
                      />
                      <span className="shrink-0 font-data text-xs text-muted">
                        {list.length}
                      </span>
                    </div>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {list.map((v) => (
                        <VideoCard
                          key={v.id}
                          video={v}
                          onOpen={() => setSelected(v)}
                          onToggleWatched={() => void toggleWatched(v)}
                          onRemove={() => void remove(v)}
                        />
                      ))}
                    </ul>
                  </Reveal>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
