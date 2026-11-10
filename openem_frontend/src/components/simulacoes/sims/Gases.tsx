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
import { Alternar, BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

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
  const [vista, setVista] = useState<Vista>({ T: 300, P: 0, Pideal: 0, n: 160, largura: 60, hist: [] });

  const reiniciar = () => {
    gas.current = criarGas(N, Talvo, largAlvo, ALTURA, Math.floor(Math.random() * 1e9));
    medida.current = { P: 0, acc: 0 };
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
    const esc = Math.min((w - 40) / LARG_MAX, (h - 40) / ALTURA);
    const ox = 16;
    const oy = (h - ALTURA * esc) / 2;
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 3;
    ctx.strokeRect(ox, oy, g.largura * esc, ALTURA * esc);
    // Pistão.
    const px = ox + g.largura * esc;
    ctx.fillStyle = c.muted;
    ctx.fillRect(px, oy - 4, 10, ALTURA * esc + 8);
    ctx.fillRect(px + 10, oy + (ALTURA * esc) / 2 - 4, w - px - 10, 8);
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
        palco={<Palco2D quadro={quadro} rotulo="Moléculas de gás colidindo dentro de um recipiente com pistão" proporcao={16 / 9} />}
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
