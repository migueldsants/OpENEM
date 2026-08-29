import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type Performance, type PerformancePoint } from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconTrophy } from '../components/icons';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { areaKey, AREA_DOT, AREA_TEXT } from '../lib/areas';

/** Gráfico de linha leve (SVG puro) da precisão ao longo dos dias, com
 *  eixo Y rotulado (0/50/100%) e tooltip ao passar o mouse sobre cada ponto. */
function AccuracyChart({ points }: { points: PerformancePoint[] }) {
  const W = 320;
  const H = 140;
  const PAD_LEFT = 30;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 8;
  const [hover, setHover] = useState<number | null>(null);

  const path = useMemo(() => {
    if (points.length === 0) return { line: '', area: '', dots: [] as { cx: number; cy: number; p: PerformancePoint }[] };
    const n = points.length;
    const x = (i: number) =>
      n === 1
        ? PAD_LEFT + (W - PAD_LEFT - PAD_RIGHT) / 2
        : PAD_LEFT + (i * (W - PAD_LEFT - PAD_RIGHT)) / (n - 1);
    const y = (acc: number) =>
      H - PAD_BOTTOM - (acc / 100) * (H - PAD_TOP - PAD_BOTTOM);
    const dots = points.map((p, i) => ({ cx: x(i), cy: y(p.accuracy), p }));
    const line = dots.map((d, i) => `${i ? 'L' : 'M'}${d.cx},${d.cy}`).join(' ');
    const area = `${line} L${dots[dots.length - 1].cx},${H - PAD_BOTTOM} L${dots[0].cx},${H - PAD_BOTTOM} Z`;
    return { line, area, dots };
  }, [points]);

  if (points.length === 0) return null;

  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const sliceW = innerW / points.length;
  const active = hover !== null ? path.dots[hover] : null;
  const gridY = (g: number) =>
    H - PAD_BOTTOM - (g / 100) * (H - PAD_TOP - PAD_BOTTOM);

  return (
    <div className="relative">
      {/* Rótulos do eixo Y (HTML — evita a distorção do preserveAspectRatio). */}
      {[0, 50, 100].map((g) => (
        <span
          key={g}
          className="pointer-events-none absolute left-0 -translate-y-1/2 text-[9px] text-muted"
          style={{ top: `${(gridY(g) / H) * 100}%` }}
        >
          {g}%
        </span>
      ))}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-36 w-full text-brand"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolução da precisão por dia"
      >
        {/* Linhas de grade em 0/50/100%. */}
        {[0, 50, 100].map((g) => {
          const gy = gridY(g);
          return (
            <line
              key={g}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
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
          <circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={hover === i ? 4 : 2.5}
            fill="currentColor"
            stroke={hover === i ? 'var(--surface)' : 'none'}
            strokeWidth={hover === i ? 1.5 : 0}
          >
            <title>{`${d.p.date}: ${d.p.accuracy}% (${d.p.correct}/${d.p.total})`}</title>
          </circle>
        ))}
        {/* Hit areas amplas por ponto (não exige mirar no dot). */}
        {path.dots.map((_d, i) => (
          <rect
            key={`hit-${i}`}
            x={PAD_LEFT + i * sliceW}
            y={0}
            width={sliceW}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow"
          style={{
            left: `${(active.cx / W) * 100}%`,
            top: `${(active.cy / H) * 100}%`,
          }}
        >
          <span className="font-semibold">{active.p.date}</span>
          {': '}
          {active.p.accuracy}% ({active.p.correct}/{active.p.total})
        </div>
      )}
    </div>
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
type Period = '7d' | '30d' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'all', label: 'Tudo' },
];

export default function Desempenho() {
  const [perf, setPerf] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topicSort, setTopicSort] = useState<TopicSort>('weakest');
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setPerf(await api.performance(period));
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar o desempenho.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const sortedTopics = useMemo(() => {
    if (!perf) return [];
    const copy = [...perf.byTopic];
    return topicSort === 'weakest'
      ? copy.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      : copy.sort((a, b) => b.total - a.total || a.accuracy - b.accuracy);
  }, [perf, topicSort]);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBanner message={error} />
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
        <EmptyState
          icon={IconTrophy}
          title="Ainda sem dados"
          description={
            <>
              Responda sua primeira questão em{' '}
              <NavLink to="/questoes" className="font-medium text-brand">
                Questões
              </NavLink>{' '}
              para ver sua evolução aqui.
            </>
          }
          tip="Veja sua evolução após algumas questões"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Desempenho</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              Suas estatísticas
            </h1>
            <p className="mt-1 text-sm text-muted">
              Acompanhe sua evolução e onde vale reforçar.
            </p>
          </div>
          <div className="seg" role="group" aria-label="Filtro de período">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                data-active={period === p.key}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
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
          <EmptyState
            icon={IconTrophy}
            title="Evolução a caminho"
            description="Responda em mais de um dia para ver a curva."
            tip="Cada dia de estudo vira um ponto no gráfico"
            bare
          />
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
