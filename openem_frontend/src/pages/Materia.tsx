import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, HttpError, type IncidenceWindow, type TrackDetail, type TrackStage, type TrackTopic } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconCheck, IconChevronLeft } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { ComoCalculamos, PontoDeEstado, PorProva, QuestoesPorProva, TiraDosAnos } from '../components/TrilhaUI';
import { AREA_DOT, AREA_TEXT, areaCurta, areaKey } from '../lib/areas';
import {
  alternarPulada,
  decimal,
  estadoDaEtapa,
  etapaAtual,
  filtrosDaEtapa,
  gravarPuladas,
  lerPuladas,
  porProva,
  QUESTOES_DA_ETAPA,
  recorte,
  ROTULO_DO_ESTADO,
  rotuloAnos,
  type EstadoDaEtapa,
} from '../lib/trilhas';

type Aba = 'trilha' | 'cai';

/**
 * Trilha de uma matéria (discussão #122): as etapas na ordem sugerida, com o
 * que cada uma rende na prova e o domínio do aluno, e a aba "O que cai" com
 * os assuntos em ordem de incidência.
 */
export default function Materia() {
  const { subjectId = '' } = useParams();
  const { me } = useAuth();
  const [busca, setBusca] = useSearchParams();
  const aba: Aba = busca.get('aba') === 'cai' ? 'cai' : 'trilha';
  const [dados, setDados] = useState<TrackDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [naoExiste, setNaoExiste] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [puladas, setPuladas] = useState(() => lerPuladas(me?.id));

  useEffect(() => {
    let vivo = true;
    setErro(null);
    setNaoExiste(false);
    api
      .track(subjectId)
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => {
        if (!vivo) return;
        if (e instanceof HttpError && e.status === 404) setNaoExiste(true);
        else setErro('Não foi possível carregar a trilha. Verifique sua conexão.');
      });
    return () => {
      vivo = false;
    };
  }, [subjectId, recarregar]);

  function trocarAba(nova: Aba) {
    const p = new URLSearchParams(busca);
    if (nova === 'cai') p.set('aba', 'cai');
    else p.delete('aba');
    setBusca(p, { replace: true });
  }

  function pular(titulo: string) {
    const novo = alternarPulada(puladas, subjectId, titulo);
    setPuladas(novo);
    gravarPuladas(me?.id, novo);
  }

  const voltar = (
    <NavLink to="/materias" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
      <IconChevronLeft width={14} height={14} aria-hidden />
      Matérias
    </NavLink>
  );

  if (naoExiste) {
    return (
      <div className="space-y-6">
        {voltar}
        <PageHeader title="Matéria não encontrada" subtitle="Esta matéria não tem trilha. Volte para a lista e escolha outra." />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="space-y-6">
        {voltar}
        <ErrorBanner message={erro} onRetry={() => setRecarregar((k) => k + 1)} />
        {!erro && (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-20" />
            <Skeleton className="h-96" />
          </div>
        )}
      </div>
    );
  }

  const area = areaKey(dados.subject.area.name);
  const doAluno = new Set(puladas[subjectId] ?? []);

  return (
    <div className="space-y-6">
      {voltar}
      <PageHeader
        title={dados.subject.name}
        subtitle={
          <>
            {/* Em Matemática, área e matéria têm o mesmo nome: não repete. */}
            {areaCurta(dados.subject.area.name) !== dados.subject.name && (
              <>
                <span className={`font-semibold ${AREA_TEXT[area]}`}>{areaCurta(dados.subject.area.name)}</span>
                {' · '}
              </>
            )}
            <QuestoesPorProva n={dados.perExam} /> {recorte(dados.window)}
            {dados.answered > 0 && (
              <>
                {' · você domina '}
                <span className="font-data tabular-nums">{dados.mastery}%</span>
              </>
            )}
          </>
        }
      >
        <div className="seg" role="tablist" aria-label="Seções da matéria">
          {(
            [
              ['trilha', 'Trilha'],
              ['cai', 'O que cai'],
            ] as const
          ).map(([k, rotulo]) => (
            <button
              key={k}
              role="tab"
              id={`aba-${k}`}
              aria-controls={`painel-${k}`}
              aria-selected={aba === k}
              data-active={aba === k}
              onClick={() => trocarAba(k)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </PageHeader>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === 'trilha' ? (
          <Trilha dados={dados} puladas={doAluno} onPular={pular} />
        ) : (
          <OQueCai dados={dados} />
        )}
      </div>

      <ComoCalculamos janela={dados.window} />
    </div>
  );
}

const ESTILO_DO_MARCADOR: Record<EstadoDaEtapa, string> = {
  concluida: 'bg-brand text-brand-ink',
  pulada: 'bg-surface-2 text-muted',
  atual: 'bg-surface text-brand ring-2 ring-inset ring-brand',
  // `line` some no tema escuro num círculo deste tamanho: o tracejado usa o
  // `muted`, que tem contraste garantido em todo tema.
  futura: 'border border-dashed border-muted/60 bg-surface text-muted',
  'sem-questoes': 'border border-dashed border-muted/40 bg-surface text-muted',
};

const DESCRICAO_DO_ESTADO: Record<EstadoDaEtapa, string> = {
  concluida: 'concluída',
  pulada: 'marcada como já sei',
  atual: 'etapa atual',
  futura: 'próxima',
  'sem-questoes': 'ainda sem questões no banco',
};

function Trilha({
  dados,
  puladas,
  onPular,
}: {
  dados: TrackDetail;
  puladas: ReadonlySet<string>;
  onPular: (titulo: string) => void;
}) {
  const atual = etapaAtual(dados.stages, puladas);

  return (
    <div className="space-y-4">
      {atual === null && (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-fg" role="status">
          Trilha concluída. Continue treinando pela aba <strong>O que cai</strong>, começando pelos assuntos que mais
          aparecem.
        </p>
      )}

      <ol className="card card-raised px-4 py-2 sm:px-5" aria-label={`Trilha de ${dados.subject.name}`}>
        {dados.stages.map((etapa, i) => (
          <Etapa
            key={etapa.title}
            etapa={etapa}
            estado={estadoDaEtapa(etapa, i, atual, puladas)}
            ultima={i === dados.stages.length - 1}
            subjectName={dados.subject.name}
            onPular={() => onPular(etapa.title)}
          />
        ))}
      </ol>

      {dados.extras.topics.length > 0 && (
        <details className="card group p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-display font-bold">Se sobrar tempo</span>
              <span className="block text-sm text-muted text-pretty">
                {dados.extras.topics.length === 1 ? 'Um assunto que apareceu' : `${dados.extras.topics.length} assuntos que apareceram`}{' '}
                pouco ou nada {recorte(dados.window)}.
              </span>
            </span>
            <span className="mt-1 shrink-0 text-xs font-medium text-muted group-open:hidden">Mostrar</span>
            <span className="mt-1 hidden shrink-0 text-xs font-medium text-muted group-open:inline">Ocultar</span>
          </summary>
          <ChipsDeAssunto topicos={dados.extras.topics} className="mt-3" />
        </details>
      )}
    </div>
  );
}

function Etapa({
  etapa,
  estado,
  ultima,
  subjectName,
  onPular,
}: {
  etapa: TrackStage;
  estado: EstadoDaEtapa;
  ultima: boolean;
  subjectName: string;
  onPular: () => void;
}) {
  const navigate = useNavigate();
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const treinaveis = etapa.topics.filter((t) => t.bank > 0);

  async function treinar() {
    setIniciando(true);
    setErro(null);
    try {
      const start = await api.startSimulation(null, filtrosDaEtapa(treinaveis.map((t) => t.id)));
      navigate('/simulados', { state: { simuladoIniciado: start } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível montar o simulado.');
      setIniciando(false);
    }
  }

  const feita = estado === 'concluida' || estado === 'pulada';

  return (
    <li
      className="relative py-4 pl-11"
      aria-current={estado === 'atual' ? 'step' : undefined}
      aria-label={`Etapa ${etapa.index + 1}: ${etapa.title}, ${DESCRICAO_DO_ESTADO[estado]}`}
    >
      {!ultima && <span aria-hidden className="absolute bottom-0 left-[0.8125rem] top-12 w-px bg-line" />}
      <span
        aria-hidden
        className={`absolute left-0 top-4 grid size-7 place-items-center rounded-full font-data text-xs font-semibold tabular-nums ${ESTILO_DO_MARCADOR[estado]}`}
      >
        {feita ? <IconCheck width={14} height={14} /> : etapa.index + 1}
      </span>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className={`font-display font-bold ${feita ? 'text-muted' : ''}`}>{etapa.title}</h3>
        <p className="text-xs text-muted">
          <PorProva n={etapa.perExam} />
        </p>
      </div>
      <p className="mt-0.5 text-sm text-muted text-pretty">{etapa.why}</p>

      <ChipsDeAssunto topicos={etapa.topics} className="mt-3" />

      {estado === 'sem-questoes' && (
        <p className="mt-2 text-xs text-muted">Ainda não há questões destes assuntos no banco.</p>
      )}

      {estado === 'atual' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void treinar()}
            disabled={iniciando}
            aria-label={`Treinar a etapa ${etapa.title} de ${subjectName} com ${QUESTOES_DA_ETAPA} questões`}
          >
            {iniciando ? 'Montando…' : 'Treinar etapa'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onPular}>
            Já sei isso
          </button>
          <span className="text-xs text-muted">
            <span className="font-data tabular-nums">{QUESTOES_DA_ETAPA}</span> questões que já caíram no ENEM
          </span>
        </div>
      )}
      {estado === 'pulada' && (
        <button type="button" className="mt-2 text-xs font-medium text-brand underline-offset-2 hover:underline" onClick={onPular}>
          Desfazer “já sei isso”
        </button>
      )}
      {erro && (
        <div className="mt-3">
          <ErrorBanner message={erro} wrap />
        </div>
      )}
    </li>
  );
}

function rotuloDoAssunto(t: TrackTopic): string {
  const partes = [t.name, porProva(t.perExam), ROTULO_DO_ESTADO[t.state]];
  if (t.accuracy !== null) partes.push(`${t.accuracy}% de acerto nas últimas respostas`);
  if (t.bank === 0) partes.push('sem questões no banco');
  return partes.join(', ');
}

/** Os assuntos como chips: estado, nome e quanto cai; cada um abre as questões. */
function ChipsDeAssunto({ topicos, className = '' }: { topicos: TrackTopic[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Assuntos">
      {topicos.map((t) => {
        const conteudo = (
          <>
            <PontoDeEstado estado={t.state} />
            <span>{t.name}</span>
            <span className="font-data text-muted tabular-nums">{decimal(t.perExam)}</span>
          </>
        );
        return (
          <li key={t.id}>
            {t.bank > 0 ? (
              <NavLink
                to={`/questoes?topicId=${encodeURIComponent(t.id)}`}
                className="chip inline-flex items-center gap-1.5 transition-colors hover:border-brand/40 hover:bg-surface"
                aria-label={`${rotuloDoAssunto(t)}. Ver questões`}
              >
                {conteudo}
              </NavLink>
            ) : (
              <span className="chip inline-flex items-center gap-1.5 opacity-70" aria-label={rotuloDoAssunto(t)}>
                {conteudo}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function OQueCai({ dados }: { dados: TrackDetail }) {
  const area = areaKey(dados.subject.area.name);
  const topicos = useMemo(
    () =>
      [...dados.stages.flatMap((s) => s.topics), ...dados.extras.topics].sort(
        (a, b) => b.perExam - a.perExam || b.years - a.years || a.name.localeCompare(b.name),
      ),
    [dados],
  );
  const maximo = Math.max(...topicos.map((t) => t.perExam), 0.0001);
  const janela: IncidenceWindow | null = dados.window;

  return (
    <section className="card card-raised" aria-label="Assuntos em ordem de incidência">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm text-muted text-pretty">
          Média de questões por prova {recorte(janela)}.
        </p>
        {janela && janela.exams > 1 && (
          <p className="font-data text-xs text-muted tabular-nums" aria-hidden>
            {janela.fromYear} → {janela.toYear}
          </p>
        )}
      </div>
      <ul className="divide-y divide-line">
        {topicos.map((t) => (
          <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,9rem)_auto] sm:px-5">
            <div className="min-w-0">
              {t.bank > 0 ? (
                <NavLink
                  to={`/questoes?topicId=${encodeURIComponent(t.id)}`}
                  className="font-semibold underline-offset-2 hover:text-brand hover:underline"
                >
                  {t.name}
                </NavLink>
              ) : (
                <span className="font-semibold">{t.name}</span>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <PontoDeEstado estado={t.state} />
                {ROTULO_DO_ESTADO[t.state]}
              </p>
            </div>

            <p className="whitespace-nowrap text-right text-sm sm:order-last">
              <span className="font-data font-semibold tabular-nums">{decimal(t.perExam)}</span>
              <span className="text-xs text-muted"> por prova</span>
              <span className="block text-xs text-muted">
                {t.accuracy === null ? (
                  'sem respostas'
                ) : (
                  <>
                    acerto <span className="font-data tabular-nums">{t.accuracy}%</span>
                  </>
                )}
              </span>
            </p>

            <div className="col-span-2 sm:col-span-1" aria-hidden>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`barra-enche h-full w-full origin-left rounded-full ${AREA_DOT[area]}`}
                  style={{ transform: `scaleX(${t.perExam / maximo})` }}
                />
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              {janela && <TiraDosAnos porAno={t.byYear} anos={janela.years} cor={AREA_DOT[area]} />}
              {janela && (
                <span className="shrink-0 text-xs text-muted sm:hidden" aria-hidden>
                  <span className="font-data tabular-nums">{t.years}</span>
                  {rotuloAnos(t.years, janela.exams).slice(String(t.years).length)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-xs text-muted text-pretty sm:px-5">
        Estimativa do OpENEM: o INEP não divulga o assunto de cada questão. A classificação foi feita por palavras-chave
        e por IA e pode errar.
      </p>
    </section>
  );
}
