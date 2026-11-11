import { useRef, useState } from 'react';
import {
  amplitudeForcada,
  derivadaMola,
  omegaNatural,
  periodoMola,
  regimeAmortecimento,
} from '../../../lib/simulacoes/mecanica';
import { avancar, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, medidorEnergia, seta, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Ponteiro, type Quadro } from '../ui';

const JANELA = 12;
/** Segundos de traço que cabem no papel embaixo do bloco. */
const PAPEL = 6;

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
  const sim = useRef({ t: 0, s: [0.15, 0] as number[], hist: [] as [number, number][], acc: 0, emax: 0 });
  const arrastando = useRef(false);
  const [vista, setVista] = useState({ t: 0, s: [0.15, 0], hist: [] as [number, number][] });

  const reiniciar = (x0 = forcado ? 0 : 0.15) => {
    sim.current = { t: 0, s: [x0, 0], hist: [], acc: 0, emax: 0 };
    setVista({ t: 0, s: [x0, 0], hist: [] });
  };

  /** Onde cada coisa fica no palco: o trilho em cima, o papel embaixo. */
  const geo = (w: number, h: number) => {
    const lado = Math.max(48, Math.min(84, h * 0.15));
    const yTrilho = Math.max(lado + 74, h * 0.36);
    const repouso = w * 0.52;
    const escala = (w * 0.34) / 0.3; // 30 cm ocupam 34% da largura
    return { lado, yTrilho, repouso, escala, X: (x: number) => repouso + Math.max(-0.36, Math.min(0.36, x)) * escala };
  };

  // Puxar o bloco com o dedo: solta do repouso, onde o aluno deixou.
  const onPonteiro = (e: Ponteiro) => {
    const g = geo(e.w, e.h);
    const st = sim.current;
    if (e.tipo === 'up') {
      if (!arrastando.current) return;
      arrastando.current = false;
      sim.current = { t: 0, s: [st.s[0], 0], hist: [], acc: 0, emax: 0 };
      setRodando(true);
      return;
    }
    if (e.tipo === 'down') {
      const bx = g.X(st.s[0]);
      if (Math.abs(e.x - bx) > g.lado * 0.8 || e.y < g.yTrilho - g.lado - 24 || e.y > g.yTrilho + 24) return;
      arrastando.current = true;
    }
    if (!arrastando.current) return;
    st.s = [Math.max(-0.3, Math.min(0.3, (e.x - g.repouso) / g.escala)), 0];
    st.hist = [];
    st.emax = 0;
  };

  const quadro: Quadro = (ctx, w, h, dt, cor) => {
    const st = sim.current;
    if (rodando && !arrastando.current) {
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
    const g = geo(w, h);
    const { lado, yTrilho, repouso } = g;
    const paredeX = 30;
    const bx = g.X(x);
    // Papel embaixo do bloco: a caneta presa nele desenha x(t) enquanto o papel desce.
    const yP0 = yTrilho + 46;
    const yP1 = h - 78;
    if (yP1 - yP0 > 60) {
      const xa = g.X(-0.36) - 12;
      const xb = g.X(0.36) + 12;
      ctx.fillStyle = alfa(cor.surface, 0.55);
      ctx.beginPath(); ctx.roundRect(xa, yP0, xb - xa, yP1 - yP0, 10); ctx.fill();
      ctx.strokeStyle = alfa(cor.muted, 0.22);
      ctx.lineWidth = 1;
      for (let seg = 1; seg < PAPEL; seg++) {
        const y = yP0 + (seg / PAPEL) * (yP1 - yP0);
        ctx.beginPath(); ctx.moveTo(xa + 8, y); ctx.lineTo(xb - 8, y); ctx.stroke();
        texto(ctx, `${seg} s`, xb - 10, y - 4, cor.muted, { alinhar: 'right', tamanho: 10, mono: true });
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(xa, yP0, xb - xa, yP1 - yP0); ctx.clip();
      ctx.strokeStyle = cor.brand;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let primeiro = true;
      for (const [th, xcm] of st.hist) {
        const idade = st.t - th;
        if (idade > PAPEL) continue;
        const py = yP0 + (idade / PAPEL) * (yP1 - yP0);
        if (primeiro) ctx.moveTo(g.X(xcm / 100), py); else ctx.lineTo(g.X(xcm / 100), py);
        primeiro = false;
      }
      ctx.stroke();
      ctx.restore();
      // A caneta: do bloco até o papel.
      ctx.strokeStyle = alfa(cor.brand, 0.6);
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(bx, yTrilho + 8); ctx.lineTo(bx, yP0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cor.brand;
      ctx.beginPath(); ctx.arc(bx, yP0, 4, 0, Math.PI * 2); ctx.fill();
      texto(ctx, 'posição ao longo do tempo (o papel desce)', xa + 10, yP1 - 8, cor.muted, { tamanho: 10 });
    }
    // Trilho com régua em centímetros e a parede.
    ctx.fillStyle = alfa(cor.muted, 0.35);
    ctx.fillRect(0, yTrilho, w, 6);
    for (let cm = -30; cm <= 30; cm += 5) {
      ctx.fillStyle = alfa(cor.muted, 0.7);
      ctx.fillRect(g.X(cm / 100) - 0.5, yTrilho + 6, 1, cm % 10 ? 4 : 8);
      if (cm % 10 === 0) texto(ctx, String(cm), g.X(cm / 100), yTrilho + 26, cor.muted, { alinhar: 'center', tamanho: 10, mono: true });
    }
    texto(ctx, 'cm', g.X(0.36) + 4, yTrilho + 26, cor.muted, { tamanho: 10 });
    ctx.fillStyle = cor.muted;
    ctx.fillRect(paredeX - 12, yTrilho - lado - 40, 12, lado + 46);
    // Posição de equilíbrio.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = alfa(cor.muted, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(repouso, yTrilho - lado - 30); ctx.lineTo(repouso, yTrilho); ctx.stroke();
    ctx.setLineDash([]);
    // Mola: espiras que abrem e fecham; mais grossa quando a constante é maior.
    const espiras = 12;
    const ini = paredeX;
    const fim = bx - lado / 2;
    const yM = yTrilho - lado / 2;
    const amp = lado * 0.26;
    ctx.strokeStyle = cor.fg;
    ctx.lineWidth = 1.6 + Math.min(2.4, k / 40);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ini, yM);
    ctx.lineTo(ini + 12, yM);
    const passo = (fim - ini - 24) / espiras;
    for (let i = 0; i < espiras; i++) {
      ctx.lineTo(ini + 12 + passo * (i + 0.25), yM - amp);
      ctx.lineTo(ini + 12 + passo * (i + 0.75), yM + amp);
    }
    ctx.lineTo(fim - 12, yM);
    ctx.lineTo(fim, yM);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Bloco (dá para puxar).
    ctx.fillStyle = cor.brand;
    ctx.beginPath(); ctx.roundRect(bx - lado / 2, yTrilho - lado, lado, lado, 10); ctx.fill();
    if (arrastando.current) {
      ctx.strokeStyle = cor.fg;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    texto(ctx, `${fmt(m, 1)} kg`, bx, yTrilho - lado / 2 + 5, cor.surface, { alinhar: 'center', tamanho: 13, peso: 700 });
    // Força elástica (sempre para o equilíbrio) e força externa.
    const Fel = -k * x;
    const pxF = Math.max(-140, Math.min(140, Fel * 12));
    seta(ctx, bx, yTrilho - lado - 18, bx + pxF, yTrilho - lado - 18, cor.mat, 3);
    if (Math.abs(pxF) > 24) texto(ctx, `força da mola ${fmt(Math.abs(Fel), 1)} N`, bx + pxF / 2, yTrilho - lado - 28, cor.mat, { alinhar: 'center', tamanho: 11, peso: 700 });
    if (forcado) {
      const Fe = F0 * Math.cos(wF * st.t);
      seta(ctx, bx, yTrilho - lado - 46, bx + Fe * 25, yTrilho - lado - 46, cor.hum, 3);
    }
    texto(ctx, `x = ${fmt(x * 100, 1)} cm`, w - 14, 24, cor.fg, { alinhar: 'right', mono: true, peso: 600 });
    texto(ctx, `t = ${fmt(st.t, 1)} s`, w - 14, 42, cor.muted, { alinhar: 'right', mono: true });
    if (st.t < 0.05 && !rodando) texto(ctx, 'Arraste o bloco e solte', bx, yTrilho - lado - 56, cor.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    // Energia: cinética e elástica trocando de lugar; com atrito, a barra encolhe.
    const ec = 0.5 * m * st.s[1] ** 2;
    const ep = 0.5 * k * x * x;
    st.emax = Math.max(st.emax, ec + ep);
    texto(ctx, 'Energia', 16, h - 50, cor.muted, { tamanho: 11, peso: 700 });
    medidorEnergia(ctx, 16, h - 42, Math.min(280, w * 0.42), [['cinética', ec, cor.mat], ['elástica', ep, cor.hum]], st.emax, cor);
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
        palco={<Palco2D quadro={quadro} rotulo="Bloco preso a uma mola oscilando; arraste o bloco para esticar ou comprimir a mola" proporcao={2} onPonteiro={onPonteiro} />}
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
            <p className="text-xs text-muted">Puxe o bloco no palco e solte: ele parte do repouso de onde você deixar.</p>
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
