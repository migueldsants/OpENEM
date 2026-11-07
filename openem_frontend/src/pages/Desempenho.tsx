import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type AreaDaSemana,
  type DesempenhoSemanal,
  type HeatmapArea,
  type PrioridadeDeEstudo,
  type SemanaDeEstudo,
} from '../api';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconEquals,
  IconFlame,
  IconTrophy,
} from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { TopicHeatmap } from '../components/performance/TopicHeatmap';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { useGamification } from '../gamification';
import { AREA_DOT, AREA_TEXT } from '../lib/areas';
import {
  diaCurto,
  diaPorExtenso,
  estadoDoDia,
  formatarMinutos,
  fracaoDaMeta,
  intervaloDaSemana,
  metaDaSemana,
  acertosDaPrioridade,
  caiMuitoNaProva,
  numeroDoDia,
  semAtividade,
  textoDaVariacao,
} from '../lib/semanas';

// Desempenho semana a semana (issue #90): a semana atual aberta contra a meta
// do aluno, as anteriores dobradas com a variação, e o mapa de assuntos como
// detalhe. Dados de GET /performance/weeks (dias de Brasília).

const SEMANAS = 8;

const NOME_DA_AREA: Record<AreaDaSemana, string> = {
  mat: 'Matemática',
  nat: 'Natureza',
  hum: 'Humanas',
  lin: 'Linguagens',
};

const ESTILO_DO_DIA = {
  estudou: 'bg-brand text-brand-ink',
  // Hoje leva sempre o contorno; estudado, o contorno fica do lado de fora.
  'hoje-estudou': 'bg-brand text-brand-ink ring-2 ring-brand ring-offset-2 ring-offset-surface',
  hoje: 'bg-surface text-brand ring-2 ring-brand ring-inset',
  futuro: 'border border-dashed border-line text-muted',
  vazio: 'bg-surface-2 text-muted',
} as const;

function detalheDoDia(d: { answers: number; minutes: number }): string {
  return `${d.answers ? `, ${d.answers} ${d.answers === 1 ? 'questão' : 'questões'}` : ''}${d.minutes ? `, ${d.minutes} min de foco` : ''}`;
}

/** Faixa dos 7 dias: a sequência vista como semana de calendário. */
function FaixaDaSemana({ semana, hoje, compacta = false }: { semana: SemanaDeEstudo; hoje: string; compacta?: boolean }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Dias da semana">
      {semana.days.map((d) => {
        const estado = estadoDoDia(d, hoje);
        const descricao =
          estado === 'estudou'
            ? `estudou${detalheDoDia(d)}`
            : estado === 'hoje-estudou'
              ? `hoje, estudou${detalheDoDia(d)}`
              : estado === 'hoje'
                ? 'hoje, ainda sem estudo'
                : estado === 'futuro'
                  ? 'ainda não chegou'
                  : 'sem estudo';
        return (
          <li key={d.date} className="flex flex-col items-center gap-1">
            {!compacta && (
              <span aria-hidden className="text-[0.7rem] text-muted">
                {diaCurto(d.date)}
              </span>
            )}
            <span
              aria-label={`${diaPorExtenso(d.date)}: ${descricao}`}
              className={`grid w-full place-items-center rounded-lg font-data text-xs font-medium tabular-nums ${
                compacta ? 'h-6' : 'h-9 text-sm'
              } ${ESTILO_DO_DIA[estado]}`}
            >
              {numeroDoDia(d.date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barra da meta: enche uma vez ao aparecer (só transform; some com reduced motion). */
function BarraDaMeta({ valor }: { valor: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div
        className="barra-enche h-full w-full origin-left rounded-full bg-brand"
        style={{ transform: `scaleX(${valor / 100})` }}
      />
    </div>
  );
}

/** Uma linha de 7 traços: os dias estudados de uma semana passada, sem abrir a linha. */
function MiniFaixa({ semana }: { semana: SemanaDeEstudo }) {
  return (
    <span aria-hidden className="mt-1.5 flex gap-1">
      {semana.days.map((d) => (
        <span key={d.date} className={`h-1.5 w-3 rounded-full ${d.studied ? 'bg-brand' : 'bg-muted/70'}`} />
      ))}
    </span>
  );
}

function Variacao({ delta }: { delta: number | null }) {
  const texto = textoDaVariacao(delta);
  if (!texto) return null;
  const d = delta ?? 0;
  const Icone = d > 0 ? IconArrowUp : d < 0 ? IconArrowDown : IconEquals;
  return (
    <span
      className={`inline-flex items-center justify-end gap-1 font-data text-xs tabular-nums ${
        d > 0 ? 'text-success' : d < 0 ? 'text-danger' : 'text-muted'
      }`}
    >
      <Icone width={12} height={12} aria-hidden />
      <span className="sr-only">variação do acerto em pontos percentuais: </span>
      {texto}
    </span>
  );
}

function Prioridades({ prioridades, semAssunto }: { prioridades: PrioridadeDeEstudo[]; semAssunto: number }) {
  return (
    <div className="border-t border-line pt-4">
      <h3 className="text-sm font-semibold">Pratique agora</h3>
      {/* A lista vem do último mês, não só desta semana: o cartão precisa dizer. */}
      <p className="mt-0.5 text-xs text-muted">
        {prioridades.length === 0
          ? 'Nada urgente por aqui. Os assuntos em que você mais erra nos últimos 30 dias aparecem nesta lista.'
          : 'Pelos seus erros dos últimos 30 dias, com mais peso no que cai muito na prova.'}
      </p>
      {prioridades.length === 0 ? null : (
        <ul className="mt-2 divide-y divide-line">
          {prioridades.map((p) => (
            <li key={p.topicId} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className={`h-8 w-1 shrink-0 rounded-full ${p.area ? AREA_DOT[p.area] : 'bg-muted/40'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.topic}</p>
                {/* Matéria e contagem numa linha que não parte no meio; a
                    incidência na prova, quando alta, ganha a própria linha. */}
                <p className="text-xs text-muted">
                  {p.subject} · <span className="whitespace-nowrap">{acertosDaPrioridade(p)}</span>
                </p>
                {caiMuitoNaProva(p) && <p className="text-xs font-medium text-warning">Cai muito na prova</p>}
                {p.subjectId && (
                  <NavLink
                    to={`/materias/${encodeURIComponent(p.subjectId)}`}
                    className="text-xs font-medium text-brand underline-offset-2 hover:underline"
                    aria-label={`Ver ${p.topic} na trilha de ${p.subject}`}
                  >
                    Ver na trilha
                  </NavLink>
                )}
              </div>
              <NavLink
                to={`/questoes?topicId=${encodeURIComponent(p.topicId)}`}
                className="btn btn-primary shrink-0 px-3 py-1.5 text-xs"
                aria-label={`Praticar ${p.topic}`}
              >
                Praticar
              </NavLink>
            </li>
          ))}
        </ul>
      )}
      {semAssunto > 0 && (
        <p className="mt-2 text-xs text-muted text-pretty">
          {semAssunto} {semAssunto === 1 ? 'resposta' : 'respostas'} do último mês ainda sem assunto
          classificado {semAssunto === 1 ? 'fica' : 'ficam'} fora desta lista.
        </p>
      )}
    </div>
  );
}

function EstaSemana({
  dados,
  gamificacao,
}: {
  dados: DesempenhoSemanal;
  gamificacao: boolean;
}) {
  const semana = dados.weeks[0];
  const meta = metaDaSemana(dados.goalMinutesPerDay);
  return (
    <section aria-labelledby="esta-semana" className="card card-raised space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="esta-semana" className="font-display text-xl font-bold tracking-tight">
          Esta semana
        </h2>
        <p className="font-data text-xs text-muted">{intervaloDaSemana(semana.start, semana.end)}</p>
      </div>

      <FaixaDaSemana semana={semana} hoje={dados.today} />

      {/* Dois números lado a lado, separados por uma linha: sem caixa dentro do cartão. */}
      <div className="grid grid-cols-2 divide-x divide-line">
        <div className="pr-4">
          <p className="text-xs text-muted">Minutos de foco</p>
          <p className="mt-0.5 font-data text-lg font-medium tabular-nums">
            {semana.minutes}
            {meta && <span className="text-xs font-normal text-muted"> de {meta}</span>}
          </p>
          {meta && <BarraDaMeta valor={fracaoDaMeta(semana.minutes, meta)} />}
        </div>
        <div className="pl-4">
          <p className="text-xs text-muted">Questões</p>
          <p className="mt-0.5 font-data text-lg font-medium tabular-nums">
            {semana.answers}
            {semana.accuracy !== null && (
              <span className="text-xs font-normal text-muted"> · {semana.accuracy}% certas</span>
            )}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-1 border-t border-line pt-3 text-center">
        {semana.areas.map((a) => (
          <div key={a.area} className="min-w-0">
            <dt className={`truncate text-[0.7rem] font-semibold ${AREA_TEXT[a.area]}`}>{NOME_DA_AREA[a.area]}</dt>
            <dd className="mt-0.5 font-data text-base font-medium tabular-nums">
              {a.accuracy === null ? <span className="text-xs font-normal text-muted">sem questão</span> : `${a.accuracy}%`}
            </dd>
            {a.answers > 0 && <dd className="text-[0.7rem] text-muted">{a.answers} q.</dd>}
          </div>
        ))}
      </dl>

      <Prioridades prioridades={dados.priorities} semAssunto={dados.unclassified} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <p className="flex items-center gap-1.5 text-muted">
          <IconFlame width={16} height={16} className={dados.streak ? 'text-warning' : ''} aria-hidden />
          {dados.streak === 0
            ? 'Nenhum dia seguido de estudo agora'
            : `${dados.streak} ${dados.streak === 1 ? 'dia seguido' : 'dias seguidos'} de estudo`}
        </p>
        {gamificacao && (
          <NavLink to="/progresso" className="inline-flex items-center gap-1 font-medium text-brand">
            Nível e conquistas
            <IconChevronRight width={14} height={14} aria-hidden />
          </NavLink>
        )}
      </div>
    </section>
  );
}

function SemanasAnteriores({ semanas, hoje }: { semanas: SemanaDeEstudo[]; hoje: string }) {
  return (
    <section aria-labelledby="semanas-anteriores">
      <h2 id="semanas-anteriores" className="font-display text-lg font-bold">
        Semanas anteriores
      </h2>
      <ul className="card mt-3 divide-y divide-line overflow-hidden">
        {semanas.map((s) => {
          const vazia = s.answers === 0 && s.minutes === 0;
          return (
            <li key={s.start}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block font-data text-sm">{intervaloDaSemana(s.start, s.end)}</span>
                    <span className="block text-xs text-muted">
                      {vazia
                        ? 'sem estudo'
                        : `${s.answers} ${s.answers === 1 ? 'questão' : 'questões'} · ${formatarMinutos(s.minutes)} de foco`}
                    </span>
                    {!vazia && <MiniFaixa semana={s} />}
                  </span>
                  {s.accuracy !== null && (
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                      <span className="text-sm">
                        <span className="font-data font-medium tabular-nums">{s.accuracy}%</span>
                        <span className="text-xs text-muted"> de acerto</span>
                      </span>
                      <Variacao delta={s.delta} />
                    </span>
                  )}
                  <IconChevronDown
                    width={16}
                    height={16}
                    aria-hidden
                    className="shrink-0 text-muted transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-3 px-4 pb-4">
                  <FaixaDaSemana semana={s} hoje={hoje} compacta />
                  <dl className="grid grid-cols-4 gap-2 text-center">
                    {s.areas.map((a) => (
                      <div key={a.area}>
                        <dt className={`text-[0.7rem] font-semibold ${AREA_TEXT[a.area]}`}>{NOME_DA_AREA[a.area]}</dt>
                        <dd className="font-data text-sm tabular-nums">
                          {a.accuracy === null ? <span className="text-xs text-muted">sem questão</span> : `${a.accuracy}%`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Todos os assuntos do ENEM (issue #43), carregado só quando o aluno abre. */
function TodosOsAssuntos() {
  const [aberto, setAberto] = useState(false);
  const [areas, setAreas] = useState<HeatmapArea[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setAreas(await api.performanceHeatmap());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os assuntos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">Todos os assuntos</h2>
          <p className="mt-0.5 text-xs text-muted">Seu acerto em cada assunto do ENEM, desde o início. Toque num assunto para praticar.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const proximo = !aberto;
            setAberto(proximo);
            if (proximo && (areas === null || erro)) void carregar();
          }}
          aria-expanded={aberto}
          className="btn btn-ghost shrink-0"
        >
          {aberto ? 'Fechar' : 'Abrir'}
        </button>
      </div>
      {aberto && (
        <div className="mt-4">
          <TopicHeatmap areas={areas} loading={carregando} error={erro} onRetry={() => void carregar()} />
        </div>
      )}
    </section>
  );
}

export default function Desempenho() {
  const { summary } = useGamification();
  const [dados, setDados] = useState<DesempenhoSemanal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);

  useEffect(() => {
    let cancelado = false;
    setErro(null);
    api
      .performanceWeeks(SEMANAS)
      .then((d) => {
        if (!cancelado) setDados(d);
      })
      .catch((err) => {
        if (!cancelado)
          setErro(err instanceof Error ? err.message : 'Não foi possível carregar o seu desempenho.');
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const meta = dados?.goalMinutesPerDay;
  // O título fica de pé em todos os estados: sem ele a página "pulava".
  const cabecalho = (
    <PageHeader
      eyebrow="Suas estatísticas"
      title="Seu desempenho"
      subtitle={
        meta
          ? `Semana a semana, contra a sua meta de ${formatarMinutos(meta)} por dia.`
          : 'Semana a semana: o que você estudou e o que praticar agora.'
      }
    />
  );

  if (erro) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <ErrorBanner message={erro} onRetry={tentarDeNovo} />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="space-y-6" aria-busy>
        {cabecalho}
        <div className="card space-y-4 p-4 sm:p-5">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-16" />
        </div>
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (semAtividade(dados.weeks)) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <EmptyState
          icon={IconTrophy}
          title="Sua primeira semana começa agora"
          description={
            <>
              Responda questões em{' '}
              <NavLink to="/questoes" className="font-medium text-brand">
                Questões
              </NavLink>{' '}
              ou faça um ciclo de foco no{' '}
              <NavLink to="/pomodoro" className="font-medium text-brand">
                Pomodoro
              </NavLink>
              : cada dia de estudo aparece aqui, semana a semana.
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cabecalho}
      {/* Em tela larga as semanas anteriores ficam ao lado, e a faixa dos dias
          não estica até virar barra. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
        <EstaSemana dados={dados} gamificacao={summary?.enabled === true} />
        {dados.weeks.length > 1 && (
          <SemanasAnteriores semanas={dados.weeks.slice(1)} hoje={dados.today} />
        )}
      </div>
      <TodosOsAssuntos />
    </div>
  );
}
