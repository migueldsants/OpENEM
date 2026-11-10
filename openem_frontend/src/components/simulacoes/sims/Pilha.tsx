import { useRef, useState } from 'react';
import { descarregar, ELETRODOS, massaFaraday, montarPilha, type Pilha as TPilha } from '../../../lib/simulacoes/quimica';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto } from '../canvas';
import { Alternar, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const VOLUME = 0.1; // L em cada béquer
const COR_ION: Record<string, string> = { cu: '#2563eb', ni: '#16a34a', fe: '#84a94b' };

/** Concentração em escala logarítmica no controle (10⁻³ a 1 mol/L). */
const conc = (log: number) => 10 ** log;

export default function Pilha() {
  const [k1, setK1] = useState('zn');
  const [k2, setK2] = useState('cu');
  const [log1, setLog1] = useState(0);
  const [log2, setLog2] = useState(0);
  const [fechado, setFechado] = useState(true);
  const [R, setR] = useState(10);
  const [horasPorS, setHorasPorS] = useState(1);
  const e1 = ELETRODOS.find((e) => e.key === k1)!;
  const e2 = ELETRODOS.find((e) => e.key === k2)!;
  const nova = () => ({ pilha: montarPilha(e1, conc(log1), e2, conc(log2)), carga: 0, fase: 0 });
  const sim = useRef<{ pilha: TPilha; carga: number; fase: number } | null>(null);
  const [vista, setVista] = useState(() => ({ pilha: montarPilha(e1, 1, e2, 1), carga: 0 }));
  const acc = useRef(0);

  const recomecar = (a = k1, ca = log1, b = k2, cb = log2) => {
    const p = montarPilha(ELETRODOS.find((e) => e.key === a)!, conc(ca), ELETRODOS.find((e) => e.key === b)!, conc(cb));
    sim.current = { pilha: p, carga: 0, fase: 0 };
    setVista({ pilha: p, carga: 0 });
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    if (!sim.current) sim.current = nova();
    const st = sim.current;
    const corrente = fechado ? Math.max(0, st.pilha.ddp) / (R + 2) : 0;
    if (fechado && st.pilha.ddp > 1e-4) {
      const r = descarregar(st.pilha, R, VOLUME, dt * horasPorS * 3600);
      st.pilha = r.pilha;
      st.carga += r.carga;
    }
    st.fase = (st.fase + dt * Math.min(3, 0.3 + corrente * 5)) % 1;
    acc.current += dt;
    if (acc.current > 0.15) {
      acc.current = 0;
      setVista({ pilha: st.pilha, carga: st.carga });
    }
    const p = st.pilha;
    const bw = Math.min(w * 0.3, 190);
    const bh = h * 0.38;
    const by = h * 0.46;
    const xs = [w * 0.27, w * 0.73];
    const lados = [
      { e: p.anodo, c: p.cAnodo, nome: 'Ânodo (−)', proc: 'oxidação', delta: -massaFaraday(st.carga, p.anodo) },
      { e: p.catodo, c: p.cCatodo, nome: 'Cátodo (+)', proc: 'redução', delta: massaFaraday(st.carga, p.catodo) },
    ];
    // Placas do lado de fora; a ponte salina entra pelo lado de dentro.
    const xPlaca = [xs[0] - bw * 0.2, xs[1] + bw * 0.2];
    lados.forEach((l, i) => {
      const x = xs[i];
      const xp = xPlaca[i];
      // Solução: cor do cátion (Cu²⁺ azul, Ni²⁺ verde) pela concentração.
      const corIon = COR_ION[l.e.key];
      ctx.fillStyle = corIon ? alfa(corIon, Math.min(0.75, 0.08 + 0.6 * Math.sqrt(l.c))) : alfa(c.mat, 0.08);
      ctx.fillRect(x - bw / 2, by + bh * 0.2, bw, bh * 0.8);
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - bw / 2, by); ctx.lineTo(x - bw / 2, by + bh); ctx.lineTo(x + bw / 2, by + bh); ctx.lineTo(x + bw / 2, by); ctx.stroke();
      // Placa de metal (espessura muda com a massa: corrói no ânodo, deposita no cátodo).
      const esp = Math.max(4, 16 + l.delta * 2);
      ctx.fillStyle = l.e.cor;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1;
      ctx.fillRect(xp - esp / 2, by - bh * 0.25, esp, bh * 0.95);
      ctx.strokeRect(xp - esp / 2, by - bh * 0.25, esp, bh * 0.95);
      texto(ctx, l.e.simbolo, xp + (i ? 14 : -14), by - bh * 0.25 + 14, c.fg, { alinhar: i ? 'left' : 'right', peso: 700 });
      texto(ctx, l.nome, x, by + bh + 18, i ? c.danger : c.mat, { alinhar: 'center', peso: 700, tamanho: 12 });
      texto(ctx, `${l.proc} · ${l.e.ion} ${fmt(l.c, l.c < 0.01 ? 4 : 3)} mol/L`, x, by + bh + 34, c.muted, { alinhar: 'center', tamanho: 11 });
    });
    // Ponte salina (U invertido).
    const pTopo = by - bh * 0.12;
    ctx.strokeStyle = alfa(c.muted, 0.9);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xs[0] + bw * 0.22, by + bh * 0.55);
    ctx.lineTo(xs[0] + bw * 0.22, pTopo);
    ctx.lineTo(xs[1] - bw * 0.22, pTopo);
    ctx.lineTo(xs[1] - bw * 0.22, by + bh * 0.55);
    ctx.stroke();
    ctx.lineCap = 'butt';
    texto(ctx, 'ponte salina (KNO₃)', w / 2, pTopo - 12, c.muted, { alinhar: 'center', tamanho: 10 });
    // Fio e voltímetro.
    const yFio = h * 0.12;
    const [xa, xc] = xPlaca;
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xa, by - bh * 0.25); ctx.lineTo(xa, yFio); ctx.lineTo(xc, yFio); ctx.lineTo(xc, by - bh * 0.25); ctx.stroke();
    ctx.fillStyle = c.surface;
    ctx.strokeStyle = c.line;
    ctx.beginPath(); ctx.roundRect(w / 2 - 52, yFio - 20, 104, 40, 8); ctx.fill(); ctx.stroke();
    texto(ctx, `${fmt(p.ddp, 3)} V`, w / 2, yFio + 7, c.fg, { alinhar: 'center', peso: 700, mono: true, tamanho: 17 });
    // Elétrons e íons em movimento.
    if (fechado && corrente > 1e-6) {
      ctx.fillStyle = c.hum;
      const L = (yFio - (by - bh * 0.25)) * -1;
      const caminho = [L, xc - xa, L];
      const total = caminho[0] + caminho[1] + caminho[2];
      for (let d = st.fase * 30; d < total; d += 30) {
        let x = xa;
        let y = by - bh * 0.25;
        if (d < caminho[0]) y -= d;
        else if (d < caminho[0] + caminho[1]) { y = yFio; x = xa + (d - caminho[0]); }
        else { y = yFio + (d - caminho[0] - caminho[1]); x = xc; }
        if (Math.abs(x - w / 2) < 54 && Math.abs(y - yFio) < 22) continue;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      texto(ctx, 'e⁻ →', w / 2 + 72, yFio - 8, c.hum, { peso: 700, tamanho: 12 });
      // Ânions da ponte vão para o ânodo, cátions para o cátodo.
      const comp = xs[1] - xs[0] - bw * 0.44;
      for (let k = 0; k < 4; k++) {
        const f = (st.fase + k / 4) % 1;
        ctx.fillStyle = c.mat;
        ctx.beginPath(); ctx.arc(xs[1] - bw * 0.22 - f * comp, pTopo - 3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.danger;
        ctx.beginPath(); ctx.arc(xs[0] + bw * 0.22 + f * comp, pTopo + 3, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  const p = vista.pilha;
  const corrente = fechado ? Math.max(0, p.ddp) / (R + 2) : 0;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Pilha de ${p.anodo.simbolo} e ${p.catodo.simbolo} com ponte salina e voltímetro`} proporcao={16 / 10} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'ddp agora (Nernst)', valor: `${fmt(p.ddp, 3)} V` },
              { rotulo: 'ddp-padrão (ΔE°)', valor: `${fmt(p.ddpPadrao, 3)} V`, nota: `E°(${p.catodo.simbolo}) − E°(${p.anodo.simbolo})` },
              { rotulo: 'Reação global', valor: p.equacao },
              { rotulo: 'Corrente', valor: `${fmt(corrente * 1000, 1)} mA` },
              { rotulo: 'Carga que passou', valor: `${fmt(vista.carga, 0)} C` },
              { rotulo: `${p.anodo.simbolo} corroído`, valor: `${fmt(massaFaraday(vista.carga, p.anodo), 3)} g` },
              { rotulo: `${p.catodo.simbolo} depositado`, valor: `${fmt(massaFaraday(vista.carga, p.catodo), 3)} g` },
            ]}
          />
        }
        controles={
          <>
            <Seletor rotulo="Eletrodo 1" valor={k1} opcoes={ELETRODOS.map((e) => ({ valor: e.key, rotulo: `${e.simbolo} / ${e.ion} (E° = ${fmt(e.E0, 3)} V)` }))} onChange={(v) => { setK1(v); recomecar(v); }} />
            <Deslizador rotulo={`[${e1.ion}]`} valor={log1} min={-3} max={0} passo={0.05} formatar={(x) => fmt(conc(x), conc(x) < 0.01 ? 4 : 3)} unidade="mol/L" onChange={(v) => { setLog1(v); recomecar(k1, v); }} />
            <Seletor rotulo="Eletrodo 2" valor={k2} opcoes={ELETRODOS.map((e) => ({ valor: e.key, rotulo: `${e.simbolo} / ${e.ion} (E° = ${fmt(e.E0, 3)} V)` }))} onChange={(v) => { setK2(v); recomecar(k1, log1, v); }} />
            <Deslizador rotulo={`[${e2.ion}]`} valor={log2} min={-3} max={0} passo={0.05} formatar={(x) => fmt(conc(x), conc(x) < 0.01 ? 4 : 3)} unidade="mol/L" onChange={(v) => { setLog2(v); recomecar(k1, log1, k2, v); }} />
            <Alternar rotulo="Ligar uma carga (fechar o circuito)" marcado={fechado} onChange={setFechado} />
            {fechado && (
              <>
                <Deslizador rotulo="Resistência da carga" valor={R} min={1} max={500} unidade="Ω" onChange={setR} />
                <Deslizador rotulo="Passagem do tempo" valor={horasPorS} min={0.1} max={24} passo={0.1} formatar={(x) => fmt(x, 1)} unidade="h por segundo" onChange={setHorasPorS} />
              </>
            )}
            <button type="button" className="btn btn-ghost w-full" onClick={() => recomecar()}>
              Pilha nova
            </button>
            <p className="text-xs text-muted">Béqueres de {fmt(VOLUME * 1000, 0)} mL. Com o mesmo metal nos dois lados, vira uma pilha de concentração.</p>
          </>
        }
      />
      <Explicacao enem={'Na pilha, o **ânodo** é o polo negativo, onde ocorre a **oxidação** (a placa corrói); o **cátodo** é o polo positivo, onde ocorre a **redução** (o metal se deposita e a solução perde cor no caso do cobre). Os elétrons andam pelo fio do ânodo para o cátodo, e a ponte salina fecha o circuito com íons. A ddp-padrão é $\\Delta E° = E°_{red}(\\text{cátodo}) - E°_{red}(\\text{ânodo})$.'}>
        {`O metal com **menor potencial de redução** perde elétrons (oxida) e vira o ânodo. Na pilha de Daniell, o zinco ($E° = -0{,}76$ V) entrega elétrons aos íons de cobre ($E° = +0{,}34$ V): $\\Delta E° = 1{,}10$ V.

Fora das condições-padrão (1 mol/L, 25 °C), o potencial segue a **equação de Nernst**:
$$E = E° - \\frac{0{,}0592}{n}\\log Q.$$
Ligue uma carga e acelere o tempo: o $\\mathrm{Cu^{2+}}$ é consumido, o $\\mathrm{Zn^{2+}}$ se acumula, a ddp cai devagar e a pilha "morre" quando chega ao equilíbrio. A massa de metal que corrói e que deposita sai das **leis de Faraday**: $m = \\frac{Q\\,M}{n\\,F}$, com $F = 96\\,485$ C/mol.`}
      </Explicacao>
    </div>
  );
}
