import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type Recommendation,
  type ReviewItem,
  type StudySession,
} from '../api';
import { useAuth } from '../auth';
import {
  IconBook,
  IconCalendar,
  IconCheck,
  IconClipboard,
  IconChevronRight,
  IconClock,
  IconFormula,
  IconPen,
  IconStack,
  IconRepeat,
  IconTimer,
} from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { areaKey, AREA_DOT } from '../lib/areas';
import { proximoPasso, type ProximoPasso } from '../lib/next-step';
import { sessoesDeHoje } from '../lib/plan';
import { areaSourceName, subjectLabel, topicLabel } from '../lib/question';

interface Atalho {
  to: string;
  titulo: string;
  Icon: typeof IconStack;
  /** Contador opcional (ex.: assuntos vencidos na revisão). */
  selo?: number;
}

const ICONE_DO_PASSO: Record<ProximoPasso['tipo'], typeof IconStack> = {
  revisao: IconRepeat,
  cronograma: IconCalendar,
  recomendacao: IconStack,
  comecar: IconStack,
};

/** O que a Home carrega: tudo é ação do dia, nada de métrica. */
interface Dia {
  fila: ReviewItem[];
  hoje: StudySession[];
  recomendacao: Recommendation | null;
}

/**
 * Home: uma ação principal (o próximo passo) e atalhos para o resto. Sem
 * métricas: acerto e evolução ficam no Painel. No monitor largo, a coluna
 * "Hoje" ao lado lista as mesmas fontes do próximo passo por inteiro.
 */
export default function Home() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [dia, setDia] = useState<Dia | null>(null);
  const vencidas = dia?.fila.length ?? 0;
  const passo: ProximoPasso | null = dia
    ? proximoPasso({ vencidas, hoje: dia.hoje, recomendacao: dia.recomendacao })
    : null;

  useEffect(() => {
    let vivo = true;
    // Cada fonte que falha só sai da conta: a Home nunca quebra por isso.
    void Promise.all([
      api.reviewQueue().catch((): ReviewItem[] => []),
      api
        .studyPlan()
        .then((plan): StudySession[] => sessoesDeHoje(plan))
        .catch((): StudySession[] => []),
      api
        .recommendations(1)
        .then((r): Recommendation | null => r[0] ?? null)
        .catch(() => null),
    ]).then(([fila, hoje, recomendacao]) => {
      if (vivo) setDia({ fila, hoje, recomendacao });
    });
    return () => {
      vivo = false;
    };
  }, []);

  const atalhos: Atalho[] = [
    { to: '/questoes', titulo: 'Questões', Icon: IconStack },
    { to: '/simulados', titulo: 'Simulados', Icon: IconTimer },
    { to: '/revisao', titulo: 'Revisão', Icon: IconRepeat, selo: vencidas },
    { to: '/redacao', titulo: 'Redação', Icon: IconPen },
    { to: '/flashcards', titulo: 'Flashcards', Icon: IconBook },
    { to: '/cronograma', titulo: 'Cronograma', Icon: IconCalendar },
    { to: '/formulas', titulo: 'Fórmulas', Icon: IconFormula },
    { to: '/pomodoro', titulo: 'Pomodoro', Icon: IconClock },
    { to: '/painel', titulo: 'Painel', Icon: IconClipboard },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Início"
        title={name ? `Bora estudar, ${name}?` : 'Bora estudar?'}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <section aria-labelledby="proximo-passo" aria-busy={!passo}>
            {passo ? (
              <ProximoPassoCard passo={passo} />
            ) : (
              <Skeleton className="h-36" />
            )}
          </section>

          <nav aria-label="Atalhos">
            <h2 className="eyebrow mb-3">Atalhos</h2>
            {/* Ao lado da coluna "Hoje", nove numa linha não cabem: 3x3. */}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9 xl:grid-cols-3">
              {atalhos.map(({ to, titulo, Icon, selo }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className="relative flex h-full flex-col items-center gap-2 rounded-xl border border-line bg-surface px-2 py-3 text-center text-xs font-medium transition-colors hover:border-brand/40 hover:bg-surface-2"
                  >
                    <Icon width={22} height={22} className="text-brand" />
                    {titulo}
                    {!!selo && (
                      <span
                        className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-brand-ink"
                        aria-label={`${selo} para revisar`}
                      >
                        {selo}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Só no monitor largo: no celular o próximo passo já resume o dia. */}
        <aside className="hidden xl:block" aria-label="Hoje">
          {dia ? <HojeCard dia={dia} /> : <Skeleton className="h-72" />}
        </aside>
      </div>
    </div>
  );
}

function ProximoPassoCard({ passo }: { passo: ProximoPasso }) {
  const Icon = ICONE_DO_PASSO[passo.tipo];
  return (
    <div className="card card-raised flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
        <Icon width={26} height={26} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Próximo passo</p>
        <h2
          id="proximo-passo"
          className="mt-1 font-display text-lg font-bold leading-snug text-balance sm:text-xl"
        >
          {passo.titulo}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted text-pretty">
          {passo.descricao}
        </p>
      </div>
      <NavLink
        to={passo.to}
        className="btn btn-primary shrink-0 self-start sm:self-center"
      >
        {passo.acao}
        <IconChevronRight width={18} height={18} />
      </NavLink>
    </div>
  );
}

const DATA_HOJE = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Agenda do dia: revisão, blocos do cronograma e a recomendação. */
function HojeCard({ dia }: { dia: Dia }) {
  const { fila, hoje, recomendacao } = dia;
  const feitos = hoje.filter((s) => s.done).length;
  const q = recomendacao?.question;
  return (
    <div className="card p-5">
      <p className="eyebrow">Hoje</p>
      <p className="mt-1 font-display font-bold first-letter:uppercase">
        {DATA_HOJE.format(new Date())}
      </p>

      <ul className="mt-4 space-y-2">
        <li>
          <NavLink to="/revisao" className={ITEM}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
              <IconRepeat width={18} height={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Revisão</span>
              <span className="block text-xs text-muted">
                {fila.length === 0
                  ? 'Nenhum assunto vencido'
                  : fila.length === 1
                    ? '1 assunto vencido'
                    : `${fila.length} assuntos vencidos`}
              </span>
            </span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/cronograma" className={ITEM}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
              <IconCalendar width={18} height={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Cronograma</span>
              <span className="block text-xs text-muted">
                {hoje.length === 0
                  ? 'Nenhum bloco para hoje'
                  : `${feitos} de ${hoje.length} ${hoje.length === 1 ? 'bloco feito' : 'blocos feitos'}`}
              </span>
            </span>
          </NavLink>
          {hoje.length > 0 && (
            <ul className="mt-1 space-y-1 pl-12">
              {hoje.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  {s.done ? (
                    <IconCheck
                      width={14}
                      height={14}
                      className="shrink-0 text-success"
                      aria-label="feito"
                    />
                  ) : (
                    <span
                      className={`size-2 shrink-0 rounded-full ${AREA_DOT[areaKey(s.subject?.name ?? s.label)]}`}
                    />
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate ${s.done ? 'text-muted line-through' : ''}`}
                  >
                    {s.label}
                  </span>
                  <span className="shrink-0 font-data text-xs tabular-nums text-muted">
                    {s.minutes} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>

        {q && (
          <li>
            <NavLink
              to={
                q.topic
                  ? `/questoes?topicId=${encodeURIComponent(q.topic.id)}`
                  : '/questoes'
              }
              className={ITEM}
            >
              <span className="grid size-9 shrink-0 self-start place-items-center">
                <span
                  className={`size-2.5 rounded-full ${AREA_DOT[areaKey(areaSourceName(q))]}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {topicLabel(q) ?? subjectLabel(q)}
                </span>
                <span className="block text-xs text-muted">
                  {recomendacao.reason}
                </span>
              </span>
            </NavLink>
          </li>
        )}
      </ul>
    </div>
  );
}

const ITEM =
  'flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-surface-2';
