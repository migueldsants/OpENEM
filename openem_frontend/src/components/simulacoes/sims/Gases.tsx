import { useRef, useState } from 'react';
import {
  adicionarMoleculas,
  criarGas,
  histogramaVelocidades,
  maxwell2D,
  passoGas,
  pressaoIdeal,
  pressaoMedida,
  removerMoleculas,
  temperatura,
  termostato,
  zerarMedicao,
  type Gas,
} from '../../../lib/simulacoes/gases';
import { clamp, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Ponteiro, type Quadro } from '../ui';

const ALTURA = 40; // nm
const LARG_MAX = 90; // nm
const DT = 0.1; // ps por passo
const PASSOS = 20; // passos por quadro (2 ps de gás por quadro)
const JANELA_P = 400; // ps de média para a pressão
const V_MAX = 1600; // m/s no histograma
const FAIXAS = 32;

interface Vista {
  T: number;
  P: number;
  Pideal: number;
  n: number;
  largura: number;
  hist: number[];
}

export default function Gases() {
  const [N, setN] = useState(160);
  const [Talvo, setTalvo] = useState(300);
  const [largAlvo, setLargAlvo] = useState(60);
  const [isolado, setIsolado] = useState(false);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const gas = useRef<Gas | null>(null);
  const medida = useRef({ P: 0, acc: 0 });
  const arrasto = useRef(false);
  /** Pressão de referência do manômetro: a primeira medida, que fica no meio do mostrador. */
  const pRef = useRef(0);
  const [vista, setVista] = useState<Vista>({ T: 300, P: 0, Pideal: 0, n: 160, largura: 60, hist: [] });

  const reiniciar = () => {
    gas.current = criarGas(N, Talvo, largAlvo, ALTURA, Math.floor(Math.random() * 1e9));
    medida.current = { P: 0, acc: 0 };
    pRef.current = 0;
  };

  const geo = (w: number, h: number) => {
    const esc = Math.min((w - 40) / LARG_MAX, (h - 40) / ALTURA);
    return { esc, ox: 16, oy: (h - ALTURA * esc) / 2 };
  };

  // O pistão também se arrasta no palco: apertar o gás é empurrar a parede.
  const onPonteiro = (e: Ponteiro) => {
    if (e.tipo === 'up') {
      arrasto.current = false;
      return;
    }
    const g = gas.current;
    if (!g) return;
    const { esc, ox, oy } = geo(e.w, e.h);
    if (e.tipo === 'down') {
      const px = ox + g.largura * esc;
      arrasto.current = e.x > px - 22 && e.y > oy - 10 && e.y < oy + ALTURA * esc + 10;
    }
    if (arrasto.current) setLargAlvo(clamp(Math.round((e.x - 5 - ox) / esc), 20, LARG_MAX));
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    if (!gas.current) gas.current = criarGas(N, Talvo, largAlvo, ALTURA, 17);
    const g = gas.current;
    if (rodando) {
      if (g.n < N) adicionarMoleculas(g, Math.min(5, N - g.n), isolado ? Math.max(temperatura(g), 50) : Talvo);
      else if (g.n > N) removerMoleculas(g, Math.min(5, g.n - N));
      for (let i = 0; i < PASSOS; i++) {
        const vp = clamp((largAlvo - g.largura) / 2, -0.1, 0.1);
        passoGas(g, DT, Math.abs(largAlvo - g.largura) < 0.01 ? 0 : vp);
        if (!isolado) termostato(g, Talvo, DT, 20);
      }
      if (g.tempoMedido >= JANELA_P) {
        medida.current.P = pressaoMedida(g);
        zerarMedicao(g);
      }
      medida.current.acc += dt;
      if (medida.current.acc > 0.25) {
        medida.current.acc = 0;
        setVista({ T: temperatura(g), P: medida.current.P, Pideal: pressaoIdeal(g), n: g.n, largura: g.largura, hist: histogramaVelocidades(g, V_MAX, FAIXAS) });
      }
    }
    // Caixa em escala.
    const { esc, ox, oy } = geo(w, h);
    const altPx = ALTURA * esc;
    const px = ox + g.largura * esc;
    ctx.fillStyle = alfa(c.surface, 0.5);
    ctx.fillRect(ox, oy, g.largura * esc, altPx);
    // O curso do pistão, pontilhado, mostra até onde ele vai.
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = alfa(c.muted, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, LARG_MAX * esc, altPx);
    ctx.setLineDash([]);
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(ox, oy); ctx.lineTo(ox, oy + altPx); ctx.lineTo(px, oy + altPx); ctx.stroke();
    // Pistão, haste e a pega de arrastar.
    ctx.fillStyle = arrasto.current ? c.fg : c.muted;
    ctx.beginPath(); ctx.roundRect(px, oy - 5, 12, altPx + 10, 3); ctx.fill();
    ctx.fillStyle = c.muted;
    ctx.fillRect(px + 12, oy + altPx / 2 - 4, Math.max(0, w - px - 34), 8);
    ctx.fillStyle = c.brand;
    ctx.beginPath(); ctx.arc(Math.min(w - 20, px + 40), oy + altPx / 2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.surface;
    ctx.lineWidth = 2;
    const gx = Math.min(w - 20, px + 40);
    ctx.beginPath();
    ctx.moveTo(gx - 5, oy + altPx / 2); ctx.lineTo(gx + 5, oy + altPx / 2);
    ctx.moveTo(gx - 5, oy + altPx / 2); ctx.lineTo(gx - 2, oy + altPx / 2 - 3); ctx.moveTo(gx - 5, oy + altPx / 2); ctx.lineTo(gx - 2, oy + altPx / 2 + 3);
    ctx.moveTo(gx + 5, oy + altPx / 2); ctx.lineTo(gx + 2, oy + altPx / 2 - 3); ctx.moveTo(gx + 5, oy + altPx / 2); ctx.lineTo(gx + 2, oy + altPx / 2 + 3);
    ctx.stroke();
    // Manômetro em cima da caixa: o ponteiro no meio é a pressão do começo.
    const P = medida.current.P;
    if (pRef.current === 0 && P > 0) pRef.current = P;
    if (oy > 86) {
      const mx = ox + 46;
      const my = oy - 44;
      const R = 32;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my + R); ctx.lineTo(mx, oy); ctx.stroke();
      ctx.fillStyle = c.surface;
      ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      const a0 = Math.PI * 0.8;
      const a1 = Math.PI * 2.2;
      for (let i = 0; i <= 8; i++) {
        const a = a0 + ((a1 - a0) * i) / 8;
        ctx.strokeStyle = i >= 6 ? c.danger : c.muted;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * (R - 8), my + Math.sin(a) * (R - 8)); ctx.lineTo(mx + Math.cos(a) * (R - 3), my + Math.sin(a) * (R - 3)); ctx.stroke();
      }
      const fr = pRef.current > 0 ? P / (P + pRef.current) : 0;
      const an = a0 + (a1 - a0) * fr;
      ctx.strokeStyle = c.brand;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(an) * (R - 11), my + Math.sin(an) * (R - 11)); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = c.fg;
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
      texto(ctx, 'pressão', mx + R + 10, my - 2, c.muted, { tamanho: 11, peso: 700 });
      texto(ctx, pRef.current > 0 ? `${fmt(P / pRef.current, 2)} × a inicial` : 'medindo…', mx + R + 10, my + 14, c.fg, { tamanho: 12, peso: 600, mono: true });
      texto(ctx, `${fmt(temperatura(g), 0)} K`, w - 16, my + 14, c.fg, { alinhar: 'right', tamanho: 12, peso: 600, mono: true });
      texto(ctx, 'temperatura', w - 16, my - 2, c.muted, { alinhar: 'right', tamanho: 11, peso: 700 });
    }
    // Moléculas coloridas pela velocidade (azul lenta → vermelha rápida).
    const vmp = Math.sqrt(1.380649e-23 * Math.max(temperatura(g), 1) / g.massa) / 1000;
    // Em escala o disco teria ~1 px: desenhado um pouco maior para se ver.
    const r = Math.max(2.4, g.raio * esc);
    for (let i = 0; i < g.n; i++) {
      const v = Math.hypot(g.vx[i], g.vy[i]) / (2 * vmp);
      const t = Math.min(1, v);
      ctx.fillStyle = `hsl(${220 - 220 * t}, 85%, ${c.escuro ? 62 : 48}%)`;
      ctx.beginPath(); ctx.arc(ox + g.x[i] * esc, oy + g.y[i] * esc, r, 0, Math.PI * 2); ctx.fill();
    }
    texto(ctx, '10 nm', ox, oy + ALTURA * esc + 18, c.muted, { tamanho: 10 });
    ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox + 34, oy + ALTURA * esc + 14); ctx.lineTo(ox + 34 + 10 * esc, oy + ALTURA * esc + 14); ctx.stroke();
    if (isolado) texto(ctx, 'Isolado: sem troca de calor', ox + 8, oy + 18, alfa(c.fg, 0.8), { tamanho: 11, peso: 600 });
  };

  // Curva de Maxwell na temperatura medida, na escala do histograma.
  const largFaixa = V_MAX / FAIXAS;
  const curva: [number, number][] = [];
  for (let v = 0; v <= V_MAX; v += 20) curva.push([v, maxwell2D(v, Math.max(vista.T, 1)) * vista.n * largFaixa]);
  const barras: [number, number][] = vista.hist.flatMap((k, i) => [[i * largFaixa, k], [(i + 1) * largFaixa, k]] as [number, number][]);
  const razao = vista.P > 0 && vista.Pideal > 0 ? vista.P / vista.Pideal : NaN;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Moléculas de gás colidindo dentro de um recipiente com pistão; arraste o pistão para mudar o volume" proporcao={16 / 9} onPonteiro={onPonteiro} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Temperatura medida', valor: `${fmt(vista.T, 0)} K`, nota: `${fmt(vista.T - 273.15, 0)} °C` },
              { rotulo: 'Pressão medida', valor: vista.P ? `${fmt(vista.P * 1000, 3)} mN/m` : 'medindo…', nota: 'impulso nas paredes' },
              { rotulo: 'Pressão prevista (NkT/A)', valor: `${fmt(vista.Pideal * 1000, 3)} mN/m` },
              { rotulo: 'P·A ÷ N·k·T', valor: Number.isFinite(razao) ? fmt(razao, 2) : '…', nota: 'gás ideal = 1' },
              { rotulo: 'Área (o "volume" em 2D)', valor: `${fmt(vista.largura * ALTURA, 0)} nm²` },
              { rotulo: 'Moléculas', valor: String(vista.n) },
            ]}
          />
        }
        extra={
          <Bloco titulo="Distribuição das velocidades">
            <Grafico
              series={[
                { rotulo: 'simulação', cor: 'var(--mat)', pontos: barras },
                { rotulo: 'Maxwell-Boltzmann', cor: 'var(--brand)', pontos: curva, tracejado: true },
              ]}
              rotuloX="velocidade (m/s)"
              rotuloY="moléculas"
              xMin={0}
              xMax={V_MAX}
              yMin={0}
              altura={190}
            />
          </Bloco>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Deslizador rotulo="Volume (posição do pistão)" valor={largAlvo} min={20} max={LARG_MAX} unidade="nm" onChange={setLargAlvo} />
            <Deslizador rotulo="Quantidade de moléculas" valor={N} min={20} max={400} passo={10} onChange={setN} />
            <Alternar rotulo="Recipiente isolado (adiabático)" marcado={isolado} onChange={setIsolado} dica="Sem troca de calor, empurrar o pistão esquenta o gás e puxar esfria." />
            {!isolado && <Deslizador rotulo="Temperatura (termostato)" valor={Talvo} min={50} max={1000} passo={10} unidade="K" onChange={setTalvo} />}
            <p className="text-xs text-muted">Moléculas de N₂ (0,36 nm de diâmetro) com a massa real. A cor vai do azul (lentas) ao vermelho (rápidas).</p>
          </>
        }
      />
      <Explicacao enem={'Transformações gasosas: **isotérmica** (Boyle, $PV$ constante), **isobárica** (Charles, $V/T$ constante) e **isovolumétrica** (Gay-Lussac, $P/T$ constante). Na **adiabática** não há troca de calor: a compressão rápida esquenta o ar (bomba de bicicleta) e a expansão esfria (desodorante em spray).'}>
        {`Aqui a pressão não sai de uma fórmula: é **medida** pelo impulso que as moléculas dão nas paredes a cada colisão, e a temperatura pela energia cinética média, $\\langle \\tfrac12 mv^2 \\rangle = kT$ (em duas dimensões). Mesmo assim, a equação dos gases aparece sozinha: a razão $PA/NkT$ fica perto de 1.

- Diminua o volume com a temperatura fixa: as moléculas batem mais vezes nas paredes e a pressão sobe na mesma proporção (**Boyle**).
- Aumente a temperatura com o volume fixo: as moléculas ficam mais rápidas e batem com mais força (**Gay-Lussac**).
- Coloque mais moléculas: mais colisões, mais pressão (por isso o pneu enche).

As velocidades não são todas iguais: seguem a **distribuição de Maxwell-Boltzmann**, que se alarga e se desloca para a direita quando a temperatura sobe. Como é um gás em 2D, a "pressão" é força por comprimento de parede (N/m).`}
      </Explicacao>
    </div>
  );
}
