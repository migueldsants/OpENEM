import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type Performance, type PerformancePoint } from '../api';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

/** Gráfico de linha leve (SVG puro) da precisão ao longo dos dias. */
function AccuracyChart({ points }: { points: PerformancePoint[] }) {
  const W = 320;
  const H = 120;
  const PAD = 8;

  const path = useMemo(() => {
    if (points.length === 0) return { line: '', area: '', dots: [] };
    const n = points.length;
    const x = (i: number) =>
      n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1);
    const y = (acc: number) => H - PAD - (acc / 100) * (H - PAD * 2);
    const dots = points.map((p, i) => ({ cx: x(i), cy: y(p.accuracy), p }));
    const line = dots.map((d, i) => `${i ? 'L' : 'M'}${d.cx},${d.cy}`).join(' ');
    const area = `${line} L${dots[dots.length - 1].cx},${H - PAD} L${dots[0].cx},${H - PAD} Z`;
    return { line, area, dots };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-32 w-full text-brand"
      preserveAspectRatio="none"
      role="img"
      aria-label="Evolução da precisão por dia"
    >
      {/* Linhas de grade em 0/50/100%. */}
      {[0, 50, 100].map((g) => {
        const gy = H - PAD - (g / 100) * (H - PAD * 2);
        return (
          <line
            key={g}
            x1={PAD}
            x2={W - PAD}
            y1={gy}
            y2={gy}
            className="stroke-line"
            strokeWidth={1}
          />
        );
      })}
      <path d={path.area} fill="currentColor" opacity={0.1} />
      <path
        d={path.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {path.dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={2.5} fill="currentColor">
          <title>{`${d.p.date}: ${d.p.accuracy}% (${d.p.correct}/${d.p.total})`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Stat({
  value,
  label,
  accent = 'text-fg',
}: {
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <p className={`font-display text-2xl font-extrabold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function AreaBar({
  name,
  correct,
  total,
  accuracy,
}: {
  name: string;
  correct: number;
  total: number;
  accuracy: number;
}) {
  const area = areaKey(name);
  return (
    <li>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${AREA_DOT[area]}`} />
          {name.replace(' e suas Tecnologias', '')}
        </span>
        <span className="tabular-nums text-muted">
          {correct}/{total} · {accuracy}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${AREA_DOT[area]}`}
          style={{ width: `${accuracy}%` }}
        />
      </div>
    </li>
  );
}

type TopicSort = 'weakest' | 'most';

export default function Desempenho() {
  const [perf, setPerf] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topicSort, setTopicSort] = useState<TopicSort>('weakest');

  useEffect(() => {
    void (async () => {
      try {
        setPerf(await api.performance());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar o desempenho.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedTopics = useMemo(() => {
    if (!perf) return [];
    const copy = [...perf.byTopic];
    return topicSort === 'weakest'
      ? copy.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      : copy.sort((a, b) => b.total - a.total || a.accuracy - b.accuracy);
  }, [perf, topicSort]);

  if (loading) {
    return <p className="card p-6 text-center text-sm text-muted">Carregando…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
    );
  }

  const answered = perf?.overall.total ?? 0;
  if (!perf || answered === 0) {
    return (
      <div className="space-y-5">
        <header>
          <p className="eyebrow">Desempenho</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
            Suas estatísticas
          </h1>
        </header>
        <div className="card p-6 text-center text-sm text-muted">
          Ainda sem dados.{' '}
          <NavLink to="/questoes" className="font-medium text-brand">
            Responda sua primeira questão
          </NavLink>{' '}
          para ver sua evolução aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Desempenho</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
          Suas estatísticas
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhe sua evolução e onde vale reforçar.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          value={`${perf.overall.accuracy}%`}
          label="acerto geral"
          accent="text-brand"
        />
        <Stat value={String(answered)} label="respondidas" />
        <Stat
          value={`${perf.recent.accuracy}%`}
          label="nas últimas 20"
          accent={
            perf.recent.accuracy >= perf.overall.accuracy
              ? 'text-nat'
              : 'text-hum'
          }
        />
      </div>

      {/* Evolução temporal */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Evolução</h2>
          <span className="text-xs text-muted">precisão por dia</span>
        </div>
        {perf.timeline.length >= 2 ? (
          <>
            <div className="mt-4">
              <AccuracyChart points={perf.timeline} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{perf.timeline[0].date}</span>
              <span>{perf.timeline[perf.timeline.length - 1].date}</span>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
            Responda em mais de um dia para ver a curva de evolução.
          </p>
        )}
      </section>

      {/* Por área */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">Por área</h2>
        <ul className="mt-4 space-y-3">
          {perf.bySubject.map((s) => (
            <AreaBar
              key={s.id}
              name={s.name}
              correct={s.correct}
              total={s.total}
              accuracy={s.accuracy}
            />
          ))}
        </ul>
      </section>

      {/* Por assunto */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Por assunto</h2>
          <div className="seg">
            <button
              data-active={topicSort === 'weakest'}
              onClick={() => setTopicSort('weakest')}
            >
              A reforçar
            </button>
            <button
              data-active={topicSort === 'most'}
              onClick={() => setTopicSort('most')}
            >
              Mais praticados
            </button>
          </div>
        </div>
        <ul className="mt-4 space-y-2.5">
          {sortedTopics.map((t) => {
            const area = areaKey(t.subjectName);
            return (
              <li key={t.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {t.name}
                    {t.subjectName && (
                      <span className={`ml-1.5 text-xs ${AREA_TEXT[area]}`}>
                        {t.subjectName.replace(' e suas Tecnologias', '')}
                      </span>
                    )}
                  </span>
                  <span className="ml-2 shrink-0 tabular-nums text-muted">
                    {t.correct}/{t.total} · {t.accuracy}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${AREA_DOT[area]}`}
                    style={{ width: `${t.accuracy}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
