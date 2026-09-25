import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HeatmapArea, HeatmapTopic } from '../../api';
import { areaKey, AREA_DOT, AREA_TEXT } from '../../lib/areas';
import { Skeleton } from '../Skeleton';

/**
 * Cor de fundo pela taxa de acerto (issue #43):
 * verde = domina (≥70), amarelo = mediano (40–69), vermelho = fraco (<40),
 * neutro = nunca respondido.
 */
function levelColor(t: HeatmapTopic): string {
  if (t.total === 0) return 'bg-surface-2';
  if (t.accuracy >= 70) return 'bg-success/70';
  if (t.accuracy >= 40) return 'bg-warning/70';
  return 'bg-danger/70';
}

function TopicCell({ t }: { t: HeatmapTopic }) {
  const navigate = useNavigate();
  const label =
    t.total === 0
      ? `${t.name}: sem respostas ainda`
      : `${t.name}: ${t.accuracy}% (${t.correct}/${t.total})`;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() =>
        navigate(`/questoes?topicId=${encodeURIComponent(t.id)}`)
      }
      className={`h-9 min-w-9 flex-1 rounded-lg ${levelColor(t)} transition-transform hover:scale-110 hover:z-10`}
    />
  );
}

/**
 * Mapa de calor da taxonomia canônica (issue #43): grid dos ~170 tópicos
 * agrupados por área → matéria, colorido por taxa de acerto. Clicar em um
 * tópico leva às questões daquele assunto.
 */
export function TopicHeatmap({
  areas,
  loading,
  error,
  onRetry,
}: {
  areas: HeatmapArea[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [openArea, setOpenArea] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2" aria-busy>
        <Skeleton className="h-10" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
        <button onClick={onRetry} className="btn btn-ghost">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!areas) return null;

  return (
    <div className="space-y-3">
      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-lg bg-success/70" /> domina (≥70%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-lg bg-warning/70" /> mediano (40-69%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-lg bg-danger/70" /> reforçar (&lt;40%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-lg bg-surface-2" /> sem respostas
        </span>
      </div>

      {areas.map((area) => {
        const key = areaKey(area.name);
        const open = openArea === area.id;
        return (
          <section key={area.id} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenArea(open ? null : area.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-2.5 p-4 text-left transition-colors hover:bg-surface-2"
            >
              <span className={`size-3 rounded-full ${AREA_DOT[key]}`} />
              <span className={`flex-1 text-sm font-semibold ${AREA_TEXT[key]}`}>
                {area.name}
              </span>
              <span className="text-xs text-muted">
                {open ? 'Fechar' : 'Ver tópicos'}
              </span>
            </button>
            {open && (
              <div className="space-y-4 border-t border-line p-4">
                {area.subjects.map((subject) => {
                  const answered = subject.topics.filter((t) => t.total > 0);
                  const acc = answered.length
                    ? Math.round(
                        answered.reduce((s, t) => s + t.accuracy, 0) /
                          answered.length,
                      )
                    : null;
                  return (
                    <div key={subject.id}>
                      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold">
                          {subject.name.replace(' e suas Tecnologias', '')}
                        </span>
                        <span className="text-muted">
                          {acc != null
                            ? `${answered.length}/${subject.topics.length} tópicos · ${acc}% médio`
                            : `${subject.topics.length} tópicos`}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {subject.topics.map((t) => (
                          <TopicCell key={t.id} t={t} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}