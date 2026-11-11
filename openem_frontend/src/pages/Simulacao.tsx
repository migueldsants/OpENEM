import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight } from '../components/icons';
import { Dimensao } from '../components/simulacoes/Bancada';
import { ExplicacaoCtx } from '../components/simulacoes/contexto';
import { REGISTRO } from '../components/simulacoes/registro';
import { MATERIAS_SIM, simulacaoPorSlug, simulacoesDaMateria, SLUG_DA_MATERIA } from '../lib/simulacoes/catalogo';

/** Anterior e próxima seguem a ordem das telas de matéria, passando de uma matéria para a outra. */
const ORDEM = MATERIAS_SIM.flatMap((m) => simulacoesDaMateria(m));

/** Se uma simulação quebrar (driver de vídeo, falta de memória), a tela continua de pé. */
class Contencao extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    if (this.state.erro) {
      return (
        <div className="card p-6 text-sm text-muted" role="alert">
          A simulação não conseguiu rodar neste aparelho. Recarregue a página ou tente outra simulação.
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Uma simulação, inteira na tela do computador: cabeçalho de uma linha (o
 * caminho, o título, "Entenda" e anterior/próxima), e embaixo a cena com os
 * controles. A explicação abre num modal (`Explicacao` desenha o botão no
 * lugar marcado aqui), para nada empurrar a cena para baixo.
 */
export default function Simulacao() {
  const { slug } = useParams();
  const info = simulacaoPorSlug(slug);
  const Sim = slug ? REGISTRO[slug] : undefined;
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const lugar = useMemo(() => (info ? { slot, info } : null), [slot, info]);
  if (!info || !Sim || !lugar) return <Navigate to="/simulacoes" replace />;

  const i = ORDEM.indexOf(info);
  const anterior = ORDEM[(i - 1 + ORDEM.length) % ORDEM.length];
  const proxima = ORDEM[(i + 1) % ORDEM.length];
  const urlMateria = `/simulacoes/${SLUG_DA_MATERIA[info.materia]}`;

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.5rem)]">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <nav aria-label="Caminho" className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Link to="/simulacoes" className="hover:text-fg">
              Simulações
            </Link>
            <span aria-hidden>/</span>
            <Link to={urlMateria} className="hover:text-fg">
              {info.materia}
            </Link>
          </nav>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{info.titulo}</h1>
            <Dimensao s={info} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div ref={setSlot} className="contents" />
          <nav aria-label="Outras simulações" className="flex items-center gap-1">
            <Link to={`/simulacoes/${anterior.slug}`} className="btn btn-ghost px-2.5" aria-label={`Anterior: ${anterior.titulo}`} title={anterior.titulo}>
              <IconChevronLeft width={18} height={18} />
            </Link>
            <Link to={`/simulacoes/${proxima.slug}`} className="btn btn-ghost px-2.5" aria-label={`Próxima: ${proxima.titulo}`} title={proxima.titulo}>
              <IconChevronRight width={18} height={18} />
            </Link>
          </nav>
        </div>
      </header>
      <div className="lg:min-h-0 lg:flex-1">
        <ExplicacaoCtx.Provider value={lugar}>
          <Contencao key={info.slug}>
            <Suspense
              fallback={
                <div className="grid min-h-[50vh] place-items-center text-sm text-muted" aria-busy>
                  Carregando a simulação…
                </div>
              }
            >
              <Sim />
            </Suspense>
          </Contencao>
        </ExplicacaoCtx.Provider>
      </div>
    </div>
  );
}
