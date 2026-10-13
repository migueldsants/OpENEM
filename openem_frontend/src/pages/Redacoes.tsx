import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import {
  IconChevronLeft,
  IconChevronRight,
  IconExpand,
  IconImage,
  IconPen,
} from '../components/icons';
import {
  agruparPorAno,
  contarFiguras,
  filtrarPropostas,
  FILTROS,
  tituloDaProposta,
  type BlocoRedacao,
  type FiltroAplicacao,
  type ParteTexto,
  type PropostaRedacao,
} from '../lib/redacoes';

/**
 * Texto com o negrito e o itálico do caderno. Sem `partes`, o texto é liso.
 */
function Texto({ texto, partes }: { texto: string; partes?: ParteTexto[] }) {
  if (!partes) return <>{texto}</>;
  return (
    <>
      {partes.map((p, i) => {
        const conteudo = p.i ? <em>{p.t}</em> : p.t;
        return p.b ? (
          <strong key={i}>{conteudo}</strong>
        ) : (
          <span key={i}>{conteudo}</span>
        );
      })}
    </>
  );
}

/** Um pedaço de texto motivador: título, parágrafo, versos, figura ou fonte. */
function Bloco({ b }: { b: BlocoRedacao }) {
  switch (b.t) {
    case 'titulo':
      return (
        <p className="text-center font-bold text-balance">
          <Texto texto={b.texto} partes={b.partes} />
        </p>
      );
    case 'verso':
      return (
        <p className="whitespace-pre-line">
          <Texto texto={b.texto} partes={b.partes} />
        </p>
      );
    case 'fonte':
      return (
        <p className="text-right text-xs leading-relaxed break-words text-muted">
          <Texto texto={b.texto} partes={b.partes} />
        </p>
      );
    case 'img':
      // Fundo branco fixo: as figuras vêm do caderno impresso, em preto sobre
      // branco, e ficariam ilegíveis sobre a superfície dos temas escuros.
      return (
        <img
          src={b.src}
          alt={b.alt}
          width={b.w}
          height={b.h}
          loading="lazy"
          className="mx-auto h-auto max-h-[80vh] w-auto max-w-full rounded-lg bg-white"
        />
      );
    default:
      return (
        <p className="text-pretty">
          <Texto texto={b.texto} partes={b.partes} />
        </p>
      );
  }
}

/** Atalho para a proposta vizinha na linha do tempo (mais recente ou mais antiga). */
function Vizinha({
  p,
  sentido,
  onAbrir,
}: {
  p: PropostaRedacao;
  sentido: 'recente' | 'antiga';
  onAbrir: (id: string) => void;
}) {
  const recente = sentido === 'recente';
  return (
    <button
      type="button"
      onClick={() => onAbrir(p.id)}
      className={`card flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-surface-2 active:translate-y-px ${
        recente ? 'text-left' : 'flex-row-reverse text-right sm:col-start-2'
      }`}
    >
      {recente ? (
        <IconChevronLeft width={18} height={18} className="shrink-0 text-muted" />
      ) : (
        <IconChevronRight width={18} height={18} className="shrink-0 text-muted" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted">
          {recente ? 'Mais recente' : 'Mais antiga'}
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-brand">
          ENEM {p.ano} · {p.aplicacaoRotulo}
        </span>
        {p.tema && (
          <span className="mt-0.5 line-clamp-2 text-sm font-semibold text-pretty">
            {p.tema}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * A proposta aberta. A página do caderno vem primeiro, inteira: é o documento
 * oficial. O que vem depois (comando e textos) é a transcrição dela. Em monitor
 * largo as duas ficam lado a lado, com a página fixa enquanto a transcrição
 * rola, para conferir uma contra a outra.
 */
function Proposta({
  p,
  recente,
  antiga,
  onAbrir,
  onVoltar,
}: {
  p: PropostaRedacao;
  recente?: PropostaRedacao;
  antiga?: PropostaRedacao;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 min-[1500px]:max-w-none">
      <button onClick={onVoltar} className="btn btn-ghost">
        <IconChevronLeft width={16} height={16} /> Todos os temas
      </button>

      <PageHeader
        eyebrow={`ENEM ${p.ano} · ${p.aplicacaoRotulo}`}
        title={p.tema || 'Proposta de redação'}
      />

      {p.semTema && (
        <p className="text-xs text-muted">
          O caderno desta prova não traz uma frase-tema. A proposta está
          inteira abaixo.
        </p>
      )}

      <div className="grid gap-8 min-[1500px]:grid-cols-2 min-[1500px]:items-start">
        <section className="space-y-3 min-[1500px]:sticky min-[1500px]:top-6 min-[1500px]:max-h-[calc(100dvh-3rem)] min-[1500px]:overflow-y-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-bold">Página do caderno</h2>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted">
              <IconExpand width={13} height={13} />
              Toque na página para ampliar
            </p>
          </div>
          {p.paginas.map((pg, n) => (
            // Fundo branco fixo: a página é o papel do caderno, em qualquer tema.
            <a
              key={pg.src}
              href={pg.src}
              target="_blank"
              rel="noreferrer"
              className="block cursor-zoom-in overflow-hidden rounded-lg border border-line bg-white"
            >
              <img
                src={pg.src}
                width={pg.w}
                height={pg.h}
                alt={`Página ${n + 1} da proposta de redação do ENEM ${p.ano}, como impressa no caderno. O conteúdo está transcrito nesta tela.`}
                className="h-auto w-full"
              />
            </a>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Transcrição</h2>

          {p.proposta && (
            <article
              aria-label="Proposta de redação"
              className="card card-raised p-5 sm:p-6"
            >
              <div className="mx-auto max-w-[70ch]">
                <h3 className="eyebrow text-brand">Proposta de redação</h3>
                <p className="mt-3 text-[0.9375rem] leading-7 text-pretty">
                  <Texto texto={p.proposta} partes={p.propostaPartes} />
                </p>
              </div>
            </article>
          )}

          {p.textos.map((t, n) => (
            // Até 2013 o caderno não numerava os textos: sem rótulo, nada é
            // inventado na tela (só o nome acessível, para leitor de tela).
            <article
              key={n}
              aria-label={t.rotulo || `Texto motivador ${n + 1}`}
              className="card p-5 sm:p-6"
            >
              <div className="mx-auto max-w-[70ch]">
                {t.rotulo && <h3 className="eyebrow mb-3 text-muted">{t.rotulo}</h3>}
                <div className="space-y-4 text-[0.9375rem] leading-7">
                  {t.blocos.map((b, i) => (
                    <Bloco key={i} b={b} />
                  ))}
                </div>
              </div>
            </article>
          ))}

          <p className="text-xs leading-relaxed text-muted">
            Extraído do caderno oficial do INEP, que é a referência em caso de
            divergência.{' '}
            <a
              href={p.fonteUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              Ver o caderno original (PDF)
            </a>
          </p>
        </section>
      </div>

      {(recente || antiga) && (
        <nav
          aria-label="Outras propostas"
          className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2"
        >
          {recente && <Vizinha p={recente} sentido="recente" onAbrir={onAbrir} />}
          {antiga && <Vizinha p={antiga} sentido="antiga" onAbrir={onAbrir} />}
        </nav>
      )}
    </div>
  );
}

/**
 * Redações: os temas oficiais do ENEM (aplicação regular, PPL/reaplicação e
 * as demais), cada um com a página do caderno, a proposta e os textos
 * motivadores. O catálogo é estático e entra num chunk à parte, só quando a
 * tela abre.
 */
export default function Redacoes() {
  const [lista, setLista] = useState<PropostaRedacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroAplicacao>('todas');
  const [busca, setBusca] = useState('');
  const [params, setParams] = useSearchParams();
  const aberta = params.get('tema');

  useEffect(() => {
    let vivo = true;
    import('../data/redacoes.json')
      .then((m) => vivo && setLista(m.default as PropostaRedacao[]))
      .catch(() => vivo && setErro('Não foi possível carregar os temas.'));
    return () => {
      vivo = false;
    };
  }, []);

  // Trocar de tema ou voltar para a lista começa do alto da página.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [aberta]);

  const grupos = useMemo(
    () => agruparPorAno(filtrarPropostas(lista ?? [], filtro, busca)),
    [lista, filtro, busca],
  );
  const abrir = (id: string) => setParams({ tema: id });
  const indice = aberta && lista ? lista.findIndex((p) => p.id === aberta) : -1;

  if (lista && indice >= 0) {
    // O catálogo vem do mais recente para o mais antigo.
    return (
      <Proposta
        p={lista[indice]}
        recente={lista[indice - 1]}
        antiga={lista[indice + 1]}
        onAbrir={abrir}
        onVoltar={() => setParams({})}
      />
    );
  }

  const total = grupos.reduce((n, g) => n + g.propostas.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Propostas oficiais do ENEM"
        title="Redações"
        subtitle="Todos os temas de redação do ENEM desde 1998, da aplicação regular, do PPL e das reaplicações, com a página do caderno e os textos motivadores."
      />

      <div className="space-y-3">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por tema ou ano"
          aria-label="Buscar tema de redação"
          className="input w-full"
        />
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              data-active={filtro === f.key}
              aria-pressed={filtro === f.key}
              className="chip"
            >
              {f.label}
            </button>
          ))}
          {lista !== null && total > 0 && (
            <p
              aria-live="polite"
              className="ml-auto self-center text-xs tabular-nums text-muted"
            >
              {total} {total === 1 ? 'proposta' : 'propostas'}
            </p>
          )}
        </div>
      </div>

      {erro && <ErrorBanner message={erro} />}

      {lista === null && !erro ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : grupos.length === 0 && !erro ? (
        <EmptyState
          icon={IconPen}
          title="Nenhum tema encontrado"
          description="Nenhum tema combina com essa busca."
          tip="Tente só o ano ou uma palavra do tema"
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(({ ano, propostas }) => (
            // No monitor, o ano vira uma régua à esquerda e acompanha a rolagem.
            <section
              key={ano}
              className="grid gap-x-6 gap-y-2 md:grid-cols-[4.5rem_minmax(0,1fr)]"
            >
              <h2 className="font-display text-lg font-bold tabular-nums md:sticky md:top-6 md:self-start md:pt-3 md:text-2xl md:text-muted">
                {ano}
              </h2>
              <ul className="card card-raised divide-y divide-line overflow-hidden">
                {propostas.map((p) => {
                  const figuras = contarFiguras(p);
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => abrir(p.id)}
                        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-brand">
                            {p.aplicacaoRotulo}
                          </span>
                          {/* Sem frase-tema no caderno, a linha mostra o
                              começo do próprio comando, sem título inventado. */}
                          <span
                            className={`mt-1 block text-pretty ${
                              p.tema
                                ? 'text-[0.9375rem] font-semibold'
                                : 'line-clamp-2 text-sm text-muted'
                            }`}
                          >
                            {tituloDaProposta(p)}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                            <span>
                              {p.textos.length}{' '}
                              {p.textos.length === 1 ? 'texto' : 'textos'}
                            </span>
                            {figuras > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <IconImage width={13} height={13} />
                                {figuras} {figuras === 1 ? 'figura' : 'figuras'}
                              </span>
                            )}
                          </span>
                        </span>
                        <IconChevronRight
                          width={18}
                          height={18}
                          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
