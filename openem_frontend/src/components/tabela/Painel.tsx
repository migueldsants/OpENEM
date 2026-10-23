import type { CSSProperties } from 'react';
import {
  CATEGORIAS,
  ROTULO_ESTADO,
  massaCurta,
  numeroBr,
  rotuloCategoria,
  type CategoriaKey,
  type Elemento,
} from '../../lib/elementos';
import { formatarAbreviada, lerConfiguracao } from '../../lib/configuracao-eletronica';
import {
  PASSOS_ESCALA,
  PROPRIEDADES,
  TOM_BLOCO,
  TOM_ESTADO,
  estadoNaTemperatura,
  type Escala,
  type ModoCor,
  type TomDaCasa,
} from '../../lib/propriedades-periodicas';
import { estiloTom } from './Grade';

/** O valor que o modo de cor está mostrando, em texto, para um elemento. */
// eslint-disable-next-line react-refresh/only-export-components
export function valorNoModo(e: Elemento, modo: ModoCor): string {
  switch (modo.tipo) {
    case 'categoria':
      return rotuloCategoria(e);
    case 'bloco':
      return `Bloco ${e.bloco}`;
    case 'estado': {
      const s = estadoNaTemperatura(e, modo.kelvin);
      return s ? ROTULO_ESTADO[s] : 'Estado desconhecido';
    }
    case 'calor': {
      const p = PROPRIEDADES.find((x) => x.key === modo.propriedade)!;
      const v = p.valor(e);
      if (v == null) return `${p.rotulo}: desconhecida`;
      if (p.key === 'afinidade' && e.afinidade && 'anionInstavel' in e.afinidade) return 'Sem ânion estável';
      return `${numeroBr(v, p.key === 'densidade' && v < 0.1 ? 5 : 2)} ${p.unidade}${p.estimado(e) ? ' (estimado)' : ''}`;
    }
  }
}

function Foco({ e, tom, modo }: { e: Elemento | null; tom: TomDaCasa | null; modo: ModoCor }) {
  if (!e) {
    return (
      <div className="tp-foco tp-foco-vazio text-center">
        <p className="text-xs text-muted text-pretty">
          Passe o mouse ou ande com as setas. <span className="text-fg">Enter</span> abre a ficha.
        </p>
      </div>
    );
  }
  return (
    <div className="tp-foco" style={estiloTom(tom)} aria-live="polite" aria-atomic="true">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-data text-sm font-semibold tabular-nums">{e.z}</span>
        <span className="font-data text-xs tabular-nums">{massaCurta(e)}</span>
      </div>
      <span className="tp-foco-simbolo self-center">{e.simbolo}</span>
      <span className="truncate font-display text-sm font-bold">{e.nome}</span>
      <span className="truncate text-[0.6875rem]">{valorNoModo(e, modo)}</span>
      <span className="sr-only">{formatarAbreviada(lerConfiguracao(e.configuracao))}</span>
    </div>
  );
}

function Item({
  tom,
  rotulo,
  ativo,
  onClick,
  desconhecido,
}: {
  tom: string | null;
  rotulo: string;
  ativo?: boolean;
  onClick?: () => void;
  desconhecido?: boolean;
}) {
  const conteudo = (
    <>
      <span
        className="tp-legenda-tom"
        data-desconhecido={desconhecido || undefined}
        style={tom ? estiloTom({ tom, passo: null, estimado: false }) : undefined}
      />
      <span className="truncate">{rotulo}</span>
    </>
  );
  if (!onClick) return <li className="flex min-w-0 items-center gap-2">{conteudo}</li>;
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ativo}
        className={`flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-2 ${ativo ? 'bg-surface-2 font-semibold' : ''}`}
      >
        {conteudo}
      </button>
    </li>
  );
}

/** Legenda do modo de cor: categorias e blocos filtram ao clicar. */
function Legenda({
  modo,
  escala,
  categoria,
  bloco,
  onCategoria,
  onBloco,
}: {
  modo: ModoCor;
  escala: Escala | null;
  categoria?: CategoriaKey;
  bloco?: Elemento['bloco'];
  onCategoria: (c: CategoriaKey) => void;
  onBloco: (b: Elemento['bloco']) => void;
}) {
  if (modo.tipo === 'categoria') {
    return (
      <ul className="grid min-w-0 grid-cols-2 content-center gap-x-3 gap-y-0.5 text-[0.75rem]" aria-label="Legenda: categorias (clique para destacar)">
        {CATEGORIAS.map((c) => (
          <Item key={c.key} tom={c.key} rotulo={c.plural} ativo={categoria === c.key} onClick={() => onCategoria(c.key)} />
        ))}
        <li className="flex min-w-0 items-center gap-2 text-muted">
          <span className="tp-legenda-tom" data-estimado />
          <span className="truncate">Categoria prevista (109 a 118)</span>
        </li>
      </ul>
    );
  }
  if (modo.tipo === 'bloco') {
    return (
      <ul className="grid min-w-0 content-center gap-1 text-[0.8125rem]" aria-label="Legenda: blocos (clique para destacar)">
        {(['s', 'p', 'd', 'f'] as const).map((b) => (
          <Item key={b} tom={TOM_BLOCO[b]} rotulo={`Bloco ${b}`} ativo={bloco === b} onClick={() => onBloco(b)} />
        ))}
      </ul>
    );
  }
  if (modo.tipo === 'estado') {
    return (
      <div className="grid min-w-0 content-center gap-2 text-[0.8125rem]">
        <p className="text-xs text-muted">
          A <span className="font-data text-fg">{numeroBr(modo.kelvin - 273.15, 0)} °C</span> e 1 atm
        </p>
        <ul className="grid gap-1" aria-label="Legenda: estado físico">
          {(['solido', 'liquido', 'gasoso'] as const).map((s) => (
            <Item key={s} tom={TOM_ESTADO[s]} rotulo={ROTULO_ESTADO[s]} />
          ))}
          <Item tom={null} rotulo="Desconhecido" desconhecido />
        </ul>
      </div>
    );
  }
  const p = PROPRIEDADES.find((x) => x.key === modo.propriedade)!;
  const casas = p.key === 'densidade' ? 4 : p.key === 'eletronegatividade' ? 2 : 0;
  return (
    <div className="grid min-w-0 content-center gap-2 text-[0.75rem]">
      <p className="font-semibold">
        {p.rotulo} <span className="font-normal text-muted">({p.unidade}{p.log ? ', escala logarítmica' : ''})</span>
      </p>
      <div>
        <div className="tp-escala" aria-hidden>
          {Array.from({ length: PASSOS_ESCALA }, (_, i) => (
            <span key={i} style={{ '--mix': `var(--tp-calor-${i})` } as CSSProperties} />
          ))}
        </div>
        {escala && (
          <div className="mt-1 flex justify-between font-data text-[0.6875rem] tabular-nums">
            <span>{numeroBr(escala.min, casas)}</span>
            <span>{numeroBr(escala.max, casas)}</span>
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legenda do mapa de calor">
        <Item tom={null} rotulo="Desconhecido" desconhecido />
        <li className="flex items-center gap-2">
          <span className="tp-legenda-tom" data-estimado />
          Estimado
        </li>
      </ul>
    </div>
  );
}

/** O que mora no vão da tabela: o elemento em foco e a legenda. */
export function Painel(props: {
  foco: Elemento | null;
  tomFoco: TomDaCasa | null;
  modo: ModoCor;
  escala: Escala | null;
  categoria?: CategoriaKey;
  bloco?: Elemento['bloco'];
  onCategoria: (c: CategoriaKey) => void;
  onBloco: (b: Elemento['bloco']) => void;
}) {
  return (
    <>
      <Foco e={props.foco} tom={props.tomFoco} modo={props.modo} />
      <Legenda {...props} />
    </>
  );
}
