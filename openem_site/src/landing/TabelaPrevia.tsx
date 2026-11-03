import { memo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import dados from 'virtual:tabela-periodica';
import { atrasoDaOnda, sentidoDaTendencia, vizinho, type Direcao } from './tabela';
import type { CasaDaPrevia, ModoDaPrevia, ModoKey, Tom } from './tabela-dados';

/** O vão começa no carbono. */
const Z_INICIAL = 6;

const SETAS: Record<string, Direcao> = {
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  ArrowUp: 'cima',
  ArrowDown: 'baixo',
};

/** Tom da casa como variáveis do CSS da tabela do app (`--tp-*`). */
function estiloDoTom([tom, passo]: Tom): CSSProperties {
  if (!tom) return {};
  return {
    '--tom': `var(--tp-${tom})`,
    '--mix': passo != null ? `var(--tp-calor-${passo})` : 'var(--tp-mix)',
  } as CSSProperties;
}

/** Estimado (ou categoria prevista): só quando há valor para marcar. */
const ehEstimado = (tom: Tom) => tom[0] != null && tom[2] === 1;

const Casa = memo(function Casa({
  casa,
  modo,
  ativa,
  onEscolher,
}: {
  casa: CasaDaPrevia;
  modo: ModoDaPrevia;
  ativa: boolean;
  onEscolher: (z: number) => void;
}) {
  const tom = casa.tons[modo.key];
  return (
    <div
      aria-hidden="true"
      className="tpv-casa"
      data-ativa={ativa || undefined}
      data-desconhecido={tom[0] == null || undefined}
      data-estimado={ehEstimado(tom) || undefined}
      data-calor={modo.key !== 'categoria' || undefined}
      style={
        {
          ...estiloDoTom(tom),
          gridColumn: casa.coluna,
          gridRow: casa.linha,
          '--z': casa.z,
          '--onda': `${atrasoDaOnda(casa, modo)}ms`,
        } as CSSProperties
      }
      // Movimento do mouse, não "entrar": rolar a página com o cursor parado
      // em cima da grade não troca o elemento do vão. O toque usa o clique.
      onPointerMove={(e) => e.pointerType === 'mouse' && onEscolher(casa.z)}
      onClick={() => onEscolher(casa.z)}
    >
      <span className="tpv-traco" />
      <span className="tpv-z font-data">{casa.z}</span>
      <span className="tpv-simbolo">{casa.simbolo}</span>
    </div>
  );
});

/** Marca de qualificador, como na ficha do app: pílula neutra, nunca cor. */
function Marca({ children }: { children: string }) {
  return (
    <span className="ml-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 align-[0.1em] text-[0.6875rem] font-semibold">
      {children}
    </span>
  );
}

function Leitura({ casa, modo, className }: { casa: CasaDaPrevia; modo: ModoDaPrevia; className: string }) {
  const tom = casa.tons[modo.key];
  const valor = modo.key === 'categoria' ? null : casa.valores[modo.key];
  return (
    <div className={`tpv-leitura ${className}`} aria-live="polite">
      <div
        aria-hidden="true"
        className="tpv-ladrilho"
        data-desconhecido={tom[0] == null || undefined}
        style={estiloDoTom(tom)}
      >
        <span className="font-data text-[0.7rem]">{casa.z}</span>
        <span className="font-display text-[2rem] leading-none font-extrabold">{casa.simbolo}</span>
        <span className="font-data text-[0.65rem]">{casa.massa}</span>
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight font-bold tracking-tight">
          <span className="sr-only">{casa.z}, </span>
          {casa.nome}
        </p>
        <p className="mt-0.5 text-sm text-muted">{casa.categoria}</p>
        {modo.key !== 'categoria' && (
          <p className="mt-1.5 text-sm">
            {modo.rotulo}:{' '}
            <span className="font-data font-semibold tabular-nums">{valor ?? 'desconhecido'}</span>
            {ehEstimado(tom) && <Marca>estimado</Marca>}
          </p>
        )}
      </div>
    </div>
  );
}

function Amostra({ tipo }: { tipo: 'sem-dado' | 'estimado' }) {
  return <span className={`tpv-amostra tpv-amostra-${tipo}`} aria-hidden="true" />;
}

function Legenda({ modo }: { modo: ModoDaPrevia }) {
  if (modo.key === 'categoria') {
    return (
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[0.8rem] text-muted" aria-label="Legenda">
        {dados.categorias.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5">
            <span className="tpv-amostra" style={{ '--tom': `var(--tp-${c.key})` } as CSSProperties} aria-hidden="true" />
            {c.plural}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <Amostra tipo="estimado" />
          Categoria prevista
        </li>
      </ul>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8rem] text-muted">
      <span className="flex items-center gap-2">
        menor
        <span className="tpv-escala" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} style={{ '--mix': `var(--tp-calor-${i})` } as CSSProperties} />
          ))}
        </span>
        maior
      </span>
      <span className="flex items-center gap-1.5">
        <Amostra tipo="sem-dado" />
        Desconhecido
      </span>
      <span className="flex items-center gap-1.5">
        <Amostra tipo="estimado" />
        Estimado
      </span>
      <span className="font-semibold text-fg">{sentidoDaTendencia(modo)}</span>
    </div>
  );
}

/**
 * Prévia da tela de tabela periódica do app: a grade da IUPAC com os tons de
 * lá. Trocar a cor faz a nova cor correr pela grade no sentido em que a
 * propriedade cresce; passar o mouse, tocar numa casa ou andar com as setas
 * mostra o elemento no vão entre o H e o He, como no app.
 */
export function TabelaPrevia() {
  const [modoKey, setModoKey] = useState<ModoKey>('categoria');
  const [z, setZ] = useState(Z_INICIAL);
  const modo = dados.modos.find((m) => m.key === modoKey)!;
  const casa = dados.casas[z - 1];

  const andar = (e: KeyboardEvent) => {
    const direcao = SETAS[e.key];
    if (!direcao) return;
    e.preventDefault();
    setZ((atual) => vizinho(dados.casas, atual, direcao));
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Colorir a tabela por" className="seg grid w-full grid-cols-2 sm:flex sm:w-fit">
        {dados.modos.map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === modoKey}
            data-active={m.key === modoKey}
            onClick={() => setModoKey(m.key)}
            className="aperta min-h-10"
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      <div className="tpv-moldura card card-raised flex flex-col gap-4 rounded-[1.25rem] p-3 sm:p-5">
        <div
          className="tpv-grade"
          role="group"
          aria-label="Tabela periódica: use as setas para escolher um elemento"
          tabIndex={0}
          onKeyDown={andar}
        >
          {dados.casas.map((c) => (
            <Casa key={c.z} casa={c} modo={modo} ativa={c.z === z} onEscolher={setZ} />
          ))}
          {/* No grupo 3 dos períodos 6 e 7, o lugar das séries f (embaixo). */}
          <span aria-hidden="true" className="tpv-marcador" style={{ gridColumn: 3, gridRow: 6 }}>
            <span className="tpv-z font-data">57-71</span>
          </span>
          <span aria-hidden="true" className="tpv-marcador" style={{ gridColumn: 3, gridRow: 7 }}>
            <span className="tpv-z font-data">89-103</span>
          </span>
          <Leitura casa={casa} modo={modo} className="tpv-no-vao" />
        </div>
        <Leitura casa={casa} modo={modo} className="tpv-embaixo" />
        <div className="border-t border-line pt-3.5">
          <Legenda modo={modo} />
        </div>
      </div>
    </div>
  );
}
