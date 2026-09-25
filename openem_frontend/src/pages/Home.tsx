import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type Recommendation, type StudySession } from '../api';
import { useAuth } from '../auth';
import {
  IconBook,
  IconCalendar,
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
import { proximoPasso, type ProximoPasso } from '../lib/next-step';
import { sessoesDeHoje } from '../lib/plan';

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

/**
 * Home: uma ação principal (o próximo passo) e atalhos para o resto. Sem
 * métricas: acerto e evolução ficam no Painel.
 */
export default function Home() {
  const { me } = useAuth();
  const name = me?.profile?.displayName?.split(' ')[0];
  const [vencidas, setVencidas] = useState(0);
  const [passo, setPasso] = useState<ProximoPasso | null>(null);

  useEffect(() => {
    let vivo = true;
    // Cada fonte que falha só sai da conta: a Home nunca quebra por isso.
    void Promise.all([
      api.reviewQueue().catch(() => []),
      api
        .studyPlan()
        .then((plan): StudySession[] => sessoesDeHoje(plan))
        .catch((): StudySession[] => []),
      api
        .recommendations(1)
        .then((r): Recommendation | null => r[0] ?? null)
        .catch(() => null),
    ]).then(([fila, hoje, recomendacao]) => {
      if (!vivo) return;
      setVencidas(fila.length);
      setPasso(proximoPasso({ vencidas: fila.length, hoje, recomendacao }));
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

      <section aria-labelledby="proximo-passo" aria-busy={!passo}>
        {passo ? (
          <ProximoPassoCard passo={passo} />
        ) : (
          <Skeleton className="h-36" />
        )}
      </section>

      <nav aria-label="Atalhos">
        <h2 className="eyebrow mb-3">Atalhos</h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
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
