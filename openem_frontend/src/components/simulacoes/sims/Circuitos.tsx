import { useMemo, useRef, useState } from 'react';
import { montarCircuito, resolverCircuito, type Montagem } from '../../../lib/simulacoes/eletromagnetismo';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto } from '../canvas';
import { Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Ponteiro, type Quadro } from '../ui';

type P2 = [number, number];
interface Desenho {
  lampadas: P2[];
  /** Um laço por corrente de ramo: [id da corrente que o percorre, pontos]. */
  lacos: [string, P2[]][];
  fios: P2[][];
}

const ESQ = 0.1, TOPO = 0.16, BASE = 0.86;
const laco = (x: number): P2[] => [[ESQ, 0.5], [ESQ, TOPO], [x, TOPO], [x, BASE], [ESQ, BASE], [ESQ, 0.5]];

const DESENHOS: Record<Montagem, Desenho> = {
  serie: {
    lampadas: [[0.5, TOPO], [0.9, 0.5], [0.5, BASE]],
    lacos: [['R1', laco(0.9)]],
    fios: [laco(0.9)],
  },
  paralelo: {
    lampadas: [[0.42, 0.5], [0.64, 0.5], [0.86, 0.5]],
    lacos: [['R1', laco(0.42)], ['R2', laco(0.64)], ['R3', laco(0.86)]],
    fios: [laco(0.86), [[0.42, TOPO], [0.42, BASE]], [[0.64, TOPO], [0.64, BASE]]],
  },
  misto: {
    lampadas: [[0.36, TOPO], [0.64, 0.5], [0.88, 0.5]],
    lacos: [['R2', laco(0.64)], ['R3', laco(0.88)]],
    fios: [laco(0.88), [[0.64, TOPO], [0.64, BASE]]],
  },
};

const P_NOMINAL = 60; // W: brilho máximo de referência

function comprimento(pts: P2[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

function pontoEm(pts: P2[], d: number): P2 {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg) {
      const f = d / seg;
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

export default function Circuitos() {
  const [montagem, setMontagem] = useState<Montagem>('serie');
  const [V, setV] = useState(127);
  const [R, setR] = useState<[number, number, number]>([269, 269, 269]);
  const [abertos, setAbertos] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const fase = useRef<Record<string, number>>({});

  const res = useMemo(() => resolverCircuito(montarCircuito(montagem, V, R, abertos)), [montagem, V, R, abertos]);
  const desenho = DESENHOS[montagem];

  const alternarLampada = (i: number) => setAbertos((a) => a.map((x, j) => (j === i ? !x : x)) as [boolean, boolean, boolean]);

  const geo = (w: number, h: number) => {
    const m = 24;
    return { X: (x: number) => m + x * (w - 2 * m), Y: (y: number) => m + y * (h - 2 * m) };
  };

  const onPonteiro = (p: Ponteiro) => {
    if (p.tipo !== 'down') return;
    const { X, Y } = geo(p.w, p.h);
    desenho.lampadas.forEach(([lx, ly], i) => {
      if (Math.hypot(X(lx) - p.x, Y(ly) - p.y) < 26) alternarLampada(i);
    });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const { X, Y } = geo(w, h);
    // Fios.
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const f of desenho.fios) {
      ctx.beginPath();
      f.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    }
    // Pilha/fonte no fio da esquerda (+ em cima).
    const bx = X(ESQ);
    const by = Y(0.5);
    ctx.fillStyle = c.surface2;
    ctx.fillRect(bx - 22, by - 16, 44, 32);
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 20, by - 7); ctx.lineTo(bx + 20, by - 7); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(bx - 10, by + 7); ctx.lineTo(bx + 10, by + 7); ctx.stroke();
    texto(ctx, '+', bx + 26, by - 4, c.danger, { peso: 700, tamanho: 14 });
    texto(ctx, '−', bx + 26, by + 14, c.mat, { peso: 700, tamanho: 14 });
    texto(ctx, `${fmt(V, 1)} V`, bx - 28, by + 4, c.fg, { alinhar: 'right', mono: true });

    // Cargas em movimento (sentido convencional: do + para o −).
    const escPx = Math.min(w, h);
    for (const [id, pts] of desenho.lacos) {
      const I = Math.abs(res.correntes[id] ?? 0);
      const L = comprimento(pts);
      // Fase em frações do espaçamento: 1 A anda 10 espaçamentos por segundo.
      fase.current[id] = ((fase.current[id] ?? 0) + I * 10 * dt) % 1;
      if (I < 1e-6) continue;
      const passo = 22 / escPx;
      ctx.fillStyle = c.hum;
      for (let d = fase.current[id] * passo; d < L; d += passo) {
        const [x, y] = pontoEm(pts, d);
        ctx.beginPath(); ctx.arc(X(x), Y(y), 2.6, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Lâmpadas: brilho pela potência dissipada.
    desenho.lampadas.forEach(([lx, ly], i) => {
      const id = `R${i + 1}`;
      const P = res.potencias[id] ?? 0;
      const b = abertos[i] ? 0 : Math.min(1, Math.sqrt(P / P_NOMINAL));
      const x = X(lx);
      const y = Y(ly);
      if (b > 0.02) {
        const g = ctx.createRadialGradient(x, y, 4, x, y, 18 + 46 * b);
        g.addColorStop(0, `rgba(255, 214, 102, ${0.85 * b})`);
        g.addColorStop(1, 'rgba(255, 214, 102, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 18 + 46 * b, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = b > 0.02 ? `rgb(255, ${Math.round(190 + 50 * b)}, ${Math.round(80 + 120 * b)})` : c.surface;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Filamento.
      ctx.strokeStyle = abertos[i] ? c.danger : alfa('#7c2d12', 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x - 4, y - 5); ctx.lineTo(x, y + 3); ctx.lineTo(x + 4, y - 5); ctx.lineTo(x + 8, y + 6); ctx.stroke();
      if (abertos[i]) {
        ctx.strokeStyle = c.danger;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x - 10, y - 10); ctx.lineTo(x + 10, y + 10); ctx.moveTo(x + 10, y - 10); ctx.lineTo(x - 10, y + 10); ctx.stroke();
      }
      if (ly === TOPO || ly === BASE) {
        // Lâmpada num fio horizontal: rótulo acima (topo) ou abaixo (base), longe do fio.
        const dy = ly === TOPO ? -1 : 1;
        texto(ctx, `L${i + 1} · ${fmt(P, 1)} W`, x, y + dy * 30 + (dy > 0 ? 4 : 0), c.fg, { alinhar: 'center', peso: 700, tamanho: 12 });
      } else {
        const lado = lx > 0.8 && montagem === 'serie' ? -1 : 1;
        texto(ctx, `L${i + 1}`, x + lado * 24, y - 6, c.fg, { alinhar: lado > 0 ? 'left' : 'right', peso: 700 });
        texto(ctx, `${fmt(P, 1)} W`, x + lado * 24, y + 10, c.muted, { alinhar: lado > 0 ? 'left' : 'right', mono: true, tamanho: 11 });
      }
    });
    texto(ctx, 'Toque numa lâmpada para queimá-la ou trocá-la', w - 12, h - 8, c.muted, { alinhar: 'right', tamanho: 11 });
  };

  const fmtI = (i: number) => (Math.abs(i) < 1 ? `${fmt(Math.abs(i) * 1000, 0)} mA` : `${fmt(Math.abs(i), 2)} A`);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Circuito em ${montagem} com três lâmpadas`} proporcao={16 / 10} onPonteiro={onPonteiro} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Resistência equivalente', valor: Number.isFinite(res.resistenciaEquivalente) ? `${fmt(res.resistenciaEquivalente, 1)} Ω` : 'circuito aberto' },
              { rotulo: 'Corrente na fonte', valor: fmtI(res.correnteFonte) },
              { rotulo: 'Potência total', valor: `${fmt(res.potenciaFonte, 1)} W` },
              ...[0, 1, 2].map((i) => ({
                rotulo: `Lâmpada ${i + 1}`,
                valor: `${fmt(res.potencias[`R${i + 1}`], 1)} W`,
                nota: `${fmtI(res.correntes[`R${i + 1}`])} · ${fmt(Math.abs(res.tensoes[`R${i + 1}`]), 1)} V`,
              })),
            ]}
          />
        }
        controles={
          <>
            <Segmentos
              rotulo="Ligação"
              valor={montagem}
              opcoes={[
                { valor: 'serie', rotulo: 'Série' },
                { valor: 'paralelo', rotulo: 'Paralelo' },
                { valor: 'misto', rotulo: 'Mista' },
              ]}
              onChange={setMontagem}
            />
            <Deslizador rotulo="Tensão da fonte" valor={V} min={1.5} max={220} passo={0.5} unidade="V" onChange={setV} />
            {[0, 1, 2].map((i) => (
              <Deslizador
                key={i}
                rotulo={`Resistência de L${i + 1}`}
                valor={R[i]}
                min={10}
                max={600}
                unidade="Ω"
                onChange={(v) => setR((r) => r.map((x, j) => (j === i ? v : x)) as [number, number, number])}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => (
                <button key={i} type="button" className="chip" data-active={abertos[i]} aria-pressed={abertos[i]} onClick={() => alternarLampada(i)}>
                  {abertos[i] ? `Trocar L${i + 1}` : `Queimar L${i + 1}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">269 Ω é uma lâmpada incandescente de 60 W para 127 V. O brilho segue a potência dissipada.</p>
          </>
        }
      />
      <Explicacao enem={'Nas casas as tomadas e lâmpadas são ligadas **em paralelo**: cada aparelho recebe a tensão toda da rede e um que queima não apaga os outros. Em **série** (como os antigos pisca-piscas), uma lâmpada queimada abre o circuito e apaga todas.'}>
        {`A simulação resolve o circuito pelas **leis de Kirchhoff** (análise nodal): em cada nó, a corrente que entra é igual à que sai, e em cada laço as tensões somam a da fonte. Cada lâmpada obedece à lei de Ohm, $U = R\\,i$, e brilha conforme a potência $P = U\\,i = R\\,i^2 = U^2/R$.

- **Série:** a mesma corrente em todas, $R_{eq} = R_1 + R_2 + R_3$, e a tensão se divide. Com lâmpadas iguais, cada uma fica com 1/9 da potência que teria sozinha.
- **Paralelo:** todas com a mesma tensão, $\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}$, e as correntes se somam.
- **Mista:** queime L3 e veja: L2 passa a receber mais tensão e brilha mais, enquanto L1 enfraquece.

Os pontos amarelos andam no sentido convencional da corrente (do polo positivo para o negativo), com velocidade proporcional a ela.`}
      </Explicacao>
    </div>
  );
}
