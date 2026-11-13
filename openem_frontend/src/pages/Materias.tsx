import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api, type TracksOverview } from '../api';
import { useAuth } from '../auth';
import { ErrorBanner } from '../components/ErrorBanner';
import { IconCheck } from '../components/icons';
import { IconeDaMateria } from '../components/IconeDaMateria';
import { PageHeader } from '../components/PageHeader';
import { Skeleton } from '../components/Skeleton';
import { ComoCalculamos } from '../components/TrilhaUI';
import { AREA_SOFT, AREA_TEXT } from '../lib/areas';
import {
  alturaDoMapa,
  caminhoSuave,
  paradasDoMapa,
  posicoesNoCaminho,
  tracadoDoCaminho,
  type Parada,
  type Ponto,
} from '../lib/mapa-materias';
import { decimal, etapaAtual, etapasFeitas, lerPuladas, recorte } from '../lib/trilhas';
import '../mapa-materias.css';

/**
 * Matérias (discussão #122) como mapa de fases: um caminho no chão passa por
 * um ícone de cada matéria, na ordem das áreas da prova. O tamanho da ficha
 * diz quanto a matéria cai, o anel diz quanto o aluno domina e o marcador
 * aponta o próximo passo. Tocar numa matéria abre a trilha dela, onde também
 * estão os materiais gratuitos. Os números vêm de `GET /tracks`.
 */
export default function Materias() {
  const { me } = useAuth();
  const [dados, setDados] = useState<TracksOverview | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

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

  const subtitulo = !dados ? (
    'O que caiu nas provas regulares recentes e quanto disso você já domina.'
  ) : dados.overall.enough ? (
    <>
      Você domina cerca de{' '}
      <span className="font-data tabular-nums">{dados.overall.mastery}%</span> do que caiu{' '}
      {recorte(dados.window)}.
    </>
  ) : (
    `O que caiu ${recorte(dados.window)} e quanto disso você já domina.`
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Matérias" subtitle={subtitulo} />

      <ErrorBanner message={erro} onRetry={() => setRecarregar((k) => k + 1)} />

      {!dados ? (
        !erro && <Skeleton className="h-[36rem]" aria-busy />
      ) : (
        <>
          <Mapa dados={dados} userId={me?.id} />
          <ComoCalculamos janela={dados.window} />
        </>
      )}
    </div>
  );
}

function Mapa({ dados, userId }: { dados: TracksOverview; userId?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const mascara = useId();
  const puladas = useMemo(() => lerPuladas(userId), [userId]);
  const paradas = useMemo(() => paradasDoMapa(dados.subjects), [dados.subjects]);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(el.clientWidth);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sem medida (primeiro quadro, testes em jsdom), desenha na largura de celular.
  const w = largura || 360;
  const pontos = useMemo(() => posicoesNoCaminho(paradas.length, w), [paradas.length, w]);
  const d = useMemo(() => caminhoSuave(tracadoDoCaminho(pontos, w)), [pontos, w]);
  const altura = alturaDoMapa(paradas.length, w);
  const proximo = dados.suggestions[0]?.subjectId ?? null;
  const novato = dados.overall.answered === 0;

  return (
    <div ref={caixa} className="relative mx-auto w-full max-w-4xl" style={{ height: altura }}>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={w}
        height={altura}
        viewBox={`0 0 ${w} ${altura}`}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <mask id={mascara} maskUnits="userSpaceOnUse" x={-40} y={-80} width={w + 80} height={altura + 160}>
            <path d={d} stroke="white" strokeWidth={48} pathLength={1} className="mapa-desenho" />
          </mask>
        </defs>
        <g mask={`url(#${mascara})`}>
          {/* A sombra no chão, a borda, o leito e as pedras do caminho. */}
          <path d={d} stroke="var(--fg)" strokeOpacity={0.05} strokeWidth={36} transform="translate(0 5)" />
          <path d={d} stroke="var(--line)" strokeWidth={30} />
          <path d={d} stroke="var(--surface-2)" strokeWidth={24} />
          <path d={d} stroke="var(--muted)" strokeOpacity={0.45} strokeWidth={3.5} strokeDasharray="0.1 14" />
        </g>
      </svg>

      <ol aria-label="Mapa das matérias" className="relative">
        {paradas.map((p, i) => (
          <ParadaNoMapa
            key={p.id}
            parada={p}
            ponto={pontos[i]}
            ordem={i}
            puladas={new Set(p.tipo === 'materia' ? (puladas[p.id] ?? []) : [])}
            proximo={p.id === proximo}
            novato={novato}
          />
        ))}
      </ol>
    </div>
  );
}

/** Tamanho da ficha pelo quanto a matéria cai: marco grande no mapa é o que mais pesa. */
function tamanho(parada: Parada): { ficha: string; miolo: string; icone: number } {
  const n = parada.tipo === 'materia' ? parada.materia.perExam : 8;
  if (n >= 20) return { ficha: 'size-20', miolo: 'size-[3.75rem]', icone: 34 };
  if (n >= 8) return { ficha: 'size-[4.25rem]', miolo: 'size-[3.125rem]', icone: 28 };
  return { ficha: 'size-14', miolo: 'size-10', icone: 22 };
}

function ParadaNoMapa({
  parada: p,
  ponto,
  ordem,
  puladas,
  proximo,
  novato,
}: {
  parada: Parada;
  ponto: Ponto;
  ordem: number;
  puladas: ReadonlySet<string>;
  proximo: boolean;
  novato: boolean;
}) {
  const t = tamanho(p);
  const m = p.tipo === 'materia' ? p.materia : null;
  const feitas = m ? etapasFeitas(m.stages, puladas) : 0;
  const atual = m ? etapaAtual(m.stages, puladas) : null;
  const comecou = m ? m.answered > 0 || feitas > 0 : false;
  const concluida = m !== null && m.stages.length > 0 && atual === null;


  const rotulo = m
    ? [
        m.name,
        `${decimal(m.perExam)} questões por prova`,
        comecou ? `você domina ${m.mastery}%` : 'ainda não iniciada',
        concluida ? 'trilha concluída' : `etapa ${(atual ?? 0) + 1} de ${m.stages.length}`,
        proximo ? 'próximo passo' : null,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Redação, um texto de até 1.000 pontos, todos os temas desde 1998';

  return (
    <li
      className="absolute w-36"
      // O centro da ficha cai no ponto do caminho; o nome fica embaixo.
      style={{ left: ponto.x, top: ponto.y, transform: 'translate(-50%, -2.5rem)' }}
    >
      <NavLink
        to={m ? `/materias/${encodeURIComponent(m.id)}` : '/redacoes'}
        aria-label={rotulo}
        className="parada parada-entra flex flex-col items-center text-center"
        style={{ ['--i' as string]: ordem }}
      >
        <span className="relative grid h-20 place-items-center">
          {proximo && (
            <span className="parada-pino absolute bottom-[calc(100%-0.25rem)] left-1/2 z-10 whitespace-nowrap rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-ink shadow-[var(--shadow)]">
              {novato ? 'Comece aqui' : 'Próximo passo'}
              <span
                aria-hidden
                className="absolute left-1/2 top-full -ml-1 border-x-4 border-t-4 border-x-transparent border-t-brand"
              />
            </span>
          )}
          <span
            aria-hidden
            className="parada-sombra absolute bottom-0 left-1/2 -ml-7 h-3 w-14 rounded-[50%] bg-fg/10"
          />
          <span
            aria-hidden
            className={`parada-ficha relative grid place-items-center rounded-full border border-line bg-surface ${t.ficha}`}
          >
            {comecou && m && <AnelDeDominio valor={m.mastery} />}
            <span className={`grid place-items-center rounded-full ${t.miolo} ${AREA_SOFT[p.area]} ${AREA_TEXT[p.area]}`}>
              <IconeDaMateria nome={p.nome} width={t.icone} height={t.icone} weight="duotone" />
            </span>
            {concluida && (
              <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-brand text-brand-ink ring-2 ring-surface">
                <IconCheck width={13} height={13} weight="bold" />
              </span>
            )}
          </span>
        </span>
        {/* Recorte no fundo da página: onde o caminho passa por baixo do nome,
            o texto continua legível; no resto, o recorte é invisível. */}
        <span className="mt-2 rounded-md bg-bg px-1.5 font-display text-sm font-bold leading-tight text-balance">
          {p.nome}
        </span>
        <span className="rounded-md bg-bg px-1.5 text-xs text-muted">
          {!m ? (
            'Temas desde 1998'
          ) : concluida ? (
            'Trilha concluída'
          ) : comecou ? (
            <>
              <span className="font-data tabular-nums">{m.mastery}%</span> · etapa{' '}
              <span className="font-data tabular-nums">{(atual ?? 0) + 1}</span> de{' '}
              <span className="font-data tabular-nums">{m.stages.length}</span>
            </>
          ) : (
            'Não iniciada'
          )}
        </span>
      </NavLink>
    </li>
  );
}

/** Anel em volta da ficha: quanto da matéria o aluno domina, na cor da marca. */
function AnelDeDominio({ valor }: { valor: number }) {
  return (
    <svg className="absolute -inset-[5px] size-[calc(100%+10px)] -rotate-90" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="47" stroke="var(--line)" strokeWidth="4" />
      {/* Com 0%, a ponta arredondada desenharia um ponto rosa solto. */}
      {valor > 0 && (
        <circle
          cx="50"
          cy="50"
          r="47"
          stroke="var(--brand)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.min(100, valor)} 100`}
        />
      )}
    </svg>
  );
}
