import { useRef, useState } from 'react';
import { DH_N2O4, evoluirN2O4, KcN2O4, quocienteN2O4 } from '../../../lib/simulacoes/quimica';
import { criarRng, fmt, fmtCientifico } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const JANELA = 40; // s no gráfico
const MOL_POR_PONTO = 0.05 / 36; // escala do zoom molecular (1 L)

interface Vista {
  t: number;
  s: number[];
  hist: { t: number; a: number; b: number }[];
}

export default function Equilibrio() {
  const [T, setT] = useState(298);
  const [V, setV] = useState(1);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const sim = useRef({ t: 0, s: [0.05, 0] as number[], hist: [] as Vista['hist'], acc: 0, V: 1 });
  const [vista, setVista] = useState<Vista>({ t: 0, s: [0.05, 0], hist: [] });
  const moleculas = useRef<{ x: number; y: number; vx: number; vy: number; tipo: 'A' | 'B' }[]>([]);
  const rng = useRef(criarRng(3));

  const retrato = () => {
    const st = sim.current;
    setVista({ t: st.t, s: [...st.s], hist: st.hist.slice() });
  };
  const perturbar = (f: (s: number[]) => number[]) => {
    sim.current.s = f(sim.current.s).map((x) => Math.max(0, x));
    retrato();
  };
  const mudarVolume = (novo: number) => {
    const fator = sim.current.V / novo;
    sim.current.V = novo;
    setV(novo);
    perturbar((s) => s.map((x) => x * fator));
  };
  const reiniciar = () => {
    sim.current = { t: 0, s: [0.05, 0], hist: [], acc: 0, V: 1 };
    setV(1);
    retrato();
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    if (rodando) {
      st.s = evoluirN2O4(st.s, T, dt);
      st.t += dt;
      st.hist.push({ t: st.t, a: st.s[0], b: st.s[1] });
      while (st.hist.length && st.hist[0].t < st.t - JANELA) st.hist.shift();
      st.acc += dt;
      if (st.acc > 0.2) {
        st.acc = 0;
        retrato();
      }
    }
    const [A, B] = st.s;
    // Balão: cor castanha pela absorção do NO₂ (Beer-Lambert), proporcional à concentração.
    const cx = w * 0.27;
    const cy = h * 0.58;
    const R = Math.min(w * 0.2, h * 0.3) * Math.cbrt(st.V);
    const absorb = 0.88 * (1 - Math.exp(-B * 45 * Math.cbrt(st.V)));
    ctx.fillStyle = `rgba(176, 88, 28, ${absorb.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2 + 0.25, -Math.PI / 2 - 0.25 + 2 * Math.PI);
    ctx.stroke();
    ctx.strokeRect(cx - R * 0.24, cy - R - R * 0.6, R * 0.48, R * 0.6 + 2);
    texto(ctx, `${fmt(T - 273.15, 0)} °C · ${fmt(st.V, 2)} L`, cx, cy + R + 24, c.muted, { alinhar: 'center', tamanho: 11 });

    // Zoom molecular: o número de partículas segue a quantidade de matéria (n = C·V).
    const zx = w * 0.52;
    const zy = h * 0.08;
    const zw = w * 0.45;
    const zh = h * 0.84;
    ctx.fillStyle = alfa(c.surface, 0.9);
    ctx.strokeStyle = c.line;
    ctx.beginPath(); ctx.roundRect(zx, zy, zw, zh, 12); ctx.fill(); ctx.stroke();
    const alvoA = Math.round((A * st.V) / MOL_POR_PONTO);
    const alvoB = Math.round((B * st.V) / MOL_POR_PONTO);
    const mol = moleculas.current;
    const r = rng.current;
    let nA = mol.filter((m) => m.tipo === 'A').length;
    let nB = mol.length - nA;
    const tirar = (tp: 'A' | 'B') => mol.splice(mol.findIndex((m) => m.tipo === tp), 1)[0];
    // Reações visíveis: um N₂O₄ se parte em dois NO₂ no mesmo lugar, e dois NO₂ se juntam.
    while (nA > alvoA && nB < alvoB) {
      const m = tirar('A');
      mol.push({ ...m, tipo: 'B', vx: -m.vy, vy: m.vx }, { ...m, tipo: 'B', x: m.x + 0.02, vx: m.vy, vy: -m.vx });
      nA--;
      nB += 2;
    }
    while (nB > alvoB + 1 && nA < alvoA) {
      const m = tirar('B');
      tirar('B');
      mol.push({ ...m, tipo: 'A' });
      nB -= 2;
      nA++;
    }
    // O que sobra é matéria que entrou ou saiu do balão.
    for (; nA > alvoA; nA--) tirar('A');
    for (; nB > alvoB; nB--) tirar('B');
    for (; nA < alvoA; nA++) mol.push({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5, tipo: 'A' });
    for (; nB < alvoB; nB++) mol.push({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5, tipo: 'B' });
    const vel = 0.25 * Math.sqrt(T / 298);
    for (const m of mol) {
      m.x += m.vx * vel * dt;
      m.y += m.vy * vel * dt;
      if (m.x < 0.03 || m.x > 0.97) m.vx = -m.vx;
      if (m.y < 0.03 || m.y > 0.97) m.vy = -m.vy;
      m.x = Math.min(0.97, Math.max(0.03, m.x));
      m.y = Math.min(0.97, Math.max(0.03, m.y));
      const px = zx + m.x * zw;
      const py = zy + m.y * zh;
      if (m.tipo === 'A') {
        ctx.fillStyle = c.mat;
        ctx.beginPath(); ctx.arc(px - 3.5, py, 4, 0, Math.PI * 2); ctx.arc(px + 3.5, py, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#b4532a';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    texto(ctx, 'N₂O₄', zx + 12, zy + zh - 12, c.mat, { peso: 700, tamanho: 11 });
    texto(ctx, 'NO₂', zx + 52, zy + zh - 12, '#b4532a', { peso: 700, tamanho: 11 });
  };

  const [A, B] = vista.s;
  const Q = quocienteN2O4(vista.s);
  const K = KcN2O4(T);
  const sentido = Math.abs(Q / K - 1) < 0.02 ? 'em equilíbrio' : Q < K ? 'direto: forma NO₂' : 'inverso: forma N₂O₄';

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Balão com N₂O₄ e NO₂ e o zoom das moléculas" proporcao={16 / 10} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: '[N₂O₄]', valor: `${fmt(A * 1000, 1)} mmol/L`, cor: 'var(--mat)' },
              { rotulo: '[NO₂]', valor: `${fmt(B * 1000, 1)} mmol/L`, cor: '#b4532a' },
              { rotulo: 'Q = [NO₂]²/[N₂O₄]', valor: Number.isFinite(Q) ? fmtCientifico(Q) : '∞' },
              { rotulo: `Kc a ${fmt(T - 273.15, 0)} °C`, valor: fmtCientifico(K) },
              { rotulo: 'Reação avançando', valor: sentido },
              { rotulo: 'Cor', valor: B > 0.02 ? 'castanho escuro' : B > 0.006 ? 'castanho' : 'quase incolor' },
            ]}
          />
        }
        extra={
          <Bloco titulo="Concentrações ao longo do tempo">
            <Grafico
              series={[
                { rotulo: 'N₂O₄', cor: 'var(--mat)', pontos: vista.hist.map((p) => [p.t, p.a * 1000]) },
                { rotulo: 'NO₂', cor: '#b4532a', pontos: vista.hist.map((p) => [p.t, p.b * 1000]) },
              ]}
              rotuloX="tempo (s)"
              rotuloY="mmol/L"
              xMin={Math.max(0, vista.t - JANELA)}
              xMax={Math.max(JANELA, vista.t)}
              yMin={0}
              altura={200}
            />
          </Bloco>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Deslizador rotulo="Temperatura" valor={T} min={250} max={370} unidade="K" formatar={(x) => `${fmt(x, 0)} (${fmt(x - 273.15, 0)} °C)`} onChange={setT} dica="Banho de gelo ≈ 273 K; água quente ≈ 350 K." />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => mudarVolume(Math.max(0.25, V / 2))}>Comprimir (½ V)</button>
              <button type="button" className="btn btn-ghost" onClick={() => mudarVolume(Math.min(4, V * 2))}>Expandir (2 V)</button>
              <button type="button" className="btn btn-ghost" onClick={() => perturbar(([a, b]) => [a + 0.02 / sim.current.V, b])}>+ N₂O₄</button>
              <button type="button" className="btn btn-ghost" onClick={() => perturbar(([a, b]) => [a, b + 0.02 / sim.current.V])}>+ NO₂</button>
              <button type="button" className="btn btn-ghost col-span-2" onClick={() => perturbar(([a, b]) => [a, b / 2])}>Retirar metade do NO₂</button>
            </div>
            <p className="text-xs text-muted">A reação real se ajusta em microssegundos; aqui ela foi desacelerada para você ver o caminho até o equilíbrio.</p>
          </>
        }
      />
      <Explicacao enem={`O princípio de **Le Chatelier**: um sistema em equilíbrio perturbado se desloca no sentido que atenua a perturbação. Aquecer favorece o sentido **endotérmico**; aumentar a pressão favorece o lado com **menos mols de gás**; adicionar uma substância desloca para consumi-la. Só a temperatura muda o valor de $K$.`}>
        {`Na reação $\\mathrm{N_2O_4(g)} \\rightleftharpoons \\mathrm{2\\,NO_2(g)}$, o $\\mathrm{N_2O_4}$ é incolor e o $\\mathrm{NO_2}$ é castanho, então dá para ver o equilíbrio pela cor. As duas reações acontecem o tempo todo; no equilíbrio, as velocidades se igualam e
$$K_c = \\frac{[\\mathrm{NO_2}]^2}{[\\mathrm{N_2O_4}]}.$$
Compare o quociente $Q$ com $K_c$: se $Q < K_c$ a reação avança no sentido direto; se $Q > K_c$, no inverso.

O sentido direto absorve ${fmt(DH_N2O4 / 1000, 1)} kJ/mol (**endotérmico**): aqueça e a mistura escurece, resfrie e ela clareia. Comprimir dobra as concentrações e o sistema compensa formando $\\mathrm{N_2O_4}$, que ocupa menos (1 mol de gás contra 2). O valor de $K$ em cada temperatura vem dos dados termodinâmicos reais da reação ($\\Delta H°$ e $\\Delta S°$).`}
      </Explicacao>
    </div>
  );
}
