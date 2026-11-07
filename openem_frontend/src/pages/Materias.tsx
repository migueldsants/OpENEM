import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  api,
  type TrackSubjectSummary,
  type TrackSuggestion,
  type TracksOverview,
} from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconChevronRight } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { BarraDeDominio, ComoCalculamos, QuestoesPorProva } from '../components/TrilhaUI';
import { AREA_DOT, AREA_TEXT, areaCurta, areaKey, type AreaKey } from '../lib/areas';
import {
  decimal,
  etapaAtual,
  etapasFeitas,
  lerPuladas,
  ORDEM_DAS_AREAS,
  recorte,
  RESPOSTAS_PARA_PORCENTAGEM,
} from '../lib/trilhas';

/**
 * Matérias (discussão #122): o que cai em cada matéria nas provas regulares
 * recentes e quanto disso o aluno domina. Cada linha abre a trilha da
 * matéria. Os números vêm de `GET /tracks`.
 */
export default function Materias() {
  const { me } = useAuth();
  const [dados, setDados] = useState<TracksOverview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const puladas = useMemo(() => lerPuladas(me?.id), [me?.id]);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    api
      .tracks()
      .then((d) => vivo && setDados(d))
      .catch(
        () =>
          vivo &&
          setErro('Não foi possível carregar as matérias. Verifique sua conexão.'),
      );
    return () => {
      vivo = false;
    };
  }, [recarregar]);

  const grupos = useMemo(() => agrupar(dados?.subjects ?? []), [dados]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matérias"
        subtitle={`O que caiu ${dados ? recorte(dados.window) : 'nas provas regulares recentes'} e quanto disso você já domina.`}
      />

      <ErrorBanner message={erro} onRetry={() => setRecarregar((k) => k + 1)} />

      {!dados ? (
        !erro && (
          <div className="space-y-6" aria-busy>
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        )
      ) : (
        <>
          <Resumo dados={dados} />

          {grupos.map(({ area, nome, materias }) => (
            <section key={area} aria-labelledby={`area-${area}`} className="space-y-3">
              <h2 id={`area-${area}`} className={`font-display text-lg font-bold ${AREA_TEXT[area]}`}>
                {nome}
              </h2>
              <ul className="card divide-y divide-line">
                {materias.map((m) => (
                  <li key={m.id}>
                    <LinhaDaMateria materia={m} area={area} puladas={new Set(puladas[m.id] ?? [])} />
                  </li>
                ))}
                {area === 'lin' && (
                  <li>
                    <NavLink
                      to="/redacoes"
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span aria-hidden className={`h-9 w-1 shrink-0 rounded-full ${AREA_DOT.red}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">Redação</span>
                        <span className="block text-xs text-muted">
                          1 texto, até 1.000 pontos. Veja todos os temas desde 1998.
                        </span>
                      </span>
                      <IconChevronRight width={16} height={16} aria-hidden className="shrink-0 text-muted" />
                    </NavLink>
                  </li>
                )}
              </ul>
            </section>
          ))}

          <ComoCalculamos janela={dados.window} />
        </>
      )}
    </div>
  );
}

function agrupar(materias: TrackSubjectSummary[]) {
  const porArea = new Map<AreaKey, TrackSubjectSummary[]>();
  for (const m of materias) {
    const k = areaKey(m.area.name);
    porArea.set(k, [...(porArea.get(k) ?? []), m]);
  }
  return ORDEM_DAS_AREAS.flatMap((area) => {
    const lista = porArea.get(area);
    if (!lista?.length) return [];
    return [
      {
        area,
        nome: areaCurta(lista[0].area.name),
        materias: [...lista].sort((a, b) => b.perExam - a.perExam || a.name.localeCompare(b.name)),
      },
    ];
  });
}

function LinhaDaMateria({
  materia: m,
  area,
  puladas,
}: {
  materia: TrackSubjectSummary;
  area: AreaKey;
  puladas: ReadonlySet<string>;
}) {
  const feitas = etapasFeitas(m.stages, puladas);
  const atual = etapaAtual(m.stages, puladas);
  const comecou = m.answered > 0 || feitas > 0;
  return (
    <NavLink
      to={`/materias/${encodeURIComponent(m.id)}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <span aria-hidden className={`h-9 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{m.name}</span>
        <span className="block text-xs text-muted">
          <QuestoesPorProva n={m.perExam} />
          {' · '}
          {atual === null
            ? 'trilha concluída'
            : `etapa ${atual + 1} de ${m.stages.length}`}
        </span>
      </span>
      {/* O leitor de tela ouve a frase do sr-only abaixo, não o número solto. */}
      <span aria-hidden className="flex w-20 shrink-0 flex-col items-end gap-1 sm:w-28">
        {comecou ? (
          <>
            <span className="font-data text-sm font-semibold tabular-nums">{m.mastery}%</span>
            <BarraDeDominio valor={m.mastery} className="w-full" />
          </>
        ) : (
          <span className="text-xs text-muted">não iniciada</span>
        )}
      </span>
      <span className="sr-only">
        {comecou ? `, você domina ${m.mastery}%` : ', ainda não iniciada'}
      </span>
      <IconChevronRight width={16} height={16} aria-hidden className="shrink-0 text-muted" />
    </NavLink>
  );
}

/** O cartão do topo: quanto o aluno domina ou, antes disso, por onde começar. */
function Resumo({ dados }: { dados: TracksOverview }) {
  const { overall, suggestions } = dados;
  if (overall.enough) {
    const proxima = suggestions[0];
    return (
      <section className="card card-raised space-y-4 p-4 sm:p-5" aria-labelledby="resumo-dominio">
        <div>
          <h2 id="resumo-dominio" className="font-display text-xl font-extrabold text-balance">
            Você domina cerca de <span className="font-data tabular-nums">{overall.mastery}%</span> do que cai
          </h2>
          <BarraDeDominio valor={overall.mastery} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted text-pretty">
            Pelas suas últimas respostas em{' '}
            <span className="font-data tabular-nums">{overall.answered.toLocaleString('pt-BR')}</span> questões com
            assunto, pesando cada assunto pelo quanto ele cai.{' '}
            <a href="#como-calculamos" className="font-medium text-brand underline-offset-2 hover:underline">
              Como calculamos
            </a>
          </p>
        </div>
        {proxima && (
          <div className="border-t border-line pt-4">
            <Sugestao sugestao={proxima} principal rotulo="Próximo passo" />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card card-raised p-4 sm:p-5" aria-labelledby="por-onde-comecar">
      <h2 id="por-onde-comecar" className="font-display text-xl font-extrabold">
        Por onde começar
      </h2>
      <p className="mt-1 text-sm text-muted text-pretty">
        As etapas que mais rendem agora, pelo que caiu nas últimas provas. Cada etapa
        tem um simulado curto com questões que já caíram no ENEM.
      </p>
      {suggestions.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {suggestions.map((s, i) => (
            <li key={s.subjectId} className="py-3 first:pt-1 last:pb-0">
              <Sugestao sugestao={s} principal={i === 0} />
            </li>
          ))}
        </ul>
      )}
      {overall.answered > 0 && (
        <p className="mt-3 text-xs text-muted text-pretty">
          Com <span className="font-data tabular-nums">{RESPOSTAS_PARA_PORCENTAGEM}</span> respostas em
          questões com assunto, esta tela mostra quanto você já domina do que cai (você tem{' '}
          <span className="font-data tabular-nums">{overall.answered}</span>).
        </p>
      )}
    </section>
  );
}

function Sugestao({
  sugestao: s,
  principal,
  rotulo,
}: {
  sugestao: TrackSuggestion;
  principal: boolean;
  rotulo?: string;
}) {
  const area = areaKey(s.areaName);
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`h-10 w-1 shrink-0 rounded-full ${AREA_DOT[area]}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">
          {rotulo ? `${rotulo}: ` : ''}
          {s.subjectName}, etapa <span className="font-data tabular-nums">{decimal(s.stageIndex + 1)}</span>
        </p>
        <p className="font-semibold text-balance">{s.title}</p>
      </div>
      <NavLink
        to={`/materias/${encodeURIComponent(s.subjectId)}`}
        className={`btn shrink-0 px-3 py-1.5 text-sm ${principal ? 'btn-primary' : 'btn-ghost'}`}
        aria-label={`Abrir a trilha de ${s.subjectName}`}
      >
        Abrir trilha
      </NavLink>
    </div>
  );
}
