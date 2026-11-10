import { useRef, useState } from 'react';
import {
  derivadaPendulo,
  energiaPendulo,
  GRAVIDADES,
  periodoExato,
  periodoPequenasOscilacoes,
} from '../../../lib/simulacoes/mecanica';
import { avancar, fmt, grausParaRad, radParaGraus } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const JANELA = 10; // s de histórico no gráfico

export default function Pendulo() {
  const [L, setL] = useState(1.5);
  const [m, setM] = useState(1);
  const [theta0, setTheta0] = useState(30);
  const [b, setB] = useState(0);
  const [gKey, setGKey] = useState<string>('terra');
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const g = GRAVIDADES.find((x) => x.key === gKey)!.g;
  const sim = useRef({ t: 0, s: [grausParaRad(30), 0] as number[], hist: [] as [number, number][], acc: 0 });
  // Retrato do estado para a interface, renovado 10 vezes por segundo.
  const [vista, setVista] = useState({ t: 0, s: [grausParaRad(30), 0], hist: [] as [number, number][] });

  const reiniciar = (th = theta0) => {
    sim.current = { t: 0, s: [grausParaRad(th), 0], hist: [], acc: 0 };
    setVista({ t: 0, s: [grausParaRad(th), 0], hist: [] });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    if (rodando) {
      const r = avancar(derivadaPendulo(g, L, b), st.t, st.s, dt, 1 / 1000);
      st.t = r.t;
      st.s = r.y;
      st.hist.push([st.t, radParaGraus(st.s[0])]);
      while (st.hist.length && st.hist[0][0] < st.t - JANELA) st.hist.shift();
      st.acc += dt;
      if (st.acc > 0.1) {
        st.acc = 0;
        setVista({ t: st.t, s: [...st.s], hist: st.hist.slice() });
      }
    }
    const [th, om] = st.s;
    const escala = (h * 0.78) / 3.2; // 3,2 m cabem na altura
    const ox = w / 2;
    const oy = h * 0.08;
    const bx = ox + L * escala * Math.sin(th);
    const by = oy + L * escala * Math.cos(th);
    // Suporte, vertical de referência e arco da amplitude.
    ctx.fillStyle = c.muted;
    ctx.fillRect(ox - 60, oy - 6, 120, 6);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = alfa(c.muted, 0.6);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + L * escala + 20); ctx.stroke();
    ctx.setLineDash([]);
    const a0 = grausParaRad(theta0);
    ctx.strokeStyle = alfa(c.brand, 0.25);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(ox, oy, L * escala, Math.PI / 2 - a0, Math.PI / 2 + a0); ctx.stroke();
    // Fio e massa (raio cresce com a massa, densidade de chumbo).
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();
    const raio = 8 + 6 * Math.cbrt(m);
    const grad = ctx.createRadialGradient(bx - raio / 3, by - raio / 3, 1, bx, by, raio);
    grad.addColorStop(0, alfa(c.fg, 0.95));
    grad.addColorStop(1, c.brand);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(bx, by, raio, 0, Math.PI * 2); ctx.fill();
    texto(ctx, `θ = ${fmt(radParaGraus(th), 1)}°`, ox + 10, oy + 26, c.fg, { mono: true });
    texto(ctx, `t = ${fmt(st.t, 2)} s`, w - 12, 20, c.muted, { alinhar: 'right', mono: true });

    // Barras de energia.
    const e = energiaPendulo(m, g, L, th, om);
    const e0 = energiaPendulo(m, g, L, grausParaRad(theta0), 0).total || 1;
    const bw = 18;
    const bh = h * 0.42;
    const baseY = h - 24;
    const barras: [string, number, string][] = [
      ['Ec', e.cinetica, c.mat],
      ['Ep', e.potencial, c.hum],
      ['Em', e.total, c.nat],
    ];
    barras.forEach(([nome, val, cor], i) => {
      const x = 18 + i * (bw + 12);
      ctx.fillStyle = alfa(cor, 0.15);
      ctx.fillRect(x, baseY - bh, bw, bh);
      ctx.fillStyle = cor;
      const hh = Math.min(1, val / e0) * bh;
      ctx.fillRect(x, baseY - hh, bw, hh);
      texto(ctx, nome, x + bw / 2, baseY + 14, c.muted, { alinhar: 'center', tamanho: 11 });
    });
  };

  const st = vista;
  const e = energiaPendulo(m, g, L, st.s[0], st.s[1]);
  const T0 = periodoPequenasOscilacoes(L, g);
  const Tex = periodoExato(L, g, grausParaRad(theta0));

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Pêndulo oscilando" proporcao={4 / 3} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Período (fórmula 2π√(L/g))', valor: `${fmt(T0, 3)} s` },
              { rotulo: 'Período real nesta amplitude', valor: `${fmt(Tex, 3)} s`, nota: `${fmt((Tex / T0 - 1) * 100, 1)}% maior` },
              { rotulo: 'Frequência', valor: `${fmt(1 / Tex, 3)} Hz` },
              { rotulo: 'Velocidade da massa', valor: `${fmt(Math.abs(st.s[1]) * L, 2)} m/s` },
              { rotulo: 'Energia cinética', valor: `${fmt(e.cinetica, 3)} J`, cor: 'var(--mat)' },
              { rotulo: 'Energia potencial', valor: `${fmt(e.potencial, 3)} J`, cor: 'var(--hum)' },
              { rotulo: 'Energia mecânica', valor: `${fmt(e.total, 3)} J`, cor: 'var(--nat)' },
            ]}
          />
        }
        extra={
          <Bloco titulo="Ângulo ao longo do tempo">
            <Grafico
              series={[{ rotulo: 'θ', cor: 'var(--brand)', pontos: st.hist }]}
              rotuloX="tempo (s)"
              rotuloY="θ (graus)"
              xMin={Math.max(0, st.t - JANELA)}
              xMax={Math.max(JANELA, st.t)}
              yMin={-Math.max(theta0, 5) * 1.1}
              yMax={Math.max(theta0, 5) * 1.1}
              altura={180}
            />
          </Bloco>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => reiniciar()} />
            <Deslizador rotulo="Amplitude (ângulo inicial)" valor={theta0} min={2} max={170} unidade="°" onChange={(v) => { setTheta0(v); reiniciar(v); }} />
            <Deslizador rotulo="Comprimento do fio" valor={L} min={0.2} max={3} passo={0.05} unidade="m" onChange={(v) => { setL(v); reiniciar(); }} />
            <Deslizador rotulo="Massa" valor={m} min={0.1} max={10} passo={0.1} unidade="kg" onChange={setM} dica="Mude a massa e repare: o período não muda." />
            <Deslizador rotulo="Amortecimento" valor={b} min={0} max={1} passo={0.01} unidade="1/s" onChange={setB} />
            <Seletor rotulo="Onde" valor={gKey} opcoes={GRAVIDADES.map((x) => ({ valor: x.key, rotulo: `${x.nome} (g = ${fmt(x.g, 2)} m/s²)` }))} onChange={(v) => { setGKey(v); reiniciar(); }} />
          </>
        }
      />
      <Explicacao enem={'O período **não depende da massa** nem (para ângulos pequenos) da amplitude: só de $L$ e de $g$. Um relógio de pêndulo que atrasa tem o fio comprido demais; levado para a Lua, ele anda $\\sqrt{9{,}81/1{,}62} \\approx 2{,}5$ vezes mais devagar.'}>
        {`A componente do peso ao longo do arco, $mg\\sin\\theta$, puxa a massa de volta. Para ângulos pequenos $\\sin\\theta \\approx \\theta$ e o movimento é harmônico simples, com
$$T = 2\\pi\\sqrt{\\frac{L}{g}}.$$
Aumente a amplitude e compare as duas medidas de período: a 30° a fórmula erra menos de 2%, mas a 90° o período real é 18% maior. A simulação não usa a aproximação: integra $\\ddot\\theta = -\\frac{g}{L}\\sin\\theta$ e o período exato vem da integral elíptica.

Nas barras, a energia **cinética** é máxima no ponto mais baixo e a **potencial**, nos extremos; a soma fica constante. Com amortecimento, a energia mecânica vira calor e a amplitude diminui a cada ida e volta.`}
      </Explicacao>
    </div>
  );
}
