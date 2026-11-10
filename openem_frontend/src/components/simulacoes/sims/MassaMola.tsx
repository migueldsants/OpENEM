import { useRef, useState } from 'react';
import {
  amplitudeForcada,
  derivadaMola,
  omegaNatural,
  periodoMola,
  regimeAmortecimento,
} from '../../../lib/simulacoes/mecanica';
import { avancar, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const JANELA = 12;

export default function MassaMola() {
  const [m, setM] = useState(1);
  const [k, setK] = useState(25);
  const [c, setC] = useState(0.4);
  const [forcado, setForcado] = useState(false);
  const [F0, setF0] = useState(1);
  const [razaoW, setRazaoW] = useState(1);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const w0 = omegaNatural(m, k);
  const wF = razaoW * w0;
  const p = { m, k, c, F0: forcado ? F0 : 0, omegaF: wF };
  const sim = useRef({ t: 0, s: [0.15, 0] as number[], hist: [] as [number, number][], acc: 0 });
  const [vista, setVista] = useState({ t: 0, s: [0.15, 0], hist: [] as [number, number][] });

  const reiniciar = (x0 = forcado ? 0 : 0.15) => {
    sim.current = { t: 0, s: [x0, 0], hist: [], acc: 0 };
    setVista({ t: 0, s: [x0, 0], hist: [] });
  };

  const quadro: Quadro = (ctx, w, h, dt, cor) => {
    const st = sim.current;
    if (rodando) {
      const r = avancar(derivadaMola(p), st.t, st.s, dt, 1 / 2000);
      st.t = r.t;
      st.s = r.y;
      st.hist.push([st.t, st.s[0] * 100]);
      while (st.hist.length && st.hist[0][0] < st.t - JANELA) st.hist.shift();
      st.acc += dt;
      if (st.acc > 0.1) {
        st.acc = 0;
        setVista({ t: st.t, s: [...st.s], hist: st.hist.slice() });
      }
    }
    const x = st.s[0];
    // Horizontal: parede à esquerda, mola, bloco sobre trilho de ar.
    const escala = (w * 0.32) / 0.3; // 30 cm ocupam 32% da largura
    const paredeX = 30;
    const repouso = w * 0.5;
    const yTrilho = h * 0.62;
    const lado = 56;
    const bx = repouso + Math.max(-0.4, Math.min(0.4, x)) * escala;
    ctx.fillStyle = alfa(cor.muted, 0.35);
    ctx.fillRect(0, yTrilho, w, 6);
    ctx.fillStyle = cor.muted;
    ctx.fillRect(paredeX - 12, yTrilho - 110, 12, 116);
    // Posição de equilíbrio.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = alfa(cor.muted, 0.7);
    ctx.beginPath(); ctx.moveTo(repouso, yTrilho - lado - 30); ctx.lineTo(repouso, yTrilho + 20); ctx.stroke();
    ctx.setLineDash([]);
    texto(ctx, 'x = 0', repouso, yTrilho + 34, cor.muted, { alinhar: 'center', tamanho: 11 });
    // Mola em zigue-zague.
    const espiras = 14;
    const ini = paredeX;
    const fim = bx - lado / 2;
    const yM = yTrilho - lado / 2;
    ctx.strokeStyle = cor.fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ini, yM);
    const passo = (fim - ini - 20) / espiras;
    ctx.lineTo(ini + 10, yM);
    for (let i = 0; i < espiras; i++) ctx.lineTo(ini + 10 + passo * (i + 0.5), yM + (i % 2 ? 12 : -12));
    ctx.lineTo(fim - 10, yM);
    ctx.lineTo(fim, yM);
    ctx.stroke();
    // Bloco.
    ctx.fillStyle = cor.brand;
    ctx.beginPath();
    ctx.roundRect(bx - lado / 2, yTrilho - lado, lado, lado, 8);
    ctx.fill();
    texto(ctx, `${fmt(m, 1)} kg`, bx, yTrilho - lado / 2 + 4, cor.surface, { alinhar: 'center', peso: 700 });
    // Força elástica e força externa.
    const Fel = -k * x;
    seta(ctx, bx, yTrilho - lado - 16, bx + Fel * 3, yTrilho - lado - 16, cor.mat, 2.5, Math.abs(Fel) > 3 ? 'Fel' : undefined);
    if (forcado) {
      const Fe = F0 * Math.cos(wF * st.t);
      seta(ctx, bx, yTrilho + 22, bx + Fe * 25, yTrilho + 22, cor.hum, 2.5);
    }
    texto(ctx, `x = ${fmt(x * 100, 1)} cm`, w - 12, 22, cor.fg, { alinhar: 'right', mono: true });
    texto(ctx, `t = ${fmt(st.t, 1)} s`, w - 12, 40, cor.muted, { alinhar: 'right', mono: true });
  };

  const reg = regimeAmortecimento({ m, k, c });
  const ampForc = forcado ? amplitudeForcada({ ...p, F0 }) : 0;
  const curvaRes: [number, number][] = [];
  for (let r = 0.05; r <= 2.5; r += 0.01) curvaRes.push([r, amplitudeForcada({ m, k, c, F0, omegaF: r * w0 }) * 100]);
  const st = vista;
  const energia = 0.5 * k * st.s[0] ** 2 + 0.5 * m * st.s[1] ** 2;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Bloco preso a uma mola oscilando" proporcao={2} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Período natural 2π√(m/k)', valor: `${fmt(periodoMola(m, k), 3)} s` },
              { rotulo: 'Frequência natural', valor: `${fmt(w0 / (2 * Math.PI), 3)} Hz` },
              { rotulo: 'Regime', valor: reg.nome, nota: `ζ = ${fmt(reg.zeta, 3)}` },
              { rotulo: 'Energia mecânica', valor: `${fmt(energia, 4)} J` },
              ...(forcado
                ? [
                    { rotulo: 'Frequência da força', valor: `${fmt(wF / (2 * Math.PI), 3)} Hz` },
                    { rotulo: 'Amplitude prevista', valor: `${fmt(ampForc * 100, 1)} cm`, nota: 'depois do transitório' },
                  ]
                : []),
            ]}
          />
        }
        extra={
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco titulo="Posição × tempo">
              <Grafico
                series={[{ rotulo: 'x', cor: 'var(--brand)', pontos: st.hist }]}
                rotuloX="tempo (s)"
                rotuloY="x (cm)"
                xMin={Math.max(0, st.t - JANELA)}
                xMax={Math.max(JANELA, st.t)}
                altura={180}
              />
            </Bloco>
            <Bloco titulo="Curva de ressonância">
              <Grafico
                series={[{ rotulo: 'amplitude', cor: 'var(--hum)', pontos: curvaRes }]}
                rotuloX="ω da força ÷ ω natural"
                rotuloY="amplitude (cm)"
                xMin={0}
                xMax={2.5}
                yMin={0}
                verticais={[{ x: 1, rotulo: 'ressonância' }]}
                pontos={forcado ? [{ x: razaoW, y: ampForc * 100, cor: 'var(--brand)' }] : []}
                altura={180}
              />
            </Bloco>
          </div>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => reiniciar()} />
            <Deslizador rotulo="Massa" valor={m} min={0.2} max={5} passo={0.1} unidade="kg" onChange={setM} />
            <Deslizador rotulo="Constante da mola (k)" valor={k} min={5} max={200} unidade="N/m" onChange={setK} />
            <Deslizador rotulo="Amortecimento (c)" valor={c} min={0} max={20} passo={0.1} unidade="kg/s" onChange={setC} />
            <Alternar rotulo="Força externa periódica" marcado={forcado} onChange={(v) => { setForcado(v); reiniciar(v ? 0 : 0.15); }} dica="Uma força F₀·cos(ωt) empurra o bloco, como um motor desbalanceado." />
            {forcado && (
              <>
                <Deslizador rotulo="Intensidade da força (F₀)" valor={F0} min={0.1} max={5} passo={0.1} unidade="N" onChange={setF0} />
                <Deslizador
                  rotulo="Frequência da força"
                  valor={razaoW}
                  min={0.1}
                  max={2.5}
                  passo={0.01}
                  formatar={(v) => `${fmt(v, 2)} × natural`}
                  onChange={setRazaoW}
                />
              </>
            )}
          </>
        }
      />
      <Explicacao enem={'A ponte de Tacoma Narrows (1940) e as taças quebradas por um cantor são exemplos clássicos de **ressonância**: a força externa tem a mesma frequência natural do sistema e a energia se acumula a cada ciclo.'}>
        {`A mola puxa o bloco de volta com $F = -kx$ (lei de Hooke). Sem atrito, o resultado é um movimento harmônico simples de período
$$T = 2\\pi\\sqrt{\\frac{m}{k}},$$
que **não depende da amplitude**. Massa maior oscila mais devagar; mola mais dura, mais depressa.

O amortecimento $c$ tira energia: abaixo do valor crítico ($\\zeta < 1$) o bloco oscila perdendo amplitude; no crítico ele volta ao equilíbrio no menor tempo possível, sem oscilar (como o amortecedor de um carro).

Ligue a força externa e varie a frequência: perto da frequência natural a amplitude dispara, e quanto menor o amortecimento, mais alto e estreito é o pico da curva de ressonância.`}
      </Explicacao>
    </div>
  );
}
