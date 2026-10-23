import { useEffect, useMemo, useState } from 'react';
import { rotuloIon, type Elemento } from '../../lib/elementos';
import {
  CAMADAS,
  LINHAS_DIAGRAMA,
  ORDEM_PAULING,
  distribuicaoIon,
  formatar,
  formatarAbreviada,
  lerConfiguracao,
  ordemEnergetica,
  ordemGeometrica,
  passosDistribuicao,
  porCamada,
} from '../../lib/configuracao-eletronica';
import { Expoentes } from './Expoentes';
import { IconChevronLeft, IconChevronRight, IconMinus, IconPause, IconPlay, IconPlus } from '../icons';

// Geometria do diagrama (unidades do viewBox).
const W = 50;
const H = 30;
const GX = 16;
const GY = 14;
const ROTULO = 20;
const COLUNA_L = { s: 0, p: 1, d: 2, f: 3 } as const;
const LARGURA = ROTULO + 4 * W + 3 * GX + 8;
const ALTURA = 7 * H + 6 * GY + 8;

const centro = (k: string) => {
  const n = Number(k[0]);
  const col = COLUNA_L[k[1] as keyof typeof COLUNA_L];
  return { x: ROTULO + col * (W + GX) + W / 2, y: (n - 1) * (H + GY) + H / 2 + 4 };
};

/** As diagonais do diagrama: subníveis com o mesmo n + l, de cima à direita para baixo à esquerda. */
function diagonais(): [string, string][] {
  const grupos = new Map<number, string[]>();
  for (const k of ORDEM_PAULING) {
    const soma = Number(k[0]) + COLUNA_L[k[1] as keyof typeof COLUNA_L];
    grupos.set(soma, [...(grupos.get(soma) ?? []), k]);
  }
  return [...grupos.values()].map((ks) => [ks[0], ks[ks.length - 1]]);
}

/**
 * Distribuição eletrônica passo a passo: o diagrama de Pauling se preenche
 * na ordem das diagonais; numa exceção, um passo mostra o ajuste; num íon,
 * os elétrons saem da camada mais externa (ou entram pela ordem de Pauling).
 */
export function Distribuicao({
  lista,
  z,
  carga,
  onElemento,
  onCarga,
}: {
  lista: Elemento[];
  z: number;
  carga: number;
  onElemento: (z: number) => void;
  onCarga: (c: number) => void;
}) {
  const e = lista.find((x) => x.z === z) ?? lista[0];
  const real = useMemo(() => lerConfiguracao(e.configuracao), [e]);
  const ion = useMemo(() => distribuicaoIon(real, carga), [real, carga]);
  const passos = useMemo(() => passosDistribuicao(real, ion ? carga : 0), [real, carga, ion]);
  const [i, setI] = useState(passos.length - 1);
  const [tocando, setTocando] = useState(false);

  // Trocar de elemento ou de carga mostra o resultado final.
  useEffect(() => {
    setI(passos.length - 1);
    setTocando(false);
  }, [passos]);

  useEffect(() => {
    if (!tocando) return;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setInterval(
      () => {
        setI((x) => {
          if (x >= passos.length - 1) {
            setTocando(false);
            return x;
          }
          return x + 1;
        });
      },
      reduzido ? 900 : 550,
    );
    return () => window.clearInterval(t);
  }, [tocando, passos.length]);

  const passo = passos[Math.min(i, passos.length - 1)];
  const final = ion ?? real;
  const tocar = () => {
    if (i >= passos.length - 1) setI(0);
    setTocando((t) => !t);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs font-medium text-muted">
            Elemento
            <select className="input mt-1" value={e.z} onChange={(ev) => onElemento(Number(ev.target.value))}>
              {lista.map((x) => (
                <option key={x.z} value={x.z}>
                  {x.z} · {x.simbolo} · {x.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs font-medium text-muted">
            <span id="tp-carga">Carga</span>
            <div className="mt-1 flex items-center gap-1" role="group" aria-labelledby="tp-carga">
              <button type="button" className="btn btn-ghost size-10 p-0" aria-label="Diminuir a carga" disabled={carga <= -3} onClick={() => onCarga(carga - 1)}>
                <IconMinus width={14} height={14} />
              </button>
              <output className="w-14 text-center font-data text-base font-semibold tabular-nums text-fg" aria-live="polite">
                {carga > 0 ? `+${carga}` : carga < 0 ? `−${-carga}` : '0'}
              </output>
              <button type="button" className="btn btn-ghost size-10 p-0" aria-label="Aumentar a carga" disabled={carga >= 8} onClick={() => onCarga(carga + 1)}>
                <IconPlus width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        <figure className="rounded-2xl border border-line bg-surface-2 p-3">
          <svg
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            className="mx-auto block w-full max-w-[19rem]"
            role="img"
            aria-label={`Diagrama de Pauling, ${passo?.texto ?? ''}`}
          >
            <defs>
              <marker id="tp-ponta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 8 4 0 8z" fill="var(--muted)" />
              </marker>
            </defs>
            {diagonais().map(([a, b]) => {
              const p = centro(a);
              const q = centro(b);
              const dx = -(W + GX);
              const dy = H + GY;
              const k = 0.42;
              return (
                <line
                  key={a}
                  x1={p.x - dx * k}
                  y1={p.y - dy * k}
                  x2={q.x + dx * k}
                  y2={q.y + dy * k}
                  stroke="var(--muted)"
                  strokeOpacity="0.55"
                  strokeWidth="1.2"
                  markerEnd="url(#tp-ponta)"
                />
              );
            })}
            {LINHAS_DIAGRAMA.flat().map((k) => {
              const c = centro(k);
              const eletrons = passo?.ocupacao[k] ?? 0;
              const destaque = passo?.destaque === k;
              const ordem = ORDEM_PAULING.indexOf(k) + 1;
              return (
                <g key={k}>
                  <rect
                    x={c.x - W / 2}
                    y={c.y - H / 2}
                    width={W}
                    height={H}
                    rx="7"
                    style={{
                      fill: eletrons ? 'color-mix(in srgb, var(--fg) 12%, var(--surface))' : 'var(--surface)',
                      stroke: destaque ? 'var(--brand)' : 'var(--line)',
                      strokeWidth: destaque ? 2 : 1,
                      transition: 'fill 200ms ease, stroke 150ms ease',
                    }}
                  />
                  <text
                    x={c.x}
                    y={c.y + 4.5}
                    textAnchor="middle"
                    style={{ font: '600 12px var(--font-mono)', fill: eletrons ? 'var(--fg)' : 'var(--muted)' }}
                  >
                    {k}
                    {eletrons ? (
                      <tspan dy="-5" style={{ fontSize: '8.5px' }}>
                        {eletrons}
                      </tspan>
                    ) : null}
                  </text>
                  <text x={c.x + W / 2 - 4} y={c.y - H / 2 + 8} textAnchor="end" style={{ font: '8px var(--font-mono)', fill: 'var(--muted)' }}>
                    {ordem}
                  </text>
                </g>
              );
            })}
            {CAMADAS.map((camada, n) => (
              <text key={camada} x={2} y={n * (H + GY) + H / 2 + 8.5} style={{ font: '600 10px var(--font-mono)', fill: 'var(--muted)' }}>
                {camada}
              </text>
            ))}
          </svg>
          <figcaption className="mt-2 text-center text-xs text-muted">
            O número no canto é a ordem de preenchimento; as setas seguem as diagonais.
          </figcaption>
        </figure>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary px-3 text-sm" onClick={tocar}>
            {tocando ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
            {tocando ? 'Pausar' : i >= passos.length - 1 ? 'Mostrar do início' : 'Continuar'}
          </button>
          <button type="button" className="btn btn-ghost size-10 p-0" aria-label="Passo anterior" disabled={i <= 0} onClick={() => { setTocando(false); setI(i - 1); }}>
            <IconChevronLeft width={16} height={16} />
          </button>
          <button type="button" className="btn btn-ghost size-10 p-0" aria-label="Próximo passo" disabled={i >= passos.length - 1} onClick={() => { setTocando(false); setI(i + 1); }}>
            <IconChevronRight width={16} height={16} />
          </button>
          <p className="ml-auto text-right text-xs text-muted" aria-live="polite">
            <span className="font-data tabular-nums">
              {Math.min(i, passos.length - 1) + 1}/{passos.length}
            </span>{' '}
            · <span className="text-fg"><Expoentes texto={passo?.texto ?? ''} /></span>
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <p className="font-display text-3xl font-extrabold tracking-tight"><Expoentes texto={rotuloIon(e.simbolo, ion ? carga : 0)} /></p>
          <p className="text-sm text-muted">
            {e.nome}, {e.z} prótons e {e.z - (ion ? carga : 0)} elétrons
          </p>
        </div>
        {!ion && carga !== 0 && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            O {e.nome.toLowerCase()} não tem {carga} elétrons para perder. Diminua a carga.
          </p>
        )}
        <dl className="divide-y divide-line rounded-2xl border border-line">
          {[
            ['Ordem energética', formatar(ordemEnergetica(final))],
            ['Ordem geométrica', formatar(ordemGeometrica(final))],
            ['Abreviada', formatarAbreviada(final) || '—'],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
              <dt className="text-xs font-medium text-muted">{rotulo}</dt>
              <dd className="font-data text-sm tabular-nums break-words">{valor ? <Expoentes texto={valor} /> : 'sem elétrons'}</dd>
            </div>
          ))}
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-xs font-medium text-muted">Por camada</dt>
            <dd className="flex flex-wrap gap-1.5">
              {porCamada(final).map((n, k) => (
                <span key={k} className="tp-marca font-data">
                  {CAMADAS[k]} {n}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        {ion && carga > 0 && (
          <p className="text-sm text-muted text-pretty">
            No cátion, os elétrons saem da camada mais externa, não do último subnível preenchido: por isso o Fe²⁺ perde
            os dois elétrons do 4s antes de tocar no 3d.
          </p>
        )}
        {ion && carga < 0 && (
          <p className="text-sm text-muted text-pretty">
            No ânion, os elétrons entram seguindo o diagrama, no primeiro subnível que não está cheio.
          </p>
        )}
        {passos.some((p) => p.tipo === 'ajuste') && (
          <p className="text-sm text-muted text-pretty">
            O {e.nome.toLowerCase()} é uma exceção: a configuração medida foge da prevista pelo diagrama, e a contagem do íon
            parte da configuração real.
          </p>
        )}
        {e.configuracaoPrevista && (
          <p className="text-sm text-muted">A configuração deste elemento é prevista por cálculos; nunca foi medida.</p>
        )}
      </div>
    </div>
  );
}
