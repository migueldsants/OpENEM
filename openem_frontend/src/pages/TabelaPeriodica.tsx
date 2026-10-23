import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { PageHeader } from '../components/PageHeader';
import { SkeletonCard } from '../components/Skeleton';
import { IconChevronRight, IconTabelaPeriodica, IconX } from '../components/icons';
import { Comparar } from '../components/tabela/Comparar';
import { Distribuicao } from '../components/tabela/Distribuicao';
import { Ficha } from '../components/tabela/Ficha';
import { Grade, estiloTom } from '../components/tabela/Grade';
import { MassaMolar } from '../components/tabela/MassaMolar';
import { Painel, valorNoModo } from '../components/tabela/Painel';
import {
  CATEGORIAS,
  ROTULO_FONTE,
  buscar,
  dataBr,
  massaCurta,
  passaFiltro,
  temFiltro,
  type Bloco,
  type Catalogo,
  type CategoriaKey,
  type Elemento,
  type Filtros,
} from '../lib/elementos';
import {
  PROPRIEDADES,
  TEMPERATURA_AMBIENTE_K,
  TENDENCIAS,
  escala as criarEscala,
  tomDaCasa,
  type ModoCor,
  type PropriedadeKey,
} from '../lib/propriedades-periodicas';
import '../tabela-periodica.css';

type Vista = 'grade' | 'lista';
type Ferramenta = 'distribuicao' | 'massa' | 'comparar';

const CHAVE_VISTA = 'openem.tabela-vista';

function vistaInicial(): Vista {
  try {
    const salva = localStorage.getItem(CHAVE_VISTA);
    if (salva === 'grade' || salva === 'lista') return salva;
  } catch {
    /* sem storage: segue o tamanho da tela */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches ? 'lista' : 'grade';
}

function modoDoValor(v: string, kelvin: number): ModoCor {
  if (v === 'bloco') return { tipo: 'bloco' };
  if (v === 'estado') return { tipo: 'estado', kelvin };
  if (v.startsWith('calor:')) return { tipo: 'calor', propriedade: v.slice(6) as PropriedadeKey };
  return { tipo: 'categoria' };
}

/** Ponta da seta, em tamanho fixo (a haste é que estica). */
function Ponta({ para }: { para: 'esquerda' | 'direita' | 'cima' | 'baixo' }) {
  const giro = { direita: 0, baixo: 90, esquerda: 180, cima: 270 }[para];
  return (
    <svg viewBox="0 0 10 10" width="10" height="10" className="tp-ponta shrink-0" style={{ transform: `rotate(${giro}deg)` }}>
      <path d="M2 1.5 8 5l-6 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** As setas de tendência nas bordas da grade (cima: período; esquerda: grupo). */
function Setas({ chave }: { chave: (typeof TENDENCIAS)[number]['key'] }) {
  const t = TENDENCIAS.find((x) => x.key === chave)!;
  return (
    <>
      <div className="tp-seta-h" aria-hidden>
        {t.periodo === 'esquerda' && (
          <>
            <span>cresce</span>
            <Ponta para="esquerda" />
          </>
        )}
        <span className="tp-haste" />
        {t.periodo === 'direita' && (
          <>
            <Ponta para="direita" />
            <span>cresce</span>
          </>
        )}
      </div>
      <div className="tp-seta-v" aria-hidden>
        {t.grupo === 'cima' && (
          <>
            <span>cresce</span>
            <Ponta para="cima" />
          </>
        )}
        <span className="tp-haste" />
        {t.grupo === 'baixo' && (
          <>
            <Ponta para="baixo" />
            <span>cresce</span>
          </>
        )}
      </div>
    </>
  );
}

/** Lista por período: a vista do celular. */
function Lista({
  lista,
  visiveis,
  modo,
  tons,
  onAbrir,
}: {
  lista: Elemento[];
  visiveis: Set<number> | null;
  modo: ModoCor;
  tons: ReturnType<typeof useTons>;
  onAbrir: (z: number) => void;
}) {
  const mostrados = visiveis ? lista.filter((e) => visiveis.has(e.z)) : lista;
  const periodos = [1, 2, 3, 4, 5, 6, 7].map((p) => ({ p, itens: mostrados.filter((e) => e.periodo === p) })).filter((g) => g.itens.length);
  if (periodos.length === 0) {
    return (
      <EmptyState icon={IconTabelaPeriodica} title="Nenhum elemento" description="Nenhum elemento passa na busca e nos filtros." tip="Limpe os filtros ou busque pelo símbolo" />
    );
  }
  return (
    <div className="space-y-5" data-calor={modo.tipo === 'calor' || undefined}>
      {periodos.map(({ p, itens }) => (
        <section key={p} aria-labelledby={`tp-periodo-${p}`}>
          <h2 id={`tp-periodo-${p}`} className="mb-2 font-display text-sm font-bold">
            Período {p}
          </h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {itens.map((e) => {
              const t = tons.get(e.z)!;
              return (
                <li key={e.z}>
                  <button type="button" onClick={() => onAbrir(e.z)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2">
                    <span className="tp-mini" style={estiloTom(t)} data-desconhecido={t.tom == null || undefined}>
                      <span className="font-display text-base font-bold leading-none">{e.simbolo}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.nome}</span>
                      <span className="block truncate text-xs text-muted">
                        <span className="font-data tabular-nums">
                          {e.z} · {massaCurta(e)}
                        </span>{' '}
                        · {valorNoModo(e, modo)}
                      </span>
                    </span>
                    <IconChevronRight width={16} height={16} className="shrink-0 text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function useTons(lista: Elemento[], modo: ModoCor) {
  return useMemo(() => {
    const p = modo.tipo === 'calor' ? PROPRIEDADES.find((x) => x.key === modo.propriedade)! : null;
    const esc = p ? criarEscala(lista.map(p.valor), p.log) : undefined;
    return new Map(lista.map((e) => [e.z, tomDaCasa(e, modo, esc)]));
  }, [lista, modo]);
}

/**
 * Tabela periódica: os 118 elementos na posição da IUPAC, com a ficha de cada
 * um, cores por categoria, bloco, estado ou propriedade e as ferramentas de
 * distribuição eletrônica, massa molar e comparação. O catálogo é estático e
 * entra num chunk à parte, só quando a tela abre.
 */
export default function TabelaPeriodica() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtros>({});
  const [corValor, setCorValor] = useState('categoria');
  const [kelvin, setKelvin] = useState(TEMPERATURA_AMBIENTE_K);
  const [tendencia, setTendencia] = useState(false);
  const [vista, setVistaState] = useState<Vista>(vistaInicial);
  const [zoom, setZoom] = useState(false);
  const [foco, setFoco] = useState<number | null>(null);
  // O vão nunca abre vazio: mostra o último elemento visitado (no começo, o H).
  const [ultimo, setUltimo] = useState(1);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('distribuicao');
  const [distZ, setDistZ] = useState(26);
  const [carga, setCarga] = useState(0);
  const [cmpA, setCmpA] = useState(11);
  const [cmpB, setCmpB] = useState(17);
  const ferramentasRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let vivo = true;
    import('../data/elementos.json')
      .then((m) => vivo && setCatalogo(m.default as unknown as Catalogo))
      .catch(() => vivo && setErro('Não foi possível carregar a tabela.'));
    return () => {
      vivo = false;
    };
  }, []);

  const setVista = (v: Vista) => {
    setVistaState(v);
    try {
      localStorage.setItem(CHAVE_VISTA, v);
    } catch {
      /* preferência só desta visita */
    }
  };

  const lista = useMemo(() => catalogo?.elementos ?? [], [catalogo]);
  const modo = useMemo(() => modoDoValor(corValor, kelvin), [corValor, kelvin]);
  const tons = useTons(lista, modo);
  const propriedade = modo.tipo === 'calor' ? PROPRIEDADES.find((p) => p.key === modo.propriedade)! : null;
  const escala = useMemo(
    () => (propriedade ? criarEscala(lista.map(propriedade.valor), propriedade.log) : null),
    [lista, propriedade],
  );
  const chaveTendencia =
    tendencia && modo.tipo === 'calor' ? TENDENCIAS.find((t) => t.key === modo.propriedade)?.key ?? null : null;

  const encontrados = useMemo(() => buscar(lista, busca), [lista, busca]);
  const visiveis = useMemo(() => {
    if (!busca.trim() && !temFiltro(filtros)) return null;
    const base = busca.trim() ? encontrados : lista;
    return new Set(base.filter((e) => passaFiltro(e, filtros)).map((e) => e.z));
  }, [busca, encontrados, filtros, lista]);

  const zAberto = Number(params.get('z'));
  const aberto = lista.find((e) => e.z === zAberto) ?? null;

  // Abrir a ficha empilha uma entrada no histórico (o voltar do navegador
  // fecha); fechar pelo X ou pelo Esc volta essa entrada. Quem chegou por um
  // link com ?z= não tem para onde voltar: aí só tira o parâmetro.
  const navigate = useNavigate();
  const abriuAqui = useRef(false);
  const abrir = useCallback(
    (z: number) => {
      abriuAqui.current = true;
      setParams({ z: String(z) });
    },
    [setParams],
  );
  const fechar = useCallback(() => {
    if (abriuAqui.current) {
      abriuAqui.current = false;
      navigate(-1);
    } else setParams({}, { replace: true });
  }, [navigate, setParams]);
  const navegar = useCallback((z: number) => setParams({ z: String(z) }, { replace: true }), [setParams]);
  const onFoco = useCallback((z: number | null) => {
    setFoco(z);
    if (z != null) setUltimo(z);
  }, []);

  const irParaFerramenta = (f: Ferramenta) => {
    fechar();
    setFerramenta(f);
    window.setTimeout(() => ferramentasRef.current?.scrollIntoView?.({ block: 'start' }), 60);
  };

  const alternarCategoria = (c: CategoriaKey) =>
    setFiltros((f) => ({ ...f, categoria: f.categoria === c ? undefined : c }));
  const alternarBloco = (b: Bloco) => setFiltros((f) => ({ ...f, bloco: f.bloco === b ? undefined : b }));

  const escolherTendencia = () => {
    if (tendencia) {
      setTendencia(false);
      return;
    }
    setTendencia(true);
    if (!(modo.tipo === 'calor' && TENDENCIAS.some((t) => t.key === modo.propriedade))) setCorValor('calor:raio');
  };

  const elementoFoco = lista.find((e) => e.z === (foco ?? aberto?.z ?? ultimo)) ?? null;
  const filtrando = Boolean(busca.trim()) || temFiltro(filtros);
  const total = visiveis ? visiveis.size : 118;

  return (
    <div className="tp space-y-6">
      <PageHeader
        title="Tabela periódica"
        subtitle="Os 118 elementos na posição da IUPAC, com a ficha de cada um e a fonte de cada dado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {vista === 'lista' && (
            <button
              type="button"
              className="btn btn-ghost px-3 py-2 text-sm"
              onClick={() => ferramentasRef.current?.scrollIntoView?.({ block: 'start' })}
            >
              Ferramentas
            </button>
          )}
          <div className="seg" role="group" aria-label="Como mostrar">
            <button type="button" data-active={vista === 'grade'} aria-pressed={vista === 'grade'} onClick={() => setVista('grade')}>
              Grade
            </button>
            <button type="button" data-active={vista === 'lista'} aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>
              Lista
            </button>
          </div>
          </div>
        }
      />

      {erro && <ErrorBanner message={erro} />}

      {catalogo === null && !erro ? (
        <div className="space-y-3" aria-busy>
          <SkeletonCard lines={2} />
          <div className="skeleton h-[28rem] rounded-2xl" />
        </div>
      ) : catalogo ? (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[12rem] flex-1 text-xs font-medium text-muted sm:max-w-xs">
                Buscar
                <input
                  type="search"
                  className="input mt-1"
                  value={busca}
                  onChange={(ev) => setBusca(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' && encontrados[0]) abrir(encontrados[0].z);
                  }}
                  placeholder="Nome, símbolo ou número"
                  aria-describedby="tp-total"
                />
              </label>
              <label className="min-w-[11rem] flex-1 text-xs font-medium text-muted sm:flex-none">
                Colorir por
                <select
                  className="input mt-1"
                  value={corValor}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setCorValor(v);
                    // Setas só existem para raio, energia de ionização e eletronegatividade.
                    if (!TENDENCIAS.some((t) => v === `calor:${t.key}`)) setTendencia(false);
                  }}
                >
                  <option value="categoria">Categoria</option>
                  <option value="bloco">Bloco (s, p, d, f)</option>
                  <option value="estado">Estado físico</option>
                  <optgroup label="Mapa de calor">
                    {PROPRIEDADES.map((p) => (
                      <option key={p.key} value={`calor:${p.key}`}>
                        {p.rotulo}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {vista === 'grade' && (
                <button
                  type="button"
                  className="chip h-[2.6rem] px-3.5 text-[0.8125rem]"
                  data-active={tendencia}
                  aria-pressed={tendencia}
                  onClick={escolherTendencia}
                >
                  Setas de tendência
                </button>
              )}
            </div>

            {modo.tipo === 'estado' && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                <label htmlFor="tp-temperatura" className="text-xs font-medium text-muted">
                  Temperatura
                </label>
                <input
                  id="tp-temperatura"
                  type="range"
                  className="tp-range min-w-[10rem] flex-1"
                  min={0}
                  max={6000}
                  step={1}
                  value={Math.round(kelvin)}
                  onChange={(ev) => setKelvin(Number(ev.target.value))}
                  aria-valuetext={`${Math.round(kelvin - 273.15)} graus Celsius`}
                />
                <output htmlFor="tp-temperatura" className="w-28 font-data text-sm tabular-nums">
                  {Math.round(kelvin - 273.15)} °C <span className="text-xs text-muted">{Math.round(kelvin)} K</span>
                </output>
                <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setKelvin(TEMPERATURA_AMBIENTE_K)}>
                  25 °C
                </button>
              </div>
            )}

            {/* No celular, os quatro filtros em duas colunas; a partir do sm, numa linha. */}
            <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filtros">
              <label className="text-xs font-medium text-muted">
                Grupo
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={filtros.grupo ?? ''}
                  onChange={(ev) => setFiltros((f) => ({ ...f, grupo: ev.target.value ? Number(ev.target.value) : undefined }))}
                >
                  <option value="">Todos</option>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={g}>
                      {g} ({['1A', '2A', '3B', '4B', '5B', '6B', '7B', '8B', '8B', '8B', '1B', '2B', '3A', '4A', '5A', '6A', '7A', '8A'][g - 1]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Período
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={filtros.periodo ?? ''}
                  onChange={(ev) => setFiltros((f) => ({ ...f, periodo: ev.target.value ? Number(ev.target.value) : undefined }))}
                >
                  <option value="">Todos</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Bloco
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={filtros.bloco ?? ''}
                  onChange={(ev) => setFiltros((f) => ({ ...f, bloco: (ev.target.value || undefined) as Bloco | undefined }))}
                >
                  <option value="">Todos</option>
                  {(['s', 'p', 'd', 'f'] as const).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Categoria
                <select
                  className="input mt-1 py-1.5 text-sm"
                  value={filtros.categoria ?? ''}
                  onChange={(ev) => setFiltros((f) => ({ ...f, categoria: (ev.target.value || undefined) as CategoriaKey | undefined }))}
                >
                  <option value="">Todas</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.plural}
                    </option>
                  ))}
                </select>
              </label>
              {filtrando && (
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => {
                    setFiltros({});
                    setBusca('');
                  }}
                >
                  <IconX width={12} height={12} />
                  Limpar
                </button>
              )}
              <p id="tp-total" aria-live="polite" className="col-span-2 self-center text-xs tabular-nums text-muted sm:ml-auto">
                {filtrando ? `${total} de 118 elementos` : '118 elementos'}
              </p>
            </div>
          </div>

          {vista === 'grade' ? (
            <section aria-label="Grade" className="space-y-3">
              <div className="tp-quadro card card-raised p-3 sm:p-4">
                <div className="tp-rolagem">
                  <Grade
                    lista={lista}
                    tons={tons}
                    visiveis={visiveis}
                    aberta={aberto?.z ?? null}
                    foco={foco}
                    onFoco={onFoco}
                    onAbrir={abrir}
                    zoom={zoom}
                    serieAtiva={filtros.categoria === 'lantanideo' || filtros.categoria === 'actinideo' ? filtros.categoria : null}
                    onSerie={alternarCategoria}
                    calor={modo.tipo === 'calor'}
                    tendencia={chaveTendencia ? <Setas chave={chaveTendencia} /> : null}
                    painel={
                      <Painel
                        foco={elementoFoco}
                        tomFoco={elementoFoco ? tons.get(elementoFoco.z) ?? null : null}
                        modo={modo}
                        escala={escala}
                        categoria={filtros.categoria}
                        bloco={filtros.bloco}
                        onCategoria={alternarCategoria}
                        onBloco={alternarBloco}
                      />
                    }
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-muted">
                  <span>
                    Número atômico, símbolo, nome e massa atômica abreviada. <span className="font-data">[97]</span>: sem isótopo
                    estável. Pelo teclado, as setas andam pela tabela e Enter abre a ficha.
                  </span>
                  <button type="button" className="ml-auto underline underline-offset-2 hover:text-fg" onClick={() => setZoom((z) => !z)} aria-pressed={zoom}>
                    {zoom ? 'Casas menores' : 'Casas maiores'}
                  </button>
                </div>
              </div>
              {chaveTendencia && (
                <div className="card px-4 py-3 text-sm">
                  <p className="font-semibold">{TENDENCIAS.find((t) => t.key === chaveTendencia)!.rotulo}</p>
                  <p className="mt-1 max-w-prose text-muted text-pretty">{TENDENCIAS.find((t) => t.key === chaveTendencia)!.explicacao}</p>
                </div>
              )}
            </section>
          ) : (
            <Lista lista={lista} visiveis={visiveis} modo={modo} tons={tons} onAbrir={abrir} />
          )}

          <section ref={ferramentasRef} aria-labelledby="tp-ferramentas" className="scroll-mt-20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="tp-ferramentas" className="font-display text-lg font-bold">
                Ferramentas
              </h2>
              <div className="seg max-w-full overflow-x-auto whitespace-nowrap" role="tablist" aria-label="Ferramentas">
                {(
                  [
                    ['distribuicao', 'Distribuição eletrônica', 'Distribuição'],
                    ['massa', 'Massa molar', 'Massa molar'],
                    ['comparar', 'Comparar', 'Comparar'],
                  ] as const
                ).map(([k, rotulo, curto]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    id={`tp-aba-${k}`}
                    aria-selected={ferramenta === k}
                    aria-controls="tp-ferramenta"
                    data-active={ferramenta === k}
                    onClick={() => setFerramenta(k)}
                    aria-label={rotulo}
                  >
                    {/* No celular, o rótulo curto: os três cabem numa linha. */}
                    <span className="sm:hidden">{curto}</span>
                    <span className="hidden sm:inline">{rotulo}</span>
                  </button>
                ))}
              </div>
            </div>
            <div id="tp-ferramenta" role="tabpanel" aria-labelledby={`tp-aba-${ferramenta}`} className="card p-4 sm:p-5">
              {ferramenta === 'distribuicao' && (
                <Distribuicao lista={lista} z={distZ} carga={carga} onElemento={(z) => { setDistZ(z); setCarga(0); }} onCarga={setCarga} />
              )}
              {ferramenta === 'massa' && <MassaMolar lista={lista} />}
              {ferramenta === 'comparar' && <Comparar lista={lista} a={cmpA} b={cmpB} onA={setCmpA} onB={setCmpB} />}
            </div>
          </section>

          <section aria-labelledby="tp-sobre" className="space-y-3 border-t border-line pt-6 text-sm">
            <h2 id="tp-sobre" className="font-display text-lg font-bold">
              Sobre os dados
            </h2>
            <p className="max-w-prose text-muted text-pretty">
              Dados conferidos em <span className="font-data text-fg">{dataBr(catalogo.conferidoEm)}</span>. As massas
              atômicas são as da CIAAW (revisão de {catalogo.revisaoCiaaw}, com os novos valores de gadolínio, lutécio e
              zircônio, que a tabela impressa da IUPAC de 2022 ainda não traz). Configurações eletrônicas e energias de
              ionização vêm do NIST. O raio é o covalente de ligação simples (Pyykkö e Atsumi), o mesmo tipo para todos os
              elementos. Valor desconhecido aparece como desconhecido; estimado, calculado e previsto vêm marcados.
            </p>
            <details className="max-w-prose rounded-xl border border-line px-4 py-3">
              <summary className="tp-resumo">
                <IconChevronRight width={14} height={14} className="tp-resumo-seta" />
                O debate sobre o grupo 3
              </summary>
              <p className="mt-2 text-muted text-pretty">
                A IUPAC ainda discute quais elementos ficam no grupo 3, abaixo do escândio e do ítrio: lantânio e actínio,
                como em muitos livros, ou lutécio e laurêncio, como sugerem as configurações eletrônicas. A tabela oficial
                deixa a casa do grupo 3 nos períodos 6 e 7 como um marcador para as duas séries inteiras, de 15 elementos
                cada, e esta tela segue a tabela oficial.
              </p>
            </details>
            <details className="max-w-prose rounded-xl border border-line px-4 py-3">
              <summary className="tp-resumo">
                <IconChevronRight width={14} height={14} className="tp-resumo-seta" />
                Fontes
              </summary>
              <ul className="mt-2 space-y-1.5">
                {Object.entries(catalogo.fontes).map(([id, f]) => (
                  <li key={id}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand">
                      {ROTULO_FONTE[id] ?? id}
                    </a>
                    <span className="text-muted">: {f.nome}</span>
                    {f.consultadoEm && <span className="text-muted">, consultado em {dataBr(f.consultadoEm)}</span>}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          {aberto && (
            <Ficha
              e={aberto}
              catalogo={catalogo}
              onFechar={fechar}
              onNavegar={navegar}
              onDistribuicao={(z) => {
                setDistZ(z);
                setCarga(0);
                irParaFerramenta('distribuicao');
              }}
              onComparar={(z) => {
                setCmpA(z);
                if (cmpB === z) setCmpB(z === 1 ? 2 : z - 1);
                irParaFerramenta('comparar');
              }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
