import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CATEGORIAS,
  ROTULO_ESTADO,
  ROTULO_FONTE,
  abundanciaTexto,
  comIncerteza,
  decimalBr,
  evParaKjMol,
  grupoTexto,
  kelvinParaCelsius,
  massaCurta,
  meiaVidaTexto,
  numeroBr,
  oxidacaoTexto,
  rotuloCategoria,
  sobrescrito,
  type Catalogo,
  type Elemento,
} from '../../lib/elementos';
import {
  CAMADAS,
  excecaoAufbau,
  formatar,
  formatarAbreviada,
  lerConfiguracao,
  maisEnergetico,
  ordemEnergetica,
  ordemGeometrica,
  porCamada,
  valencia,
  type Subnivel,
} from '../../lib/configuracao-eletronica';
import { IconChevronLeft, IconChevronRight, IconCopy, IconX } from '../icons';
import { Portal, useDialog } from '../Modal';
import { Expoentes } from './Expoentes';
import { estiloTom } from './Grade';

function Fonte({ id, catalogo }: { id?: string; catalogo: Catalogo }) {
  if (!id) return null;
  const f = catalogo.fontes[id];
  if (!f) return null;
  return (
    <a href={f.url} target="_blank" rel="noreferrer" className="tp-fonte" title={f.nome}>
      {ROTULO_FONTE[id] ?? id}
    </a>
  );
}

function Marca({ children }: { children: ReactNode }) {
  return <span className="tp-marca">{children}</span>;
}

function Desconhecido({ texto = 'desconhecido' }: { texto?: string }) {
  return <span className="text-muted">{texto}</span>;
}

/** Uma linha da ficha: rótulo à esquerda, valor e fonte à direita. */
function Dado({ rotulo, fonte, catalogo, children }: { rotulo: ReactNode; fonte?: string; catalogo: Catalogo; children: ReactNode }) {
  return (
    <div className="tp-dado">
      <dt className="text-xs font-medium text-muted">{rotulo}</dt>
      <dd className="min-w-0 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">{children}</div>
        {fonte && (
          <div className="mt-0.5">
            <Fonte id={fonte} catalogo={catalogo} />
          </div>
        )}
      </dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="font-display text-base font-bold">{titulo}</h3>
      <dl className="mt-1">{children}</dl>
    </section>
  );
}

const num = (s: string | number) => (
  <span className="font-data tabular-nums">{typeof s === 'string' ? <Expoentes texto={s} /> : s}</span>
);

function Temperatura({ k, estimado }: { k: number; estimado?: boolean }) {
  return (
    <>
      {num(`${numeroBr(kelvinParaCelsius(k), 1)} °C`)}
      <span className="font-data text-xs text-muted tabular-nums">{numeroBr(k, 2)} K</span>
      {estimado && <Marca>estimado</Marca>}
    </>
  );
}

function Massa({ e, catalogo }: { e: Elemento; catalogo: Catalogo }) {
  const { padrao, abreviado, numeroMassa } = e.massa;
  return (
    <>
      <Dado rotulo="Massa atômica padrão" fonte={e.fontes.massa} catalogo={catalogo}>
        {padrao && 'intervalo' in padrao && (
          <>
            {num(`[${decimalBr(padrao.intervalo[0])}; ${decimalBr(padrao.intervalo[1])}]`)}
            <span className="text-xs text-muted">intervalo: a composição isotópica varia na natureza</span>
          </>
        )}
        {padrao && 'valor' in padrao && num(comIncerteza(padrao))}
        {!padrao && numeroMassa && (
          <>
            {num(`[${numeroMassa}]`)}
            <span className="text-xs text-muted">sem isótopo estável: número de massa do isótopo de vida mais longa</span>
          </>
        )}
      </Dado>
      {abreviado && (
        <Dado rotulo="Valor abreviado" fonte={e.fontes.abreviado} catalogo={catalogo}>
          {num(`${decimalBr(abreviado.valor)} ± ${decimalBr(abreviado.incerteza)}`)}
          <span className="text-xs text-muted">o dos livros e o das contas</span>
        </Dado>
      )}
    </>
  );
}

/** Cr, Cu, Mo, Ag, Pd, Au: o d fica com 5 ou 10 elétrons à custa do s. */
function dCompletaOuMetade(e: Elemento, real: Subnivel[], prevista: Subnivel[]): boolean {
  if (e.bloco !== 'd') return false;
  const d = (lista: Subnivel[]) => lista.find((s) => s.l === 'd' && s.n === e.periodo - 1)?.e ?? 0;
  return (d(real) === 5 || d(real) === 10) && d(real) > d(prevista);
}

function Configuracao({ e, catalogo, onDistribuicao }: { e: Elemento; catalogo: Catalogo; onDistribuicao: () => void }) {
  const c = lerConfiguracao(e.configuracao);
  const camadas = porCamada(c);
  const val = valencia(c);
  const ultimo = maisEnergetico(c);
  const prevista = excecaoAufbau(c);
  return (
    <Secao titulo="Configuração eletrônica">
      <Dado rotulo="Ordem energética (Pauling)" fonte={e.fontes.configuracao} catalogo={catalogo}>
        {num(formatar(ordemEnergetica(c)))}
        {e.configuracaoPrevista && <Marca>prevista</Marca>}
      </Dado>
      <Dado rotulo="Ordem geométrica" catalogo={catalogo}>
        {num(formatar(ordemGeometrica(c)))}
      </Dado>
      <Dado rotulo="Abreviada" catalogo={catalogo}>
        {num(formatarAbreviada(c))}
      </Dado>
      <Dado rotulo="Elétrons por camada" catalogo={catalogo}>
        <span className="flex flex-wrap gap-1.5">
          {camadas.map((n, i) => (
            <span key={i} className="tp-marca font-data">
              {CAMADAS[i]} {n}
            </span>
          ))}
        </span>
      </Dado>
      <Dado rotulo="Camada de valência" catalogo={catalogo}>
        <span>
          {val.camada} (n = {val.n}), {num(val.eletrons)} {val.eletrons === 1 ? 'elétron' : 'elétrons'}
        </span>
      </Dado>
      {ultimo && (
        <Dado rotulo="Subnível mais energético" catalogo={catalogo}>
          {num(formatar([ultimo]))}
        </Dado>
      )}
      {prevista && (
        <div className="mt-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm">
          <p className="font-semibold">Exceção ao diagrama de Pauling</p>
          <p className="mt-1 text-muted">
            Pelo diagrama seria <span className="font-data text-fg"><Expoentes texto={formatarAbreviada(prevista)} /></span>; a configuração
            real é <span className="font-data text-fg"><Expoentes texto={formatarAbreviada(c)} /></span>.
            {dCompletaOuMetade(e, c, prevista) &&
              ' Elétrons do subnível s passam para o d, que fica semipreenchido (d⁵) ou completo (d¹⁰), um arranjo de menor energia.'}
          </p>
        </div>
      )}
      <button type="button" className="btn btn-ghost mt-3 w-full text-sm" onClick={onDistribuicao}>
        Ver a distribuição passo a passo
      </button>
    </Secao>
  );
}

function Propriedades({ e, catalogo }: { e: Elemento; catalogo: Catalogo }) {
  const ie = e.energiaIonizacao;
  const af = e.afinidade;
  const nobreSemLigacao = e.categoria === 'gas-nobre' && e.eletronegatividade == null;
  return (
    <Secao titulo="Propriedades periódicas">
      <Dado rotulo="Eletronegatividade (Pauling)" fonte={e.fontes.eletronegatividade} catalogo={catalogo}>
        {e.eletronegatividade ? (
          <>
            {num(numeroBr(e.eletronegatividade.valor))}
            {e.eletronegatividade.estimado && <Marca>estimada</Marca>}
          </>
        ) : (
          <Desconhecido texto={nobreSemLigacao ? 'não tem (quase não forma ligações)' : 'desconhecida'} />
        )}
      </Dado>
      <Dado rotulo="Raio covalente" fonte={e.fontes.raio} catalogo={catalogo}>
        {e.raio ? (
          <>
            {num(`${e.raio.valor} pm`)}
            {e.raio.estimado && <Marca>calculado</Marca>}
          </>
        ) : (
          <Desconhecido />
        )}
      </Dado>
      <Dado rotulo="1ª energia de ionização" fonte={e.fontes.energiaIonizacao} catalogo={catalogo}>
        {ie ? (
          <>
            {num(`${numeroBr(evParaKjMol(Number(ie.ev)), 1)} kJ/mol`)}
            <span className="font-data text-xs text-muted tabular-nums">{decimalBr(ie.ev)} eV</span>
            {ie.estimado === 'semiempirica' && <Marca>estimada</Marca>}
            {ie.estimado === 'teorica' && <Marca>calculada</Marca>}
          </>
        ) : (
          <Desconhecido texto="desconhecida" />
        )}
      </Dado>
      <Dado rotulo="Afinidade eletrônica" fonte={e.fontes.afinidade} catalogo={catalogo}>
        {af == null ? (
          <Desconhecido texto="desconhecida" />
        ) : 'anionInstavel' in af ? (
          <span>não forma ânion estável (afinidade negativa ou nula)</span>
        ) : (
          <>
            {num(`${numeroBr(evParaKjMol(af.ev), 1)} kJ/mol`)}
            <span className="font-data text-xs text-muted tabular-nums">{numeroBr(af.ev, 4)} eV</span>
            {af.estimado && <Marca>estimada</Marca>}
          </>
        )}
      </Dado>
      <Dado rotulo="Estados de oxidação" fonte={e.fontes.oxidacao} catalogo={catalogo}>
        {e.oxidacao.todos.length === 0 ? (
          <span>não forma compostos estáveis</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {e.oxidacao.todos.map((o) => {
              const comum = e.oxidacao.comuns.includes(o);
              return (
                <span
                  key={o}
                  className={`tp-marca font-data ${comum ? 'border-fg font-bold' : 'font-normal text-muted'}`}
                  title={comum ? 'Estado mais comum' : undefined}
                >
                  {oxidacaoTexto(o)}
                </span>
              );
            })}
          </span>
        )}
        {e.oxidacao.comuns.length > 0 && <span className="w-full text-xs text-muted">em negrito, os mais comuns</span>}
        {e.oxidacaoPrevista && <Marca>previstos ou vistos com poucos átomos</Marca>}
      </Dado>
    </Secao>
  );
}

function Fisicas({ e, catalogo }: { e: Elemento; catalogo: Catalogo }) {
  const d = e.densidade;
  return (
    <Secao titulo="Propriedades físicas">
      <Dado rotulo="Estado a 25 °C e 1 atm" fonte={e.fontes.estadoPrevisto ?? e.fontes.fusao} catalogo={catalogo}>
        {e.estado ? (
          <span>{ROTULO_ESTADO[e.estado]}</span>
        ) : (
          <>
            <Desconhecido />
            {e.estadoPrevisto && <Marca>previsto: {ROTULO_ESTADO[e.estadoPrevisto].toLowerCase()}</Marca>}
          </>
        )}
      </Dado>
      <Dado rotulo="Densidade" fonte={e.fontes.densidade} catalogo={catalogo}>
        {d ? (
          <>
            {num(`${numeroBr(d.valor, d.valor < 0.1 ? 6 : 3)} g/cm³`)}
            {e.estado === 'gasoso' && (
              <span className="font-data text-xs text-muted tabular-nums">{numeroBr(d.valor * 1000, 4)} g/L</span>
            )}
            {d.estimado && <Marca>estimada</Marca>}
          </>
        ) : (
          <Desconhecido texto="desconhecida" />
        )}
      </Dado>
      <Dado rotulo="Ponto de fusão" fonte={e.fontes.fusao} catalogo={catalogo}>
        {e.fusao ? (
          <Temperatura k={e.fusao.k} estimado={e.fusao.estimado} />
        ) : e.semFusao === 'sublima' ? (
          <span>não funde a 1 atm: sublima</span>
        ) : e.semFusao === 'nao-solidifica' ? (
          <span>não solidifica a 1 atm</span>
        ) : (
          <Desconhecido />
        )}
      </Dado>
      <Dado rotulo={e.semFusao === 'sublima' ? 'Ponto de sublimação' : 'Ponto de ebulição'} fonte={e.fontes.ebulicao} catalogo={catalogo}>
        {e.ebulicao ? <Temperatura k={e.ebulicao.k} estimado={e.ebulicao.estimado} /> : <Desconhecido />}
      </Dado>
    </Secao>
  );
}

function Nucleo({ e, catalogo }: { e: Elemento; catalogo: Catalogo }) {
  const mais = e.isotopoMaisEstavel;
  return (
    <Secao titulo="Núcleo e origem">
      <Dado rotulo="Isótopos naturais" fonte={e.fontes.isotopos} catalogo={catalogo}>
        {e.isotopos.length ? (
          <span className="flex flex-wrap gap-1.5">
            {e.isotopos.map((i) => (
              <span key={i.a} className="tp-marca font-data font-normal">
                <sup className="tp-expoente">{i.a}</sup>
                {e.simbolo} {abundanciaTexto(i.abundancia)}
              </span>
            ))}
          </span>
        ) : (
          <span>nenhum com abundância medida</span>
        )}
      </Dado>
      <Dado rotulo="Radioativo" fonte={e.fontes.radioativo} catalogo={catalogo}>
        <span>{e.radioativo ? 'Sim, não tem isótopo estável' : 'Não, tem isótopo estável'}</span>
      </Dado>
      {mais && (
        <Dado rotulo="Isótopo de vida mais longa" fonte={e.fontes.isotopoMaisEstavel} catalogo={catalogo}>
          {num(`${sobrescrito(mais.a)}${e.simbolo}`)}
          {mais.meiaVida && <span>meia-vida de {meiaVidaTexto(mais.meiaVida)}</span>}
        </Dado>
      )}
      <Dado rotulo="Natural ou sintético" fonte={e.fontes.natural} catalogo={catalogo}>
        <span>
          {e.natural
            ? 'Natural'
            : e.z === 43 || e.z === 61
              ? 'Sintético (só traços na natureza)'
              : e.z <= 94
                ? 'Sintético (traços em minério de urânio)'
                : 'Sintético'}
        </span>
      </Dado>
    </Secao>
  );
}

/**
 * Ficha completa de um elemento: painel lateral no desktop, folha que sobe no
 * celular. Esc fecha, o foco fica preso nela e volta para a casa ao fechar.
 */
export function Ficha({
  e,
  catalogo,
  onFechar,
  onNavegar,
  onDistribuicao,
  onComparar,
}: {
  e: Elemento;
  catalogo: Catalogo;
  onFechar: () => void;
  onNavegar: (z: number) => void;
  onDistribuicao: (z: number) => void;
  onComparar: (z: number) => void;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const [saindo, setSaindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const fechar = () => {
    if (saindo) return;
    setSaindo(true);
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(onFechar, reduzido ? 0 : 170);
  };
  useDialog(painel, fechar);

  // Trocar de elemento volta ao topo da ficha.
  useEffect(() => {
    painel.current?.querySelector('[data-rolagem]')?.scrollTo?.(0, 0);
  }, [e.z]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };

  const familia = catalogo.familias[e.categoria];
  const plural = CATEGORIAS.find((c) => c.key === e.categoria)?.plural ?? '';

  return (
    <Portal>
      <div className="tp">
        <div className="tp-ficha-fundo" data-saindo={saindo || undefined} onClick={fechar} />
        <div
          ref={painel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-ficha-titulo"
          tabIndex={-1}
          className="tp-ficha"
          data-saindo={saindo || undefined}
        >
          <header className="flex items-start gap-4 px-5 pb-4 pt-5">
            <div className="tp-ficha-tile" style={estiloTom({ tom: e.categoria, passo: null, estimado: false })}>
              <span className="font-data text-xs tabular-nums">{e.z}</span>
              <span className="self-center font-display text-4xl font-extrabold leading-none tracking-tight">{e.simbolo}</span>
              <span className="font-data text-[0.6875rem] tabular-nums">{massaCurta(e)}</span>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 id="tp-ficha-titulo" className="font-display text-2xl font-extrabold tracking-tight">
                {e.nome}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                <span lang="en">{e.nomeEn}</span>
                {e.variantes && <> · também {e.variantes.join(', ').toLowerCase()}</>}
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                <Marca>{rotuloCategoria(e)}</Marca>
                <Marca>
                  Período {e.periodo} · Grupo {e.grupo} ({e.grupoAntigo})
                </Marca>
              </p>
            </div>
            <button type="button" className="btn btn-ghost -mr-2 -mt-1 p-2" aria-label="Fechar a ficha" onClick={fechar}>
              <IconX width={18} height={18} />
            </button>
          </header>

          <div data-rolagem className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <section className="border-t border-line px-5 py-4">
              <h3 className="font-display text-base font-bold">Química</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty">{e.quimica}</p>
              {familia && (
                <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
                  <span className="font-semibold text-fg">{plural}.</span> {familia}
                </p>
              )}
              <p className="mt-1.5">
                <Fonte id="openem" catalogo={catalogo} />
              </p>
            </section>

            <Secao titulo="Massa atômica">
              <Massa e={e} catalogo={catalogo} />
            </Secao>

            <Secao titulo="Posição na tabela">
              <Dado rotulo="Período" fonte={e.fontes.posicao} catalogo={catalogo}>
                {num(e.periodo)}
              </Dado>
              <Dado rotulo="Grupo (IUPAC e antigo)" catalogo={catalogo}>
                <span>{grupoTexto(e)}</span>
              </Dado>
              <Dado rotulo="Família" catalogo={catalogo}>
                {e.familia ? <span className="first-letter:uppercase">{e.familia}</span> : <span className="text-muted">sem nome de família</span>}
              </Dado>
              <Dado rotulo="Bloco" catalogo={catalogo}>
                <span>{e.bloco}</span>
              </Dado>
              <Dado rotulo="Categoria" fonte={e.fontes.categoria} catalogo={catalogo}>
                <span>{rotuloCategoria(e)}</span>
              </Dado>
            </Secao>

            <Configuracao e={e} catalogo={catalogo} onDistribuicao={() => onDistribuicao(e.z)} />
            <Propriedades e={e} catalogo={catalogo} />
            <Fisicas e={e} catalogo={catalogo} />
            <Nucleo e={e} catalogo={catalogo} />
          </div>

          <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
            <button
              type="button"
              className="btn btn-ghost p-2"
              aria-label="Elemento anterior"
              disabled={e.z === 1}
              onClick={() => onNavegar(e.z - 1)}
            >
              <IconChevronLeft width={16} height={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost p-2"
              aria-label="Próximo elemento"
              disabled={e.z === 118}
              onClick={() => onNavegar(e.z + 1)}
            >
              <IconChevronRight width={16} height={16} />
            </button>
            <button type="button" className="btn btn-ghost ml-auto px-3 text-sm" onClick={() => onComparar(e.z)}>
              Comparar
            </button>
            <button type="button" className="btn btn-ghost px-3 text-sm" onClick={copiar} aria-live="polite">
              <IconCopy width={16} height={16} />
              {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
