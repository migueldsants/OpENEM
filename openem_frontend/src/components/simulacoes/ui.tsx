/**
 * Peças comuns das simulações: o palco 2D (canvas com laço de animação), os
 * controles, as leituras, o gráfico em SVG e o texto de apoio.
 */
import { useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Markdown } from '../Markdown';
import { Portal, useDialog } from '../Modal';
import { IconBook, IconCube, IconPause, IconPlay, IconUndo, IconX } from '../icons';
import { marcasEixo, usaMovimentoReduzido, useCores, type Cores } from './canvas';
import { ExplicacaoCtx, PalcoCheioCtx, type LugarExplicacao } from './contexto';
import './simulacoes.css';

// ---------------------------------------------------------------------------
// Palco 2D
// ---------------------------------------------------------------------------

export type Quadro = (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, cores: Cores) => void;

export interface Ponteiro {
  tipo: 'down' | 'move' | 'up';
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Canvas responsivo (nitidez em tela retina) com um laço de animação. A cada
 * quadro chama `quadro` com o tempo decorrido em segundos (no máximo 1/20 s:
 * voltar de outra aba não dá um salto na física).
 */
export function Palco2D({
  quadro,
  proporcao = 16 / 9,
  rotulo,
  onPonteiro,
  alturaMin = 220,
}: {
  quadro: Quadro;
  proporcao?: number;
  rotulo: string;
  onPonteiro?: (p: Ponteiro) => void;
  alturaMin?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cheio = useContext(PalcoCheioCtx);
  const quadroRef = useRef(quadro);
  const cores = useCores();
  const coresRef = useRef(cores);
  useEffect(() => {
    quadroRef.current = quadro;
    coresRef.current = cores;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    let raf = 0;
    let ultimo = performance.now();
    let w = 0;
    let h = 0;
    const medir = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(canvas);
    // Fora da tela (o aluno rolou para longe do palco), o laço para: nem física nem desenho.
    let visivel = true;
    const laco = (agora: number) => {
      const dt = Math.min((agora - ultimo) / 1000, 1 / 20);
      ultimo = agora;
      if (w > 0 && h > 0) {
        ctx!.save();
        ctx!.clearRect(0, 0, w, h);
        quadroRef.current(ctx!, w, h, dt, coresRef.current);
        ctx!.restore();
      }
      if (visivel) raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !visivel) {
              ultimo = performance.now();
              raf = requestAnimationFrame(laco);
            } else if (!e.isIntersecting && visivel) cancelAnimationFrame(raf);
            visivel = e.isIntersecting;
          })
        : null;
    io?.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  const ponteiro = (tipo: Ponteiro['tipo']) => (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onPonteiro) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (tipo === 'down') e.currentTarget.setPointerCapture?.(e.pointerId);
    onPonteiro({ tipo, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
  };

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={rotulo}
      className={`block w-full touch-none select-none rounded-xl bg-surface-2 ${cheio ? 'sim-palco-cheio' : ''}`}
      style={{ aspectRatio: String(proporcao), minHeight: alturaMin } as CSSProperties}
      onPointerDown={onPonteiro ? ponteiro('down') : undefined}
      onPointerMove={onPonteiro ? ponteiro('move') : undefined}
      onPointerUp={onPonteiro ? ponteiro('up') : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout e controles
// ---------------------------------------------------------------------------

/**
 * Palco à esquerda, ocupando a altura da tela no desktop (a simulação cabe sem
 * rolar a página), com as medidas numa faixa embaixo; controles à direita,
 * rolando por dentro se precisar. Gráficos e blocos extras ficam numa aba ao
 * lado dos controles, para a cena continuar à vista enquanto o gráfico anda.
 * No celular, tudo empilha.
 */
export function LayoutSim({
  palco,
  controles,
  leituras,
  extra,
  rotuloExtra = 'Gráficos',
  palcoFixo = true,
}: {
  palco: ReactNode;
  controles: ReactNode;
  leituras?: ReactNode;
  extra?: ReactNode;
  /** Nome da aba do `extra` (um gráfico, um texto, a tradução do DNA). */
  rotuloExtra?: string;
  /**
   * No celular, o palco fica preso no topo enquanto o aluno rola até os
   * controles, para ver o efeito do que mexe. Desligue em palcos altos (uma
   * tabela, um quadro) que tomariam a tela.
   */
  palcoFixo?: boolean;
}) {
  const [aba, setAba] = useState<'controles' | 'graficos'>('controles');
  const id = useId();
  return (
    <div className="grid gap-3 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
      {/* No celular a coluna some (contents): o palco vira item da grade e pode ficar preso ao longo da tela toda. */}
      <div className="contents min-w-0 lg:flex lg:min-h-0 lg:flex-col lg:gap-3">
        <div className={`min-w-0 lg:min-h-0 lg:flex-1 ${palcoFixo ? 'sim-palco-fixo' : ''}`}>
          <div className="card card-raised p-2 lg:h-full">
            <PalcoCheioCtx.Provider value>{palco}</PalcoCheioCtx.Provider>
          </div>
        </div>
        {leituras}
      </div>
      <aside className="card flex flex-col overflow-hidden lg:min-h-0" aria-label="Controles da simulação">
        {extra && (
          <div className="border-b border-line p-2">
            <div className="seg flex w-full" role="tablist" aria-label="Painel">
              {(['controles', 'graficos'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="tab"
                  id={`${id}-${a}`}
                  aria-selected={aba === a}
                  aria-controls={`${id}-${a}-painel`}
                  data-active={aba === a}
                  onClick={() => setAba(a)}
                  className="flex-1"
                >
                  {a === 'controles' ? 'Controles' : rotuloExtra}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Os dois ficam montados (hidden), para o gráfico não perder o histórico ao trocar de aba. */}
        <div
          id={`${id}-controles-painel`}
          role={extra ? 'tabpanel' : undefined}
          aria-labelledby={extra ? `${id}-controles` : undefined}
          hidden={aba !== 'controles'}
          className="space-y-5 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        >
          {controles}
        </div>
        {extra && (
          <div
            id={`${id}-graficos-painel`}
            role="tabpanel"
            aria-labelledby={`${id}-graficos`}
            hidden={aba !== 'graficos'}
            className="space-y-5 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            {extra}
          </div>
        )}
      </aside>
    </div>
  );
}

export function Deslizador({
  rotulo,
  valor,
  min,
  max,
  passo = 1,
  unidade,
  formatar,
  onChange,
  dica,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  unidade?: string;
  formatar?: (v: number) => string;
  onChange: (v: number) => void;
  dica?: string;
}) {
  const id = useId();
  const mostrado = formatar ? formatar(valor) : valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {rotulo}
        </label>
        <span className="font-data text-sm font-semibold tabular-nums">
          {mostrado}
          {unidade && <span className="ml-0.5 font-sans text-xs font-medium text-muted"> {unidade}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sim-range w-full"
        aria-valuetext={`${mostrado}${unidade ? ` ${unidade}` : ''}`}
      />
      {dica && <p className="text-xs text-muted">{dica}</p>}
    </div>
  );
}

export function Seletor<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <select id={id} className="input" value={valor} onChange={(e) => onChange(e.target.value as T)}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Segmentos<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{rotulo}</p>
      <div className="seg flex w-full flex-wrap" role="radiogroup" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            data-active={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className="flex-1 whitespace-nowrap"
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Alternar({
  rotulo,
  marcado,
  onChange,
  dica,
}: {
  rotulo: string;
  marcado: boolean;
  onChange: (v: boolean) => void;
  dica?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
        {rotulo}
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={marcado}
          onChange={(e) => onChange(e.target.checked)}
          className="sim-switch"
        />
      </label>
      {dica && <p className="mt-1 text-xs text-muted">{dica}</p>}
    </div>
  );
}

/** Rodar/pausar, reiniciar e a velocidade da animação. */
export function BarraExecucao({
  rodando,
  onAlternar,
  onReiniciar,
  velocidade,
  onVelocidade,
  velocidades = [0.25, 0.5, 1, 2],
}: {
  rodando: boolean;
  onAlternar: () => void;
  onReiniciar?: () => void;
  velocidade?: number;
  onVelocidade?: (v: number) => void;
  velocidades?: number[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1" onClick={onAlternar}>
          {rodando ? <IconPause width={16} height={16} /> : <IconPlay width={16} height={16} />}
          {rodando ? 'Pausar' : 'Rodar'}
        </button>
        {onReiniciar && (
          <button type="button" className="btn btn-ghost" onClick={onReiniciar}>
            <IconUndo width={16} height={16} />
            Reiniciar
          </button>
        )}
      </div>
      {velocidade !== undefined && onVelocidade && (
        <Segmentos
          rotulo="Velocidade da animação"
          valor={String(velocidade)}
          opcoes={velocidades.map((v) => ({ valor: String(v), rotulo: `${v.toLocaleString('pt-BR')}×` }))}
          onChange={(v) => onVelocidade(Number(v))}
        />
      )}
    </div>
  );
}

export interface ItemLeitura {
  rotulo: string;
  valor: ReactNode;
  cor?: string;
  nota?: string;
}

/**
 * Medidas ao vivo, numa faixa compacta embaixo do palco. A nota de cada
 * medida (a fórmula, o valor sem ar…) não ocupa a faixa: aparece na dica do
 * mouse, ao tocar no nome da medida (sublinhado pontilhado) e para leitor de tela.
 */
export function Leituras({ itens, titulo = 'Medidas' }: { itens: ItemLeitura[]; titulo?: string }) {
  // Nota aberta pelo toque (no mouse, a dica do `title` já mostra).
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <section className="card px-4 py-3" aria-label={titulo}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[repeat(auto-fit,minmax(128px,1fr))]">
        {itens.map((it) => {
          const rotulo = (
            <>
              {it.cor && <span className="size-2 shrink-0 rounded-full" style={{ background: it.cor }} />}
              <span className="truncate">{it.rotulo}</span>
            </>
          );
          return (
            <div key={it.rotulo} className="min-w-0" title={it.nota}>
              <dt className="text-[11px] text-muted">
                {it.nota ? (
                  <button
                    type="button"
                    className="flex max-w-full items-center gap-1.5 text-left underline decoration-dotted decoration-[color-mix(in_oklab,var(--muted)_60%,transparent)] underline-offset-2"
                    aria-expanded={aberta === it.rotulo}
                    onClick={() => setAberta(aberta === it.rotulo ? null : it.rotulo)}
                  >
                    {rotulo}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5">{rotulo}</span>
                )}
              </dt>
              <dd className="font-data text-sm font-semibold tabular-nums" aria-live="off">
                {it.valor}
                {it.nota &&
                  (aberta === it.rotulo ? (
                    <span className="block font-sans text-[11px] font-normal text-muted text-pretty">{it.nota}</span>
                  ) : (
                    <span className="sr-only"> ({it.nota})</span>
                  ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function TextoExplicacao({ children, enem }: { children: string; enem?: string }) {
  return (
    <>
      <div>
        <h3 className="mb-2 text-sm font-bold">Entenda</h3>
        <Markdown className="text-sm leading-relaxed">{children}</Markdown>
      </div>
      {enem && (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <h3 className="mb-1.5 text-sm font-bold">No ENEM</h3>
          <Markdown className="text-sm leading-relaxed">{enem}</Markdown>
        </div>
      )}
    </>
  );
}

function ModalExplicacao({ lugar, onClose, children, enem }: { lugar: LugarExplicacao; onClose: () => void; children: string; enem?: string }) {
  const painel = useRef<HTMLDivElement>(null);
  const titulo = useId();
  // A saída anima antes de desmontar (sem movimento reduzido, fecha na hora).
  const [fechando, setFechando] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const fechar = () => {
    if (usaMovimentoReduzido()) return onClose();
    setFechando(true);
    timer.current = window.setTimeout(onClose, 180);
  };
  useDialog(painel, fechar);
  const { info } = lugar;
  return (
    <Portal>
      <div className="sim-modal-fundo fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" data-fechando={fechando} onClick={fechar}>
        <div
          ref={painel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titulo}
          tabIndex={-1}
          className="sim-modal card card-raised flex max-h-[88dvh] w-full max-w-2xl flex-col outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line p-5 pb-4">
            <div className="min-w-0 space-y-1.5">
              <h2 id={titulo} className="font-display text-xl font-extrabold tracking-tight">
                {info.titulo}
              </h2>
              <p className="text-sm text-muted text-pretty">{info.resumo}</p>
              <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Assuntos">
                <li className="chip font-data font-bold">
                  {info.dimensao === '3D' && <IconCube width={13} height={13} />}
                  {info.dimensao}
                </li>
                {info.conceitos.map((c) => (
                  <li key={c} className="chip text-muted">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="btn btn-ghost shrink-0 px-2.5" onClick={fechar} aria-label="Fechar">
              <IconX width={18} height={18} />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-5">
            <TextoExplicacao enem={enem}>{children}</TextoExplicacao>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * Texto de apoio: o que observar, a ciência por trás e como cai no ENEM. Na
 * página da simulação vira o botão "Entenda" no cabeçalho, que abre um modal
 * (a cena fica inteira na tela); fora dela, aparece no fluxo.
 */
export function Explicacao({ children, enem }: { children: string; enem?: string }) {
  const lugar = useContext(ExplicacaoCtx);
  const [aberto, setAberto] = useState(false);
  if (!lugar) {
    return (
      <section className="card space-y-4 p-5" aria-label="Entenda a simulação">
        <TextoExplicacao enem={enem}>{children}</TextoExplicacao>
      </section>
    );
  }
  if (!lugar.slot) return null;
  return createPortal(
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setAberto(true)} aria-haspopup="dialog">
        <IconBook width={16} height={16} />
        Entenda
      </button>
      {aberto && (
        <ModalExplicacao lugar={lugar} onClose={() => setAberto(false)} enem={enem}>
          {children}
        </ModalExplicacao>
      )}
    </>,
    lugar.slot,
  );
}

// ---------------------------------------------------------------------------
// Gráfico de linhas (SVG)
// ---------------------------------------------------------------------------

export interface Serie {
  rotulo: string;
  cor: string;
  pontos: readonly (readonly [number, number])[];
  tracejado?: boolean;
  largura?: number;
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width || 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Grafico({
  series,
  rotuloX,
  rotuloY,
  xMin,
  xMax,
  yMin,
  yMax,
  altura = 220,
  verticais = [],
  horizontais = [],
  pontos = [],
  titulo,
}: {
  series: Serie[];
  rotuloX: string;
  rotuloY: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  altura?: number;
  verticais?: { x: number; rotulo?: string; cor?: string }[];
  horizontais?: { y: number; rotulo?: string; cor?: string }[];
  pontos?: { x: number; y: number; cor: string }[];
  titulo?: string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const todos = series.flatMap((s) => s.pontos);
  const x0 = xMin ?? Math.min(...todos.map((p) => p[0]), 0);
  const x1 = xMax ?? Math.max(...todos.map((p) => p[0]), x0 + 1);
  const ys = todos.map((p) => p[1]).filter(Number.isFinite);
  const y0 = yMin ?? Math.min(0, ...ys);
  let y1 = yMax ?? Math.max(...ys, y0 + 1e-9);
  if (y1 <= y0) y1 = y0 + 1;
  const m = { e: 46, d: 12, t: 12, b: 34 };
  const W = Math.max(200, largura);
  const H = altura;
  const sx = (x: number) => m.e + ((x - x0) / (x1 - x0 || 1)) * (W - m.e - m.d);
  const sy = (y: number) => H - m.b - ((y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const fmtEixo = (v: number) =>
    Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-2 && v !== 0)
      ? v.toExponential(0).replace('e', '·10^')
      : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  return (
    <figure className="min-w-0" ref={ref}>
      {titulo && <figcaption className="mb-1 text-sm font-semibold">{titulo}</figcaption>}
      <svg width={W} height={H} role="img" aria-label={`${titulo ?? 'Gráfico'}: ${rotuloY} em função de ${rotuloX}`} className="block max-w-full overflow-visible">
        {marcasEixo(y0, y1).map((v) => (
          <g key={`y${v}`}>
            <line x1={m.e} x2={W - m.d} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={m.e - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
              {fmtEixo(v)}
            </text>
          </g>
        ))}
        {marcasEixo(x0, x1, Math.max(3, Math.floor(W / 90))).map((v) => (
          <text key={`x${v}`} x={sx(v)} y={H - m.b + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {fmtEixo(v)}
          </text>
        ))}
        <text x={(m.e + W - m.d) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--muted)">
          {rotuloX}
        </text>
        <text x={12} y={(m.t + H - m.b) / 2} textAnchor="middle" fontSize={11} fill="var(--muted)" transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`}>
          {rotuloY}
        </text>
        {horizontais.map((h, i) => (
          <g key={`h${i}`}>
            <line x1={m.e} x2={W - m.d} y1={sy(h.y)} y2={sy(h.y)} stroke={h.cor ?? 'var(--muted)'} strokeDasharray="4 4" />
            {h.rotulo && (
              <text x={W - m.d - 4} y={sy(h.y) - 4} textAnchor="end" fontSize={10} fill={h.cor ?? 'var(--muted)'}>
                {h.rotulo}
              </text>
            )}
          </g>
        ))}
        {verticais.map((v, i) => (
          <g key={`v${i}`}>
            <line x1={sx(v.x)} x2={sx(v.x)} y1={m.t} y2={H - m.b} stroke={v.cor ?? 'var(--muted)'} strokeDasharray="4 4" />
            {v.rotulo && (
              <text x={sx(v.x) + 4} y={m.t + 10} fontSize={10} fill={v.cor ?? 'var(--muted)'}>
                {v.rotulo}
              </text>
            )}
          </g>
        ))}
        <clipPath id={`clip-${rotuloX}-${rotuloY}`.replace(/[^a-z0-9-]/gi, '')}>
          <rect x={m.e} y={m.t - 2} width={W - m.e - m.d} height={H - m.t - m.b + 4} />
        </clipPath>
        <g clipPath={`url(#${`clip-${rotuloX}-${rotuloY}`.replace(/[^a-z0-9-]/gi, '')})`}>
          {series.map((s) => (
            <polyline
              key={s.rotulo}
              fill="none"
              stroke={s.cor}
              strokeWidth={s.largura ?? 2}
              strokeDasharray={s.tracejado ? '5 4' : undefined}
              strokeLinejoin="round"
              points={s.pontos.filter((p) => Number.isFinite(p[1])).map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')}
            />
          ))}
        </g>
        {pontos.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(Math.min(y1, Math.max(y0, p.y)))} r={4.5} fill={p.cor} stroke="var(--surface)" strokeWidth={2} />
        ))}
      </svg>
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <li key={s.rotulo} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.cor }} />
              {s.rotulo}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Grupo de um gráfico ou bloco extra (na aba "Gráficos" do painel). */
export function Bloco({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      {titulo && <h3 className="text-sm font-bold">{titulo}</h3>}
      {children}
    </section>
  );
}
