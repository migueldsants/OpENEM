import { useMemo, useRef, useState } from 'react';
import {
  coeficienteArrasto,
  GRAVIDADES,
  lancamentoIdeal,
  PROJETEIS,
  simularLancamento,
} from '../../../lib/simulacoes/mecanica';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, marcasEixo, seta, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

export default function Lancamento() {
  const [v0, setV0] = useState(22);
  const [angulo, setAngulo] = useState(40);
  const [h0, setH0] = useState(0);
  const [gKey, setGKey] = useState<string>('terra');
  const [projKey, setProjKey] = useState<string>('futebol');
  const [comAr, setComAr] = useState(true);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const [vel, setVel] = useState(1);
  const anim = useRef({ t: 0 });

  const g = GRAVIDADES.find((x) => x.key === gKey)!.g;
  const proj = PROJETEIS.find((p) => p.key === projKey)!;
  // A Lua não tem atmosfera; Marte tem ~1% da densidade do ar da Terra.
  const rho = gKey === 'lua' ? 0 : gKey === 'marte' ? 0.020 : gKey === 'jupiter' ? 0.16 : 1.225;
  const k = comAr ? coeficienteArrasto(proj, rho) : 0;

  const traj = useMemo(() => simularLancamento({ v0, anguloGraus: angulo, h0, g, k }), [v0, angulo, h0, g, k]);
  const ideal = useMemo(() => simularLancamento({ v0, anguloGraus: angulo, h0, g, k: 0 }), [v0, angulo, h0, g]);
  const formulas = lancamentoIdeal({ v0, anguloGraus: angulo, h0, g });

  const reiniciar = () => {
    anim.current.t = 0;
    setRodando(true);
  };
  const muda = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    anim.current.t = 0;
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    if (rodando) {
      anim.current.t += dt * vel;
      if (anim.current.t > traj.tempoVoo + 1.2) anim.current.t = 0;
    }
    const t = Math.min(anim.current.t, traj.tempoVoo);
    const xMax = Math.max(ideal.alcance, traj.alcance, 1) * 1.08;
    const yMax = Math.max(ideal.alturaMax, traj.alturaMax, 1) * 1.2;
    const pad = { e: 40, d: 16, t: 14, b: 30 };
    const esc = Math.min((w - pad.e - pad.d) / xMax, (h - pad.t - pad.b) / yMax);
    const X = (x: number) => pad.e + x * esc;
    const Y = (y: number) => h - pad.b - y * esc;

    // Grade em metros (a mesma escala nos dois eixos).
    ctx.lineWidth = 1;
    for (const m of marcasEixo(0, (w - pad.e - pad.d) / esc, 8)) {
      ctx.strokeStyle = alfa(c.line, 0.7);
      ctx.beginPath(); ctx.moveTo(X(m), pad.t); ctx.lineTo(X(m), Y(0)); ctx.stroke();
      texto(ctx, `${fmt(m, 0)} m`, X(m), h - 10, c.muted, { tamanho: 10, alinhar: 'center' });
    }
    for (const m of marcasEixo(0, (h - pad.t - pad.b) / esc, 5)) {
      if (m === 0) continue;
      ctx.strokeStyle = alfa(c.line, 0.7);
      ctx.beginPath(); ctx.moveTo(pad.e, Y(m)); ctx.lineTo(w - pad.d, Y(m)); ctx.stroke();
      texto(ctx, `${fmt(m, 0)}`, pad.e - 6, Y(m) + 3, c.muted, { tamanho: 10, alinhar: 'right' });
    }
    // Chão e plataforma.
    ctx.fillStyle = alfa(c.nat, 0.18);
    ctx.fillRect(0, Y(0), w, h - Y(0));
    ctx.strokeStyle = c.nat;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
    if (h0 > 0) {
      ctx.fillStyle = alfa(c.muted, 0.35);
      ctx.fillRect(X(0) - 18, Y(h0), 18, h0 * esc);
    }

    // Trajetória sem ar (referência) e a real até o instante t.
    if (k > 0) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = alfa(c.muted, 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ideal.pontos.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = c.brand;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let atual = traj.pontos[0];
    for (const p of traj.pontos) {
      if (p.t > t) break;
      atual = p;
      if (p === traj.pontos[0]) ctx.moveTo(X(p.x), Y(p.y));
      else ctx.lineTo(X(p.x), Y(p.y));
    }
    ctx.stroke();
    // Marcas a cada 0,25 s ("fotografia estroboscópica").
    ctx.fillStyle = alfa(c.brand, 0.45);
    for (let ts = 0.25; ts < t; ts += 0.25) {
      const p = traj.pontos[Math.min(traj.pontos.length - 1, Math.round(ts / 0.002))];
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Bola e vetores de velocidade (componentes).
    const bx = X(atual.x);
    const by = Y(atual.y);
    const ev = 2.2;
    seta(ctx, bx, by, bx + atual.vx * ev, by, alfa(c.mat, 0.9), 2, 'vx');
    seta(ctx, bx, by, bx, by - atual.vy * ev, alfa(c.hum, 0.9), 2, 'vy');
    seta(ctx, bx, by, bx + atual.vx * ev, by - atual.vy * ev, c.fg, 2.5, 'v');
    ctx.fillStyle = c.fg;
    ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.surface;
    ctx.beginPath(); ctx.arc(bx - 2, by - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    texto(ctx, `t = ${fmt(t, 2)} s`, w - pad.d, pad.t + 12, c.fg, { alinhar: 'right', mono: true, tamanho: 12 });
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Trajetória do projétil" proporcao={16 / 9} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Alcance', valor: `${fmt(traj.alcance, 1)} m`, nota: k ? `sem ar: ${fmt(ideal.alcance, 1)} m` : undefined },
              { rotulo: 'Altura máxima', valor: `${fmt(traj.alturaMax, 1)} m`, nota: k ? `sem ar: ${fmt(ideal.alturaMax, 1)} m` : undefined },
              { rotulo: 'Tempo de voo', valor: `${fmt(traj.tempoVoo, 2)} s` },
              { rotulo: 'Velocidade no impacto', valor: `${fmt(traj.vImpacto, 1)} m/s`, nota: `${fmt(traj.vImpacto * 3.6, 0)} km/h` },
              { rotulo: 'vx inicial', valor: `${fmt(v0 * Math.cos((angulo * Math.PI) / 180), 1)} m/s`, cor: 'var(--mat)' },
              { rotulo: 'vy inicial', valor: `${fmt(v0 * Math.sin((angulo * Math.PI) / 180), 1)} m/s`, cor: 'var(--hum)' },
              { rotulo: 'Fórmula (sem ar)', valor: `${fmt(formulas.alcance, 1)} m`, nota: 'A = vx · t' },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} velocidade={vel} onVelocidade={setVel} />
            <Deslizador rotulo="Velocidade inicial" valor={v0} min={1} max={45} passo={0.5} unidade="m/s" onChange={muda(setV0)} />
            <Deslizador rotulo="Ângulo de lançamento" valor={angulo} min={0} max={90} unidade="°" onChange={muda(setAngulo)} />
            <Deslizador rotulo="Altura inicial" valor={h0} min={0} max={30} passo={0.5} unidade="m" onChange={muda(setH0)} />
            <Seletor rotulo="Onde" valor={gKey} opcoes={GRAVIDADES.map((x) => ({ valor: x.key, rotulo: `${x.nome} (g = ${fmt(x.g, 2)} m/s²)` }))} onChange={muda(setGKey)} />
            <Seletor rotulo="Objeto" valor={projKey} opcoes={PROJETEIS.map((p) => ({ valor: p.key, rotulo: p.nome }))} onChange={muda(setProjKey)} />
            <Alternar
              rotulo="Resistência do ar"
              marcado={comAr}
              onChange={muda(setComAr)}
              dica={gKey === 'lua' ? 'A Lua não tem atmosfera: com ou sem, dá no mesmo.' : 'Arrasto quadrático, F = ½·ρ·Cd·A·v². A linha tracejada é o voo no vácuo.'}
            />
          </>
        }
      />
      <Explicacao
        enem={'Sem resistência do ar, o movimento horizontal é **uniforme** e o vertical é **uniformemente variado**: as duas componentes são independentes. Ângulos complementares (30° e 60°) dão o mesmo alcance, e o maior alcance a partir do chão é com 45°.'}
      >
        {`A velocidade inicial se divide em $v_x = v_0\\cos\\theta$ e $v_y = v_0\\sin\\theta$. No vácuo, $v_x$ não muda e $v_y$ diminui $g$ a cada segundo, por isso a trajetória é uma **parábola** com alcance $A = \\dfrac{v_0^2 \\sin 2\\theta}{g}$ (lançamento do chão).

Com o ar, a força de arrasto aponta contra a velocidade e cresce com $v^2$. A trajetória fica assimétrica (a descida é mais íngreme), o alcance cai e o melhor ângulo fica **abaixo de 45°**. Compare a bola de pingue-pongue, leve e grande, com o peso de arremesso: o arrasto importa pela razão entre a área e a massa.

Os pontos sobre a curva marcam a posição a cada 0,25 s. A simulação integra as equações de Newton numericamente (Runge-Kutta de 4ª ordem); sem ar, o resultado coincide com a fórmula até a terceira casa decimal.`}
      </Explicacao>
    </div>
  );
}
