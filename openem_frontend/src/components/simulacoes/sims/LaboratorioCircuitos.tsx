import { useMemo, useRef, useState } from 'react';
import {
  brilho,
  chaveAresta,
  COLUNAS,
  CORRENTE_CURTO,
  LINHAS,
  montagem,
  novoId,
  QUEIMA,
  resistenciaEquivalente,
  resolverComQueima,
  resolverLab,
  U_LAMPADA,
  type Montagem,
  type Peca,
  type Ponto,
  type ResultadoLab,
  type TipoPeca,
} from '../../../lib/simulacoes/laboratorio-circuitos';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, type Cores } from '../canvas';
import { Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, type Ponteiro } from '../ui';

type Ferramenta = TipoPeca | 'selecionar' | 'apagar';

const FERRAMENTAS: { valor: Ferramenta; rotulo: string }[] = [
  { valor: 'selecionar', rotulo: 'Selecionar' },
  { valor: 'fio', rotulo: 'Fio' },
  { valor: 'bateria', rotulo: 'Bateria' },
  { valor: 'lampada', rotulo: 'Lâmpada' },
  { valor: 'resistor', rotulo: 'Resistor' },
  { valor: 'chave', rotulo: 'Chave' },
  { valor: 'amperimetro', rotulo: 'Amperímetro' },
  { valor: 'voltimetro', rotulo: 'Voltímetro' },
  { valor: 'apagar', rotulo: 'Apagar' },
];

const NOME: Record<TipoPeca, string> = {
  fio: 'Fio',
  bateria: 'Bateria',
  lampada: 'Lâmpada',
  resistor: 'Resistor',
  chave: 'Chave',
  amperimetro: 'Amperímetro',
  voltimetro: 'Voltímetro',
};

const PADRAO: Partial<Record<TipoPeca, Partial<Peca>>> = {
  bateria: { valor: 6 },
  lampada: { valor: 6 },
  resistor: { valor: 10 },
  chave: { fechada: true },
};

interface Grade {
  ox: number;
  oy: number;
  passo: number;
}

function grade(w: number, h: number): Grade {
  const m = 34;
  const passo = Math.min((w - 2 * m) / (COLUNAS - 1), (h - 2 * m) / (LINHAS - 1));
  return { passo, ox: (w - passo * (COLUNAS - 1)) / 2, oy: (h - passo * (LINHAS - 1)) / 2 };
}

const xy = (g: Grade, p: Ponto): [number, number] => [g.ox + p[0] * g.passo, g.oy + p[1] * g.passo];

/** Aresta da grade mais perto do ponteiro (ou nada, longe de todas). */
function arestaPerto(g: Grade, x: number, y: number): [Ponto, Ponto] | null {
  const fx = (x - g.ox) / g.passo;
  const fy = (y - g.oy) / g.passo;
  const candidatas: [Ponto, Ponto][] = [
    [[Math.floor(fx), Math.round(fy)], [Math.floor(fx) + 1, Math.round(fy)]],
    [[Math.round(fx), Math.floor(fy)], [Math.round(fx), Math.floor(fy) + 1]],
  ];
  let melhor: [Ponto, Ponto] | null = null;
  let dMin = 0.32;
  for (const [a, b] of candidatas) {
    if ([a, b].some((p) => p[0] < 0 || p[1] < 0 || p[0] >= COLUNAS || p[1] >= LINHAS)) continue;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    // Distância à aresta, valendo mais o afastamento perpendicular.
    const d = a[0] === b[0] ? Math.abs(fx - mx) + Math.max(0, Math.abs(fy - my) - 0.5) : Math.abs(fy - my) + Math.max(0, Math.abs(fx - mx) - 0.5);
    if (d < dMin) {
      dMin = d;
      melhor = [a, b];
    }
  }
  return melhor;
}

const fmtA = (i: number) => (Math.abs(i) < 0.995 ? `${fmt(Math.abs(i) * 1000, 0)} mA` : `${fmt(Math.abs(i), 2)} A`);

function desenharPeca(ctx: CanvasRenderingContext2D, g: Grade, p: Peca, r: ResultadoLab, c: Cores) {
  const [x1, y1] = xy(g, p.a);
  const [x2, y2] = xy(g, p.b);
  const L = g.passo;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const s = Math.min(L * 0.42, 34); // meia largura do símbolo
  ctx.save();
  ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
  ctx.rotate(ang);
  const fio = (de: number, ate: number) => {
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(de, 0); ctx.lineTo(ate, 0); ctx.stroke();
  };
  // Rótulos ficam sempre na horizontal, embaixo ou ao lado da peça.
  const rotulo = (t: string, cor: string) => {
    ctx.save();
    ctx.rotate(-ang);
    const vertical = Math.abs(Math.sin(ang)) > 0.5;
    texto(ctx, t, vertical ? s * 0.75 : 0, vertical ? 4 : s * 0.95, cor, { alinhar: vertical ? 'left' : 'center', tamanho: 11, peso: 600, mono: true });
    ctx.restore();
  };
  switch (p.tipo) {
    case 'fio':
      fio(-L / 2, L / 2);
      break;
    case 'resistor': {
      fio(-L / 2, -s * 0.8);
      fio(s * 0.8, L / 2);
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, 0);
      for (let k = 0; k < 6; k++) ctx.lineTo(-s * 0.8 + ((k + 0.5) * 1.6 * s) / 6, k % 2 ? 7 : -7);
      ctx.lineTo(s * 0.8, 0);
      ctx.stroke();
      rotulo(`${fmt(p.valor ?? 10, 1)} Ω`, c.muted);
      break;
    }
    case 'bateria': {
      // `a` é o negativo (placa curta e grossa), `b` o positivo (placa longa e fina).
      fio(-L / 2, -6);
      fio(6, L / 2);
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6, 8); ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(6, -16); ctx.lineTo(6, 16); ctx.stroke();
      if (r.curto) {
        ctx.fillStyle = alfa(c.danger, 0.25);
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.rotate(-ang);
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      texto(ctx, '+', ux * 15 - uy * 16, uy * 15 + ux * 16 + 5, c.danger, { alinhar: 'center', peso: 800, tamanho: 15 });
      texto(ctx, '−', -ux * 15 - uy * 16, -uy * 15 + ux * 16 + 5, c.mat, { alinhar: 'center', peso: 800, tamanho: 15 });
      ctx.restore();
      rotulo(`${fmt(p.valor ?? 6, 1)} V`, c.fg);
      break;
    }
    case 'lampada': {
      const R = Math.min(s * 0.62, 15);
      fio(-L / 2, -R);
      fio(R, L / 2);
      const b = brilho(p, r);
      if (b > 0.02) {
        const gr = ctx.createRadialGradient(0, 0, 3, 0, 0, R + 34 * Math.min(1, b));
        gr.addColorStop(0, `rgba(255, 214, 102, ${(0.85 * Math.min(1, b)).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255, 214, 102, 0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, R + 34 * Math.min(1, b), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = p.queimada ? alfa(c.muted, 0.25) : b > 0.02 ? `rgb(255, ${Math.round(190 + 50 * Math.min(1, b))}, ${Math.round(80 + 120 * Math.min(1, b))})` : c.surface;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = p.queimada ? c.danger : alfa('#7c2d12', 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (p.queimada) {
        ctx.moveTo(-R * 0.55, R * 0.3); ctx.lineTo(-R * 0.15, -R * 0.3);
        ctx.moveTo(R * 0.15, -R * 0.3); ctx.lineTo(R * 0.55, R * 0.3);
      } else {
        ctx.moveTo(-R * 0.6, R * 0.35);
        for (let k = 0; k <= 4; k++) ctx.lineTo(-R * 0.6 + (k * 1.2 * R) / 4, k % 2 ? -R * 0.35 : R * 0.1);
        ctx.lineTo(R * 0.6, R * 0.35);
      }
      ctx.stroke();
      rotulo(p.queimada ? 'queimou' : `${fmt(p.valor ?? 6, 0)} W`, p.queimada ? c.danger : c.muted);
      break;
    }
    case 'chave': {
      fio(-L / 2, -s * 0.7);
      fio(s * 0.7, L / 2);
      ctx.fillStyle = c.fg;
      ctx.beginPath(); ctx.arc(-s * 0.7, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.7, 0, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, 0);
      const a = p.fechada ? 0 : -0.55;
      ctx.lineTo(-s * 0.7 + Math.cos(a) * 1.4 * s, Math.sin(a) * 1.4 * s);
      ctx.stroke();
      rotulo(p.fechada ? 'fechada' : 'aberta', p.fechada ? c.muted : c.danger);
      break;
    }
    case 'amperimetro':
    case 'voltimetro': {
      const R = Math.min(s * 0.6, 14);
      fio(-L / 2, -R);
      fio(R, L / 2);
      const cor = p.tipo === 'amperimetro' ? c.mat : c.lin;
      ctx.fillStyle = c.surface;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.rotate(-ang);
      texto(ctx, p.tipo === 'amperimetro' ? 'A' : 'V', 0, 4.5, cor, { alinhar: 'center', peso: 800, tamanho: 13 });
      ctx.restore();
      rotulo(p.tipo === 'amperimetro' ? fmtA(r.correntes[p.id]) : `${fmt(Math.abs(r.tensoes[p.id]), 2)} V`, cor);
      break;
    }
  }
  ctx.restore();
}

export default function LaboratorioCircuitos() {
  const [pecas, setPecas] = useState<Peca[]>(() => montagem('serie'));
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mira, setMira] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const resultado = useMemo(() => resolverLab(pecas), [pecas]);
  const fases = useRef(new Map<string, number>());
  const arrastando = useRef(false);

  /** Toda mudança passa por aqui: resolve e queima as lâmpadas em excesso. */
  const mudar = (fn: (atual: Peca[]) => Peca[]) => {
    const { pecas: depois, queimaram } = resolverComQueima(fn(pecas));
    setPecas(depois);
    setAviso(
      queimaram.length
        ? `${queimaram.length === 1 ? 'Uma lâmpada queimou' : `${queimaram.length} lâmpadas queimaram`}: passou de ${fmt(QUEIMA, 2)}× a potência nominal.`
        : null,
    );
  };

  const pecaNa = (a: Ponto, b: Ponto) => pecas.find((p) => chaveAresta(p.a, p.b) === chaveAresta(a, b));

  const usar = (a: Ponto, b: Ponto, arrasto: boolean) => {
    const existente = pecaNa(a, b);
    if (ferramenta === 'selecionar') {
      if (arrasto) return;
      if (existente?.tipo === 'chave') mudar((ps) => ps.map((p) => (p.id === existente.id ? { ...p, fechada: !p.fechada } : p)));
      setSelecionada(existente?.id ?? null);
      return;
    }
    if (ferramenta === 'apagar') {
      if (existente) mudar((ps) => ps.filter((p) => p.id !== existente.id));
      if (existente?.id === selecionada) setSelecionada(null);
      return;
    }
    // Arrastando, só o fio sai desenhando, e só em aresta livre.
    if (arrasto && (ferramenta !== 'fio' || existente)) return;
    if (existente?.tipo === ferramenta) {
      setSelecionada(existente.id);
      return;
    }
    const nova: Peca = { id: novoId(), tipo: ferramenta, a, b, ...PADRAO[ferramenta] };
    mudar((ps) => [...ps.filter((p) => p.id !== existente?.id), nova]);
    if (ferramenta !== 'fio') setSelecionada(nova.id);
  };

  const onPonteiro = (e: Ponteiro) => {
    const g = grade(e.w, e.h);
    const ar = arestaPerto(g, e.x, e.y);
    const chave = ar ? chaveAresta(ar[0], ar[1]) : null;
    if (e.tipo === 'move') {
      if (chave !== mira) setMira(chave);
      if (arrastando.current && ar) usar(ar[0], ar[1], true);
      return;
    }
    if (e.tipo === 'up') {
      arrastando.current = false;
      return;
    }
    arrastando.current = true;
    if (ar) usar(ar[0], ar[1], false);
    else if (ferramenta === 'selecionar') setSelecionada(null);
  };

  const quadro = (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, c: Cores) => {
    const g = grade(w, h);
    // Pontos da bancada.
    for (let i = 0; i < COLUNAS; i++) {
      for (let j = 0; j < LINHAS; j++) {
        const [x, y] = xy(g, [i, j]);
        ctx.fillStyle = alfa(c.muted, 0.35);
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Aresta sob o ponteiro.
    if (mira && ferramenta !== 'selecionar') {
      const [pa, pb] = mira.split('|').map((k) => k.split(',').map(Number) as unknown as Ponto);
      const [x1, y1] = xy(g, pa);
      const [x2, y2] = xy(g, pb);
      ctx.strokeStyle = ferramenta === 'apagar' ? alfa(c.danger, 0.35) : alfa(c.brand, 0.3);
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    for (const p of pecas) {
      if (p.id === selecionada) {
        const [x1, y1] = xy(g, p.a);
        const [x2, y2] = xy(g, p.b);
        ctx.strokeStyle = alfa(c.brand, 0.55);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(Math.min(x1, x2) - 22, Math.min(y1, y2) - 22, Math.abs(x2 - x1) + 44, Math.abs(y2 - y1) + 44);
        ctx.setLineDash([]);
      }
      desenharPeca(ctx, g, p, resultado, c);
    }
    // Cargas andando no sentido convencional, mais rápidas com mais corrente.
    for (const p of pecas) {
      const i = resultado.correntes[p.id] ?? 0;
      if (Math.abs(i) < 1e-4 || p.tipo === 'voltimetro') continue;
      const v = Math.min(140, 10 + Math.abs(i) * 45) * Math.sign(i);
      const f = ((fases.current.get(p.id) ?? 0) + v * dt) % 16;
      fases.current.set(p.id, f);
      const [x1, y1] = xy(g, p.a);
      const [x2, y2] = xy(g, p.b);
      const L = Math.hypot(x2 - x1, y2 - y1);
      ctx.fillStyle = c.hum;
      // Nas peças, as cargas andam só nos terminais: o símbolo fica limpo.
      const livre = p.tipo === 'fio' ? 0 : Math.min(g.passo * 0.42, 34) + 2;
      for (let d = ((f % 16) + 16) % 16; d < L; d += 16) {
        if (Math.abs(d - L / 2) < livre) continue;
        const t = d / L;
        ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (resultado.curto) {
      texto(ctx, 'Curto-circuito: a bateria só tem a resistência interna para segurar a corrente', w / 2, 20, c.danger, { alinhar: 'center', peso: 700, tamanho: 12 });
    } else if (!pecas.length) {
      texto(ctx, 'Escolha uma peça no painel e toque entre dois pontos para colocá-la', w / 2, h / 2, c.muted, { alinhar: 'center', tamanho: 13 });
    }
  };

  const sel = pecas.find((p) => p.id === selecionada) ?? null;
  const bateria = pecas.find((p) => p.tipo === 'bateria');
  const lamps = pecas.filter((p) => p.tipo === 'lampada');
  const acesas = lamps.filter((l) => brilho(l, resultado) > 0.05).length;
  const req = bateria ? resistenciaEquivalente(bateria, resultado) : Infinity;
  const ajustar = (patch: Partial<Peca>) => sel && mudar((ps) => ps.map((p) => (p.id === sel.id ? { ...p, ...patch } : p)));

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco2D
            quadro={quadro}
            proporcao={16 / 10}
            rotulo={`Bancada de circuitos com ${pecas.length} peças: ${lamps.length} lâmpadas, ${acesas} acesas${resultado.curto ? ', em curto-circuito' : ''}`}
            onPonteiro={onPonteiro}
            alturaMin={280}
          />
        }
        leituras={
          <Leituras
            itens={
              bateria
                ? [
                    { rotulo: 'Tensão nos terminais', valor: `${fmt(resultado.tensoes[bateria.id], 2)} V`, nota: `fem ${fmt(bateria.valor ?? 6, 1)} V menos r·i` },
                    { rotulo: 'Corrente da bateria', valor: fmtA(resultado.correntes[bateria.id]), cor: 'var(--hum)' },
                    { rotulo: 'Potência entregue', valor: `${fmt(resultado.potencias[bateria.id], 2)} W` },
                    { rotulo: 'Resistência equivalente', valor: Number.isFinite(req) && req > 0.01 ? `${fmt(req, 2)} Ω` : resultado.curto ? 'curto' : 'aberto' },
                    { rotulo: 'Lâmpadas acesas', valor: `${acesas} de ${lamps.length}` },
                  ]
                : [{ rotulo: 'Bateria', valor: 'coloque uma', nota: 'sem fonte, nada conduz' }]
            }
          />
        }
        controles={
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Peça</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ferramenta">
                {FERRAMENTAS.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    role="radio"
                    aria-checked={ferramenta === f.valor}
                    data-active={ferramenta === f.valor}
                    className="chip"
                    onClick={() => setFerramenta(f.valor)}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                {ferramenta === 'selecionar'
                  ? 'Toque numa peça para ajustá-la. Na chave, o toque abre e fecha.'
                  : ferramenta === 'apagar'
                    ? 'Toque numa peça para tirá-la.'
                    : ferramenta === 'fio'
                      ? 'Toque entre dois pontos, ou arraste para desenhar o caminho.'
                      : 'Toque entre dois pontos vizinhos para colocar.'}
              </p>
            </div>

            {sel && (
              <section className="space-y-3 rounded-xl border border-line bg-surface-2 p-3" aria-label="Peça selecionada">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold">{NOME[sel.tipo]}</p>
                  <button type="button" className="text-xs font-semibold text-danger hover:underline" onClick={() => { mudar((ps) => ps.filter((p) => p.id !== sel.id)); setSelecionada(null); }}>
                    Remover
                  </button>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Corrente</dt>
                    <dd className="font-data font-semibold">{sel.tipo === 'voltimetro' ? '0' : fmtA(resultado.correntes[sel.id])}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Tensão</dt>
                    <dd className="font-data font-semibold">{fmt(Math.abs(resultado.tensoes[sel.id]), 2)} V</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Potência</dt>
                    <dd className="font-data font-semibold">{fmt(Math.abs(resultado.potencias[sel.id]), 2)} W</dd>
                  </div>
                </dl>
                {sel.tipo === 'bateria' && (
                  <>
                    <Deslizador rotulo="Força eletromotriz" valor={sel.valor ?? 6} min={1.5} max={24} passo={0.5} unidade="V" onChange={(v) => ajustar({ valor: v })} />
                    <button type="button" className="btn btn-ghost w-full" onClick={() => ajustar({ a: sel.b, b: sel.a })}>
                      Inverter os polos
                    </button>
                  </>
                )}
                {sel.tipo === 'lampada' && (
                  <>
                    <Deslizador
                      rotulo="Potência nominal"
                      valor={sel.valor ?? 6}
                      min={1}
                      max={24}
                      unidade="W"
                      onChange={(v) => ajustar({ valor: v })}
                      dica={`Para ${U_LAMPADA} V: R = U²/P = ${fmt((U_LAMPADA * U_LAMPADA) / (sel.valor ?? 6), 1)} Ω`}
                    />
                    {sel.queimada && (
                      <button type="button" className="btn btn-ghost w-full" onClick={() => ajustar({ queimada: false })}>
                        Trocar a lâmpada
                      </button>
                    )}
                  </>
                )}
                {sel.tipo === 'resistor' && (
                  <Deslizador rotulo="Resistência" valor={sel.valor ?? 10} min={1} max={100} unidade="Ω" onChange={(v) => ajustar({ valor: v })} />
                )}
                {sel.tipo === 'chave' && (
                  <button type="button" className="btn btn-ghost w-full" onClick={() => ajustar({ fechada: !sel.fechada })}>
                    {sel.fechada ? 'Abrir a chave' : 'Fechar a chave'}
                  </button>
                )}
              </section>
            )}

            {aviso && (
              <p role="status" className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-danger">
                {aviso}
              </p>
            )}
            {resultado.curto && (
              <p role="alert" className="text-xs text-danger">
                A corrente passou de {CORRENTE_CURTO} A. Na vida real, o fio esquenta e a bateria descarrega em minutos: tire o fio que liga os polos direto.
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Começar de</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['serie', 'Série'],
                    ['paralelo', 'Paralelo'],
                    ['misto', 'Misto'],
                    ['vazia', 'Bancada vazia'],
                  ] as [Montagem, string][]
                ).map(([m, nome]) => (
                  <button
                    key={m}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      mudar(() => montagem(m));
                      setSelecionada(null);
                      setFerramenta(m === 'vazia' ? 'fio' : 'selecionar');
                    }}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </div>
          </>
        }
      />
      <Explicacao
        enem={'As questões pedem **resistência equivalente** (série soma, paralelo soma os inversos), **potência** ($P = U \\cdot i = R i^2 = U^2/R$) e o que acontece com o brilho quando uma lâmpada queima ou uma chave abre. Em casa as tomadas estão em **paralelo**: cada aparelho recebe a mesma tensão e um não desliga o outro. Amperímetro entra em **série** (resistência quase nula); voltímetro, em **paralelo** (resistência quase infinita).'}
      >
        {`Monte o circuito peça por peça. Cada peça liga dois pontos vizinhos da bancada, e a simulação resolve as **leis de Kirchhoff** a cada mudança: a soma das correntes que chegam a um ponto é igual à soma das que saem, e a soma das tensões numa volta fechada é zero.

**O que testar:**
- Duas lâmpadas em **série** brilham menos que uma sozinha: a mesma corrente passa pelas duas e a tensão da bateria se divide. Queime uma (ou abra a chave) e a outra apaga.
- Em **paralelo**, cada lâmpada recebe a tensão inteira e brilha quase como sozinha. Tirar uma não apaga a outra, mas a bateria passa a entregar menos corrente.
- Ligue um fio direto entre os polos: é um **curto-circuito**. A corrente fica limitada só pela resistência interna da bateria (0,5 Ω aqui), e as lâmpadas do circuito apagam, porque a corrente escolhe o caminho sem resistência.
- Suba a força eletromotriz até uma lâmpada passar de 2,25× a potência nominal: o filamento **queima** e o ramo abre.

A bateria tem resistência interna $r$, então a tensão nos terminais é $U = \\varepsilon - r\\,i$: quanto mais corrente ela entrega, menos tensão sobra. As lâmpadas são de ${U_LAMPADA} V, com $R = U^2/P$ (filamento quente). As bolinhas laranja andam no sentido convencional da corrente, do polo positivo para o negativo por fora da bateria, mais rápidas onde a corrente é maior.`}
      </Explicacao>
    </div>
  );
}
