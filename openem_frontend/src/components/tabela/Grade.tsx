import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { descricaoAcessivel, massaCurta, mover, type Direcao, type Elemento } from '../../lib/elementos';
import type { TomDaCasa } from '../../lib/propriedades-periodicas';

/** Estilo do tom de uma casa: o token `--tp-<tom>` e quanto ele tinge a folha. */
// eslint-disable-next-line react-refresh/only-export-components
export function estiloTom(t: TomDaCasa | null): CSSProperties {
  if (!t?.tom) return {};
  return {
    '--tom': `var(--tp-${t.tom})`,
    '--mix': t.passo != null ? `var(--tp-calor-${t.passo})` : 'var(--tp-mix)',
  } as CSSProperties;
}

const TECLAS: Record<string, Direcao> = {
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  ArrowUp: 'cima',
  ArrowDown: 'baixo',
  Home: 'inicio',
  End: 'fim',
};

/** Numeração antiga, por grupo (o 8B ocupa três colunas). */
const ANTIGO = ['1A', '2A', '3B', '4B', '5B', '6B', '7B', '8B', '8B', '8B', '1B', '2B', '3A', '4A', '5A', '6A', '7A', '8A'];

/** Menor e maior corpo do nome na casa, em px. Abaixo de 8 px, não se lê. */
const NOME_MIN = 8;
const NOME_MAX = 9;
/** Folga horizontal da casa (padding e respiro), em px. */
const FOLGA = 9;

let regua: CanvasRenderingContext2D | null | undefined;

/** Largura do nome a 8 px na fonte da casa (Inter 500). */
function larguraA8(nome: string): number {
  if (regua === undefined) {
    try {
      regua = document.createElement('canvas').getContext('2d');
    } catch {
      regua = null;
    }
  }
  if (!regua) return nome.length * NOME_MIN * 0.6;
  regua.font = `500 ${NOME_MIN}px Inter, ui-sans-serif, system-ui, sans-serif`;
  return regua.measureText(nome).width;
}

/**
 * Corpo do nome numa casa de `celula` px: o maior até 9 px que cabe na
 * largura, ou null se nem a 8 px cabe (aí o nome sai da casa; o vão e a
 * ficha mostram o nome inteiro).
 */
function corpoDoNome(nome: string, celula: number): number | null {
  const corpo = Math.min(NOME_MAX, (NOME_MIN * (celula - FOLGA)) / larguraA8(nome));
  return corpo >= NOME_MIN ? Math.floor(corpo * 4) / 4 : null;
}

const Casa = memo(function Casa({
  e,
  tom,
  apagada,
  eixo,
  aberta,
  ativa,
  registrar,
  onAbrir,
  onFoco,
  corpoNome,
}: {
  e: Elemento;
  tom: TomDaCasa;
  corpoNome: number | null;
  apagada: boolean;
  eixo: boolean;
  aberta: boolean;
  ativa: boolean;
  registrar: (z: number, el: HTMLDivElement | null) => void;
  onAbrir: (z: number) => void;
  onFoco: (z: number) => void;
}) {
  return (
    <div
      ref={(el) => registrar(e.z, el)}
      role="gridcell"
      aria-colindex={e.coluna + 1}
      aria-label={descricaoAcessivel(e)}
      aria-selected={aberta}
      tabIndex={ativa ? 0 : -1}
      className="tp-casa"
      data-z={e.z}
      data-apagada={apagada || undefined}
      data-eixo={eixo || undefined}
      data-aberta={aberta || undefined}
      data-desconhecido={tom.tom == null || undefined}
      data-estimado={tom.estimado || undefined}
      style={{ gridRow: e.linha + 1, gridColumn: e.coluna + 1, ...estiloTom(tom) }}
      onClick={() => onAbrir(e.z)}
      onMouseEnter={() => onFoco(e.z)}
      onFocus={() => onFoco(e.z)}
    >
      <span className="tp-z" aria-hidden>
        {e.z}
      </span>
      <span className="tp-simbolo" aria-hidden>
        {e.simbolo}
      </span>
      {/* Sem caber, o lugar do nome fica (vazio): o símbolo não sai da linha dos vizinhos. */}
      <span
        className="tp-nome"
        style={{ fontSize: `${corpoNome ?? NOME_MIN}px`, visibility: corpoNome == null ? 'hidden' : undefined }}
        aria-hidden
      >
        {e.nome}
      </span>
      <span className="tp-massa" aria-hidden>
        {massaCurta(e)}
      </span>
    </div>
  );
});

/**
 * A grade da IUPAC: 18 grupos, 7 períodos e as duas séries f embaixo, com o
 * marcador no grupo 3. Teclado no padrão de grid do ARIA: uma casa só entra no
 * Tab; as setas andam pela posição real, Home/End vão às pontas da linha e
 * Enter abre a ficha. `painel` ocupa o vão entre o H e o He.
 */
export function Grade({
  lista,
  tons,
  visiveis,
  aberta,
  foco,
  onFoco,
  onAbrir,
  painel,
  tendencia,
  zoom,
  serieAtiva,
  onSerie,
  calor,
}: {
  lista: Elemento[];
  tons: Map<number, TomDaCasa>;
  /** Elementos que passam na busca e nos filtros; null = todos. */
  visiveis: Set<number> | null;
  aberta: number | null;
  foco: number | null;
  onFoco: (z: number | null) => void;
  onAbrir: (z: number) => void;
  painel: ReactNode;
  tendencia: ReactNode;
  zoom: boolean;
  serieAtiva: 'lantanideo' | 'actinideo' | null;
  onSerie: (s: 'lantanideo' | 'actinideo') => void;
  /** Mapa de calor: o traço da categoria some (ali ele não seria dado). */
  calor: boolean;
}) {
  const casas = useRef(new Map<number, HTMLDivElement>());
  const [ativa, setAtiva] = useState(1);
  // Largura real da casa, para saber que nome cabe e em que corpo.
  const [celula, setCelula] = useState(0);
  useEffect(() => {
    const el = casas.current.get(1);
    if (!el) return;
    const medir = () => setCelula(Math.round(el.getBoundingClientRect().width));
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // A régua mede na Inter: antes de a fonte carregar, mediria na do sistema.
  const [fontes, setFontes] = useState(0);
  useEffect(() => {
    let vivo = true;
    document.fonts?.ready.then(() => vivo && setFontes((n) => n + 1));
    return () => {
      vivo = false;
    };
  }, []);
  const corpos = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const e of lista) m.set(e.z, celula ? corpoDoNome(e.nome, celula) : null);
    return m;
    // `fontes` só existe para medir de novo quando a Inter chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, celula, fontes]);
  const registrar = useMemo(
    () => (z: number, el: HTMLDivElement | null) => {
      if (el) casas.current.set(z, el);
      else casas.current.delete(z);
    },
    [],
  );

  // O Tab entra na última casa visitada ou na que está aberta.
  useEffect(() => {
    if (aberta != null) setAtiva(aberta);
  }, [aberta]);

  const atual = foco != null ? lista.find((e) => e.z === foco) : undefined;
  const linhaFoco = atual?.linha ?? null;
  const colunaFoco = atual && atual.linha <= 7 ? atual.coluna : null;

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const z = Number((ev.target as HTMLElement).dataset.z);
    if (!z) return;
    const dir = TECLAS[ev.key];
    if (dir) {
      ev.preventDefault();
      const prox = mover(lista, z, dir);
      setAtiva(prox);
      casas.current.get(prox)?.focus();
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onAbrir(z);
    }
  };

  const linhas = useMemo(() => {
    const m = new Map<number, Elemento[]>();
    for (const e of lista) m.set(e.linha, [...(m.get(e.linha) ?? []), e]);
    return m;
  }, [lista]);

  return (
    <div
      className="tp-mesa"
      data-zoom={zoom ? 'mais' : undefined}
      data-tendencia={tendencia ? '' : undefined}
      data-calor={calor || undefined}
    >
      {tendencia}
      <div
        role="grid"
        aria-label="Tabela periódica dos elementos"
        aria-rowcount={9}
        aria-colcount={19}
        className="tp-grade"
        onKeyDown={onKeyDown}
        onMouseLeave={() => onFoco(null)}
      >
        <div role="row" aria-rowindex={1}>
          <span role="columnheader" aria-label="Período" style={{ gridRow: 1, gridColumn: 1 }} />
          {ANTIGO.map((antigo, i) => (
            <span
              key={i}
              role="columnheader"
              aria-label={`Grupo ${i + 1} (${antigo})`}
              className="tp-cabeca"
              data-eixo={colunaFoco === i + 1 || undefined}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              <span>{i + 1}</span>
              <span className="tp-cabeca-antigo">{antigo}</span>
            </span>
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 9, 10].map((linha, i) => (
          <div role="row" key={linha} aria-rowindex={i + 2}>
            <span
              role="rowheader"
              aria-label={linha <= 7 ? `Período ${linha}` : linha === 9 ? 'Lantanídeos' : 'Actinídeos'}
              className="tp-periodo"
              data-eixo={linhaFoco === linha || undefined}
              style={{ gridRow: linha + 1, gridColumn: 1 }}
            >
              {linha <= 7 ? linha : <span className="tp-serie-rotulo">{linha === 9 ? 'La–Lu' : 'Ac–Lr'}</span>}
            </span>
            {(linha === 6 || linha === 7) && (
              <div role="gridcell" aria-colindex={4} className="grid" style={{ gridRow: linha + 1, gridColumn: 4 }}>
                <button
                  type="button"
                  className="tp-marcador"
                  data-active={serieAtiva === (linha === 6 ? 'lantanideo' : 'actinideo')}
                  aria-pressed={serieAtiva === (linha === 6 ? 'lantanideo' : 'actinideo')}
                  aria-label={linha === 6 ? 'Lantanídeos, 57 a 71: destacar a série' : 'Actinídeos, 89 a 103: destacar a série'}
                  onClick={() => onSerie(linha === 6 ? 'lantanideo' : 'actinideo')}
                >
                  <span>{linha === 6 ? '57–71' : '89–103'}</span>
                </button>
              </div>
            )}
            {(linhas.get(linha) ?? []).map((e) => (
              <Casa
                key={e.z}
                e={e}
                tom={tons.get(e.z)!}
                apagada={visiveis != null && !visiveis.has(e.z)}
                eixo={foco !== e.z && (linhaFoco === e.linha || (colunaFoco === e.coluna && e.linha <= 7))}
                aberta={aberta === e.z}
                ativa={ativa === e.z}
                registrar={registrar}
                corpoNome={corpos.get(e.z) ?? null}
                onAbrir={(z) => {
                  setAtiva(z);
                  onAbrir(z);
                }}
                onFoco={onFoco}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="tp-vao">{painel}</div>
    </div>
  );
}
