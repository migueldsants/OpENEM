import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type GamificationSummary,
  type Performance,
  type ReviewItem,
} from '../api';
import { useAuth } from '../auth';
import { IconFlame, IconPen, IconStack, IconTrophy } from '../components/icons';
import { areaKey, AREA_DOT } from '../lib/areas';
import { leagueStyle } from '../lib/gamification';

function ProgressWidget({
  data,
}: {
  data: Extract<GamificationSummary, { enabled: true }>;
}) {
  const league = leagueStyle(data.league.key);
  const pct = Math.round(data.progress.pct * 100);
  return (
    <NavLink
      to="/progresso"
      className={`card card-raised block p-4 ring-1 transition-transform hover:-translate-y-0.5 ${league.ring}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${league.soft} ${league.text}`}
        >
          <IconTrophy width={22} height={22} filled />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">
            Nível {data.level}{' '}
            <span className="text-xs font-medium text-muted">
              · Liga {data.league.name}
            </span>
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {data.currentStreak > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-red">
            <IconFlame width={18} height={18} filled />
            {data.currentStreak}
          </span>
        )}
      </div>
    </NavLink>
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

export default function Home() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [perf, setPerf] = useState<Performance | null>(null);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [game, setGame] = useState<GamificationSummary | null>(null);

  useEffect(() => {
    void api.performance().then(setPerf).catch(() => setPerf(null));
    void api.reviewQueue().then(setReview).catch(() => setReview([]));
    void api.gamification().then(setGame).catch(() => setGame(null));
  }, []);

  const answered = perf?.overall.total ?? 0;
  const hasData = answered > 0;

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Seu painel</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {name ? `Bora estudar, ${name}?` : 'Bora estudar?'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          {hasData
            ? 'Veja onde você está forte e onde vale reforçar.'
            : 'Responda algumas questões para começar a ver seu desempenho aqui.'}
        </p>
      </header>

      {game?.enabled && <ProgressWidget data={game} />}

      <div className="grid grid-cols-3 gap-3">
        <Stat
          value={hasData ? `${perf!.overall.accuracy}%` : '—'}
          label="de acerto"
          accent="text-brand"
        />
        <Stat value={String(answered)} label="respondidas" />
        <Stat
          value={String(review.length)}
          label="para revisar"
          accent={review.length ? 'text-hum' : 'text-fg'}
        />
      </div>

      {/* Desempenho por área — o coração do painel. */}
      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Desempenho por área</h2>
          <NavLink to="/questoes" className="text-xs font-medium text-brand">
            Praticar
          </NavLink>
        </div>

        {hasData && perf!.bySubject.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {perf!.bySubject.map((s) => {
              const area = areaKey(s.name);
              return (
                <li key={s.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${AREA_DOT[area]}`} />
                      {s.name.replace(' e suas Tecnologias', '')}
                    </span>
                    <span className="tabular-nums text-muted">
                      {s.correct}/{s.total} · {s.accuracy}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${AREA_DOT[area]}`}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
            Sem dados ainda.{' '}
            <NavLink to="/questoes" className="font-medium text-brand">
              Responda sua primeira questão
            </NavLink>{' '}
            para ver suas estatísticas.
          </div>
        )}
      </section>

      {/* Pontos a reforçar — só quando há sinal. */}
      {hasData && perf!.weakestTopics.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">A reforçar</h2>
          <p className="mt-0.5 text-xs text-muted">
            Assuntos com menor acerto até agora.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {perf!.weakestTopics.slice(0, 5).map((t) => (
              <li key={t.id} className="chip">
                {t.name}
                <span className="tabular-nums text-muted">{t.accuracy}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <NavLink
          to="/questoes"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-mat/12 text-mat">
            <IconStack width={22} height={22} />
          </span>
          <span>
            <span className="block font-display font-bold">Responder questões</span>
            <span className="text-xs text-muted">Com gabarito comentado</span>
          </span>
        </NavLink>
        <NavLink
          to="/redacao"
          className="card card-raised flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-red/12 text-red">
            <IconPen width={22} height={22} />
          </span>
          <span>
            <span className="block font-display font-bold">Treinar redação</span>
            <span className="text-xs text-muted">Nota por competência</span>
          </span>
        </NavLink>
      </div>
    </div>
  );
}
