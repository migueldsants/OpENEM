import { useRef, useState } from 'react';
import { descidaPlano, forcasPlano, GRAVIDADES } from '../../../lib/simulacoes/mecanica';
import { fmt, grausParaRad } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const COMPRIMENTO = 4; // m de rampa

/** Pares de materiais com coeficientes típicos de tabela (seco). */
const SUPERFICIES = [
  { key: 'madeira', nome: 'Madeira sobre madeira', muE: 0.5, muC: 0.3 },
  { key: 'borracha', nome: 'Borracha sobre concreto', muE: 1.0, muC: 0.8 },
  { key: 'aco', nome: 'Aço sobre aço', muE: 0.74, muC: 0.57 },
  { key: 'gelo', nome: 'Gelo sobre gelo', muE: 0.1, muC: 0.03 },
  { key: 'teflon', nome: 'Teflon sobre aço', muE: 0.04, muC: 0.04 },
  { key: 'livre', nome: 'Personalizado', muE: 0.4, muC: 0.25 },
] as const;

export default function PlanoInclinado() {
  const [angulo, setAngulo] = useState(25);
  const [m, setM] = useState(5);
  const [supKey, setSupKey] = useState<string>('madeira');
  const [muE, setMuE] = useState(0.5);
  const [muC, setMuC] = useState(0.3);
  const [comp, setComp] = useState(true);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const sim = useRef({ d: 0, v: 0, t: 0 });
  const [vista, setVista] = useState({ d: 0, v: 0, t: 0 });
  const acc = useRef(0);

  const p = { anguloGraus: angulo, m, muE, muC, g: GRAVIDADES[0].g };
  const f = forcasPlano(p);
  const desc = descidaPlano(p, COMPRIMENTO);

  const reiniciar = () => {
    sim.current = { d: 0, v: 0, t: 0 };
    setVista({ d: 0, v: 0, t: 0 });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    if (rodando && !f.parado) {
      // MRUV ao longo da rampa: a é constante.
      st.t += dt;
      st.v += f.aceleracao * dt;
      st.d += st.v * dt;
      if (st.d >= COMPRIMENTO) {
        st.d = COMPRIMENTO;
        st.v = Math.sqrt(2 * f.aceleracao * COMPRIMENTO);
      }
      acc.current += dt;
      if (acc.current > 0.08) {
        acc.current = 0;
        setVista({ ...st });
      }
      if (st.d >= COMPRIMENTO && st.t > desc.tempo + 1.5) reiniciar();
    }
    const th = grausParaRad(angulo);
    const base = Math.min(w * 0.72, (h * 0.78) / Math.max(Math.tan(th), 0.05));
    const L = base / Math.cos(th);
    const x0 = (w - base) / 2;
    const yChao = h * 0.88;
    const topo: [number, number] = [x0, yChao - base * Math.tan(th)];
    // Rampa.
    ctx.fillStyle = alfa(c.muted, 0.22);
    ctx.beginPath(); ctx.moveTo(x0, yChao); ctx.lineTo(x0 + base, yChao); ctx.lineTo(...topo); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.muted; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(0, yChao); ctx.lineTo(w, yChao); ctx.stroke();
    // Ângulo.
    ctx.strokeStyle = c.fg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x0 + base, yChao, 40, Math.PI, Math.PI + th, false); ctx.stroke();
    texto(ctx, `${angulo}°`, x0 + base - 52, yChao - 10, c.fg, { alinhar: 'right', mono: true });

    // Bloco: posição ao longo da rampa (de cima para baixo).
    const frac = sim.current.d / COMPRIMENTO;
    const lado = 46;
    const ux = Math.cos(th);
    const uy = Math.sin(th); // descendo: +x, +y (canvas)
    const nx = Math.sin(th);
    const ny = -Math.cos(th); // normal para fora da rampa
    const sx = topo[0] + ux * (lado * 0.7 + frac * (L - lado * 1.4));
    const sy = topo[1] + uy * (lado * 0.7 + frac * (L - lado * 1.4));
    const cx = sx + nx * (lado / 2);
    const cy = sy + ny * (lado / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(th);
    ctx.fillStyle = c.brand;
    ctx.beginPath(); ctx.roundRect(-lado / 2, -lado / 2, lado, lado, 6); ctx.fill();
    texto(ctx, `${m} kg`, 0, 4, c.surface, { alinhar: 'center', peso: 700, tamanho: 11 });
    ctx.restore();

    // Vetores (escala: maior força cabe em ~110 px).
    const esc = 110 / Math.max(f.peso, 1);
    seta(ctx, cx, cy, cx, cy + f.peso * esc, c.fg, 2.5, 'P');
    seta(ctx, sx, sy, sx + nx * f.normal * esc, sy + ny * f.normal * esc, c.mat, 2.5, 'N');
    if (f.atrito > 1e-6) seta(ctx, sx - ux * 6, sy - uy * 6, sx - ux * (6 + f.atrito * esc), sy - uy * (6 + f.atrito * esc), c.danger, 2.5, 'Fat');
    if (comp) {
      ctx.setLineDash([4, 3]);
      seta(ctx, cx, cy, cx + ux * f.px * esc, cy + uy * f.px * esc, alfa(c.hum, 0.95), 2, 'Px');
      seta(ctx, cx, cy, cx - nx * f.py * esc, cy - ny * f.py * esc, alfa(c.hum, 0.95), 2, 'Py');
      ctx.setLineDash([]);
    }
    texto(ctx, f.parado ? 'Em repouso: o atrito estático segura o bloco' : `a = ${fmt(f.aceleracao, 2)} m/s²`, 14, 22, f.parado ? c.nat : c.fg, { peso: 600 });
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Bloco sobre um plano inclinado com os vetores de força" proporcao={16 / 10} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Peso (P = mg)', valor: `${fmt(f.peso, 1)} N` },
              { rotulo: 'Px = P·sen θ', valor: `${fmt(f.px, 1)} N`, cor: 'var(--hum)' },
              { rotulo: 'Normal = P·cos θ', valor: `${fmt(f.normal, 1)} N`, cor: 'var(--mat)' },
              { rotulo: 'Atrito', valor: `${fmt(f.atrito, 1)} N`, cor: 'var(--danger)', nota: f.parado ? `estático (máx. ${fmt(f.atritoMaxEstatico, 1)} N)` : 'cinético (μc·N)' },
              { rotulo: 'Resultante', valor: `${fmt(f.resultante, 1)} N` },
              { rotulo: 'Aceleração', valor: `${fmt(f.aceleracao, 2)} m/s²` },
              { rotulo: 'Ângulo crítico (tg θ = μe)', valor: `${fmt(f.anguloCritico, 1)}°` },
              { rotulo: `Descida de ${COMPRIMENTO} m`, valor: Number.isFinite(desc.tempo) ? `${fmt(desc.tempo, 2)} s` : 'não desce', nota: Number.isFinite(desc.tempo) ? `chega a ${fmt(desc.velocidade, 2)} m/s` : undefined },
              { rotulo: 'Velocidade agora', valor: `${fmt(vista.v, 2)} m/s` },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Deslizador rotulo="Inclinação" valor={angulo} min={0} max={70} unidade="°" onChange={(v) => { setAngulo(v); reiniciar(); }} />
            <Deslizador rotulo="Massa do bloco" valor={m} min={1} max={50} unidade="kg" onChange={(v) => { setM(v); reiniciar(); }} dica="A aceleração não depende da massa: experimente." />
            <Seletor
              rotulo="Superfícies"
              valor={supKey}
              opcoes={SUPERFICIES.map((s) => ({ valor: s.key, rotulo: s.nome }))}
              onChange={(k) => {
                const s = SUPERFICIES.find((x) => x.key === k)!;
                setSupKey(k);
                if (k !== 'livre') { setMuE(s.muE); setMuC(s.muC); }
                reiniciar();
              }}
            />
            <Deslizador rotulo="Atrito estático (μe)" valor={muE} min={0} max={1.2} passo={0.01} onChange={(v) => { setSupKey('livre'); setMuE(v); if (muC > v) setMuC(v); reiniciar(); }} />
            <Deslizador rotulo="Atrito cinético (μc)" valor={muC} min={0} max={muE} passo={0.01} onChange={(v) => { setSupKey('livre'); setMuC(v); reiniciar(); }} dica="O cinético é sempre menor ou igual ao estático." />
            <Alternar rotulo="Mostrar Px e Py" marcado={comp} onChange={setComp} />
          </>
        }
      />
      <Explicacao enem={'É comum a questão pedir o ângulo a partir do qual o bloco começa a escorregar: no limite, $mg\\sin\\theta = \\mu_e\\,mg\\cos\\theta$, ou seja, $\\tan\\theta = \\mu_e$, sem depender da massa.'}>
        {`O peso se decompõe em $P_x = mg\\sin\\theta$, que puxa o bloco rampa abaixo, e $P_y = mg\\cos\\theta$, equilibrada pela **normal**. O atrito age contra a tendência de movimento:

- **parado**, o atrito estático é exatamente igual a $P_x$, até o máximo $\\mu_e N$;
- **deslizando**, vale $\\mu_c N$ e a aceleração é $a = g(\\sin\\theta - \\mu_c\\cos\\theta)$.

Como o cinético é menor que o estático, é mais difícil tirar um móvel do lugar do que mantê-lo deslizando. Repare também que $m$ aparece nos dois lados e se cancela: a aceleração não depende da massa.`}
      </Explicacao>
    </div>
  );
}
