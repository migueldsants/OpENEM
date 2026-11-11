import { useRef, useState } from 'react';
import { derivadaPopulacao, equilibrioPopulacao, LEBRE_LINCE } from '../../../lib/simulacoes/vida-terra';
import { avancar, criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const JANELA = 60; // anos no gráfico
const LEBRES_POR_ICONE = 2; // mil
const LINCES_POR_ICONE = 0.5; // mil

interface Bicho { x: number; y: number; vx: number; vy: number }

export default function PredadorPresa() {
  const [alfaP, setAlfaP] = useState(LEBRE_LINCE.alfa);
  const [beta, setBeta] = useState(LEBRE_LINCE.beta);
  const [gama, setGama] = useState(LEBRE_LINCE.gama);
  const [delta, setDelta] = useState(LEBRE_LINCE.delta);
  const [limite, setLimite] = useState(false);
  const [K, setK] = useState(120);
  const [anosPorS, setAnosPorS] = useState(2);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const p = { alfa: alfaP, beta, gama, delta, K: limite ? K : Infinity };
  const sim = useRef({ t: 0, s: [30, 4] as number[], hist: [[0, 30, 4]] as [number, number, number][], acc: 0 });
  const bichos = useRef({ lebres: [] as Bicho[], linces: [] as Bicho[], rng: criarRng(5) });
  const [vista, setVista] = useState({ t: 0, s: [30, 4], hist: [[0, 30, 4]] as [number, number, number][] });

  const reiniciar = () => {
    sim.current = { t: 0, s: [30, 4], hist: [[0, 30, 4]], acc: 0 };
    setVista({ t: 0, s: [30, 4], hist: [[0, 30, 4]] });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    if (rodando) {
      const r = avancar(derivadaPopulacao(p), st.t, st.s, dt * anosPorS, 0.01);
      st.t = r.t;
      st.s = r.y.map((x) => Math.max(x, 1e-6));
      st.hist.push([st.t, st.s[0], st.s[1]]);
      while (st.hist.length > 2 && st.hist[0][0] < st.t - JANELA) st.hist.shift();
      st.acc += dt;
      if (st.acc > 0.15) {
        st.acc = 0;
        setVista({ t: st.t, s: [...st.s], hist: st.hist.slice() });
      }
    }
    // Campo: um ícone para cada 2 mil lebres e cada 500 linces.
    const b = bichos.current;
    const ajustar = (lista: Bicho[], alvo: number) => {
      while (lista.length < alvo) lista.push({ x: b.rng(), y: b.rng(), vx: b.rng() - 0.5, vy: b.rng() - 0.5 });
      if (lista.length > alvo) lista.splice(0, lista.length - alvo);
    };
    ajustar(b.lebres, Math.min(150, Math.round(st.s[0] / LEBRES_POR_ICONE)));
    ajustar(b.linces, Math.min(80, Math.round(st.s[1] / LINCES_POR_ICONE)));
    ctx.fillStyle = alfa(c.nat, 0.1);
    ctx.fillRect(0, 0, w, h);
    const mover = (lista: Bicho[], vel: number) => {
      for (const a of lista) {
        a.x += a.vx * vel * dt;
        a.y += a.vy * vel * dt;
        if (a.x < 0.02 || a.x > 0.98) a.vx = -a.vx;
        if (a.y < 0.04 || a.y > 0.96) a.vy = -a.vy;
        a.x = Math.min(0.98, Math.max(0.02, a.x));
        a.y = Math.min(0.96, Math.max(0.04, a.y));
      }
    };
    mover(b.lebres, 0.08);
    mover(b.linces, 0.12);
    for (const a of b.lebres) {
      const x = a.x * w;
      const y = a.y * h;
      ctx.fillStyle = c.mat;
      ctx.beginPath(); ctx.ellipse(x, y, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 1, y - 6, 1.4, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();
    }
    for (const a of b.linces) {
      const x = a.x * w;
      const y = a.y * h;
      ctx.fillStyle = c.hum;
      ctx.beginPath(); ctx.ellipse(x, y, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x + 6, y - 10); ctx.lineTo(x + 8, y - 4); ctx.fill();
    }
    texto(ctx, `ano ${fmt(st.t, 1)}`, w - 10, 18, c.fg, { alinhar: 'right', mono: true, peso: 600 });
    texto(ctx, `● lebres: ${fmt(st.s[0], 1)} mil`, 10, 18, c.mat, { peso: 600, tamanho: 12 });
    texto(ctx, `● linces: ${fmt(st.s[1], 1)} mil`, 10, 36, c.hum, { peso: 600, tamanho: 12 });
  };

  const eq = equilibrioPopulacao(p);
  const [x, y] = vista.s;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Lebres e linces convivendo num campo" proporcao={16 / 8} alturaMin={200} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Lebres (presas)', valor: `${fmt(x, 1)} mil`, cor: 'var(--mat)' },
              { rotulo: 'Linces (predadores)', valor: `${fmt(y, 1)} mil`, cor: 'var(--hum)' },
              { rotulo: 'Equilíbrio das lebres', valor: `${fmt(eq.presas, 1)} mil`, nota: 'γ/δ' },
              { rotulo: 'Equilíbrio dos linces', valor: eq.predadores > 0 ? `${fmt(eq.predadores, 1)} mil` : 'extinção', nota: 'α/β' },
            ]}
          />
        }
        extra={
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco titulo="Populações ao longo do tempo">
              <Grafico
                series={[
                  { rotulo: 'lebres', cor: 'var(--mat)', pontos: vista.hist.map((q) => [q[0], q[1]]) },
                  { rotulo: 'linces', cor: 'var(--hum)', pontos: vista.hist.map((q) => [q[0], q[2]]) },
                ]}
                rotuloX="anos"
                rotuloY="milhares"
                xMin={Math.max(0, vista.t - JANELA)}
                xMax={Math.max(JANELA, vista.t)}
                yMin={0}
                altura={200}
              />
            </Bloco>
            <Bloco titulo="Retrato de fase">
              <Grafico
                series={[{ rotulo: 'trajetória', cor: 'var(--brand)', pontos: vista.hist.map((q) => [q[1], q[2]]) }]}
                rotuloX="lebres (mil)"
                rotuloY="linces (mil)"
                xMin={0}
                yMin={0}
                pontos={[{ x, y, cor: 'var(--fg)' }, { x: eq.presas, y: eq.predadores, cor: 'var(--nat)' }]}
                altura={200}
              />
            </Bloco>
          </div>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Deslizador rotulo="Natalidade das lebres (α)" valor={alfaP} min={0.1} max={1.5} passo={0.01} unidade="/ano" onChange={setAlfaP} />
            <Deslizador rotulo="Eficiência da caça (β)" valor={beta} min={0.005} max={0.08} passo={0.001} onChange={setBeta} />
            <Deslizador rotulo="Mortalidade dos linces (γ)" valor={gama} min={0.1} max={1.5} passo={0.01} unidade="/ano" onChange={setGama} />
            <Deslizador rotulo="Conversão em filhotes (δ)" valor={delta} min={0.005} max={0.08} passo={0.001} onChange={setDelta} />
            <Alternar rotulo="Recursos limitados para as lebres" marcado={limite} onChange={setLimite} dica="Capacidade de suporte: o pasto só sustenta K lebres." />
            {limite && <Deslizador rotulo="Capacidade de suporte (K)" valor={K} min={40} max={300} unidade="mil" onChange={setK} />}
            <Deslizador rotulo="Passagem do tempo" valor={anosPorS} min={0.5} max={6} passo={0.5} unidade="anos por segundo" onChange={setAnosPorS} />
          </>
        }
      />
      <Explicacao enem={'O pico dos predadores vem **depois** do pico das presas: com muita comida, os linces se reproduzem; com muitos linces, as lebres diminuem; sem comida, os linces morrem, e o ciclo recomeça. Questões de ecologia cobram essa defasagem e o efeito de remover um elo da cadeia (por exemplo, a caça aos predadores faz as presas explodirem até o limite do ambiente).'}>
        {`O modelo de **Lotka-Volterra** descreve a interação com quatro taxas:
$$\\frac{dL}{dt} = \\alpha L - \\beta L P, \\qquad \\frac{dP}{dt} = \\delta L P - \\gamma P,$$
em que $L$ são as lebres e $P$ os linces. Os valores iniciais foram ajustados aos registros de peles compradas pela Hudson's Bay Company no Canadá, que mostram ciclos de cerca de 10 anos.

No modelo clássico as populações oscilam para sempre, e o retrato de fase é uma curva fechada em volta do ponto de equilíbrio. Ligue os **recursos limitados**: as lebres passam a crescer de forma logística (no máximo $K$), as oscilações amortecem e as duas espécies se estabilizam. Aumente a mortalidade dos linces até que $\\gamma/\\delta$ passe de $K$: o predador se extingue.`}
      </Explicacao>
    </div>
  );
}
