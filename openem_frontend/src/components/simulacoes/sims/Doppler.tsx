import { useEffect, useRef, useState } from 'react';
import { anguloMach, comprimentosDoppler, frequenciaDoppler, velocidadeSom } from '../../../lib/simulacoes/optica-ondas';
import { bissecao, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido } from '../canvas';
import { Alternar, BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const LARGURA_M = 500; // metros visíveis
const LENTO = 0.15; // o tempo da cena corre a 15% do real (o som é rápido demais para ver)
const EMISSAO = 0.06; // s entre frentes desenhadas (não é o período real da sirene)
const OBS: [number, number] = [300, 35]; // observador (m): à frente, um pouco fora da pista

export default function Doppler() {
  const [vs, setVs] = useState(100);
  const [f0, setF0] = useState(700);
  const [temp, setTemp] = useState(20);
  const [som, setSom] = useState(false);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const v = velocidadeSom(temp);
  const sim = useRef({ t: 0, frentes: [] as { te: number; x: number }[], ultima: -1, acc: 0 });
  const [ouvida, setOuvida] = useState<number | null>(null);
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  // A fonte começa já dentro da tela; parada (ou quase), fica a meio caminho.
  const devagar = vs < 15;
  const x0 = devagar ? 150 : 30;
  const xFonte = (t: number) => x0 + vs * t;
  const duracao = devagar ? 2.5 : (LARGURA_M + 60 - x0) / vs;

  // Frequência que chega ao observador agora: acha o instante de emissão (tempo retardado).
  const frequenciaNoObservador = (t: number) => {
    const dist = (te: number) => Math.hypot(OBS[0] - xFonte(te), OBS[1]);
    const g = (te: number) => dist(te) - v * (t - te);
    if (vs >= v) return null;
    if (g(0) > 0) return null; // o primeiro som ainda não chegou
    const te = bissecao(g, 0, t, 1e-6);
    const dx = OBS[0] - xFonte(te);
    const cos = dx / dist(te);
    return frequenciaDoppler(f0, v, 0, vs * cos);
  };

  useEffect(() => {
    if (!som) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    audio.current = { ctx, osc, gain };
    return () => {
      osc.stop();
      ctx.close();
      audio.current = null;
    };
  }, [som]);

  const reiniciar = () => {
    sim.current = { t: 0, frentes: [], ultima: -1, acc: 0 };
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    if (rodando) {
      st.t += dt * LENTO;
      if (st.t > duracao) reiniciar();
      while (st.ultima + EMISSAO <= st.t) {
        st.ultima += EMISSAO;
        if (st.ultima >= 0) st.frentes.push({ te: st.ultima, x: xFonte(st.ultima) });
      }
      st.frentes = st.frentes.filter((fr) => v * (st.t - fr.te) < LARGURA_M * 1.6);
    }
    const t = st.t;
    const esc = w / LARGURA_M;
    const yPista = h * 0.48;
    const X = (x: number) => x * esc;
    const Y = (y: number) => yPista + y * esc;
    // Pista com a faixa do meio tracejada.
    ctx.fillStyle = alfa(c.muted, 0.14);
    ctx.fillRect(0, yPista - 17, w, 34);
    ctx.strokeStyle = alfa(c.muted, 0.45);
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(0, yPista); ctx.lineTo(w, yPista); ctx.stroke();
    ctx.setLineDash([]);
    // Frentes de onda: as mais novas mais fortes.
    ctx.lineWidth = 2;
    for (const fr of st.frentes) {
      const r = v * (t - fr.te) * esc;
      const idade = (t - fr.te) / (LARGURA_M / v);
      ctx.strokeStyle = alfa(c.brand, Math.max(0.07, 0.9 - idade * 0.85));
      ctx.beginPath(); ctx.arc(X(fr.x), yPista, r, 0, Math.PI * 2); ctx.stroke();
    }
    // λ à frente e atrás, entre duas frentes vizinhas já longe da ambulância: o que o ENEM pergunta.
    const longe = st.frentes.findLastIndex((fr) => v * (t - fr.te) * esc > 70);
    const ult = longe >= 1 ? st.frentes[longe] : undefined;
    const pen = longe >= 1 ? st.frentes[longe - 1] : undefined;
    if (ult && pen && vs < v && vs > 3) {
      const r1 = v * (t - ult.te) * esc;
      const r2 = v * (t - pen.te) * esc;
      const cota = (xa: number, xb: number, rot: string) => {
        const y = yPista + 30;
        if (Math.abs(xb - xa) < 6 || Math.min(xa, xb) < 10 || Math.max(xa, xb) > w - 10) return;
        ctx.strokeStyle = c.fg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xa, y - 5); ctx.lineTo(xa, y + 5); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.moveTo(xb, y - 5); ctx.lineTo(xb, y + 5);
        ctx.stroke();
        texto(ctx, rot, (xa + xb) / 2, y + 18, c.fg, { alinhar: 'center', tamanho: 11, peso: 700 });
      };
      cota(X(pen.x) + r2, X(ult.x) + r1, 'λ menor');
      cota(X(ult.x) - r1, X(pen.x) - r2, 'λ maior');
    }
    // Cone de Mach.
    const am = anguloMach(v, vs);
    if (am !== null) {
      const xs = X(xFonte(t));
      const tg = Math.tan((am * Math.PI) / 180);
      ctx.strokeStyle = c.danger;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xs - h / tg, yPista - h); ctx.lineTo(xs, yPista); ctx.lineTo(xs - h / tg, yPista + h);
      ctx.stroke();
    }
    // Ambulância: carroceria, cabine, rodas e a sirene piscando com brilho.
    const xs = X(xFonte(t));
    const pisca = Math.floor(t / 0.02) % 2 === 0;
    ctx.fillStyle = c.fg;
    ctx.beginPath(); ctx.roundRect(xs - 26, yPista - 12, 40, 22, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(xs + 12, yPista - 6, 14, 16, [2, 6, 3, 2]); ctx.fill();
    ctx.fillStyle = c.danger;
    ctx.fillRect(xs - 26, yPista - 1, 40, 4);
    ctx.fillStyle = c.surface2;
    ctx.fillRect(xs + 16, yPista - 3, 7, 6);
    for (const dx of [-17, 15]) {
      ctx.fillStyle = c.bg;
      ctx.beginPath(); ctx.arc(xs + dx, yPista + 11, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.fg; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const luz = pisca ? c.danger : c.mat;
    const brilho = ctx.createRadialGradient(xs - 6, yPista - 15, 0, xs - 6, yPista - 15, 18);
    brilho.addColorStop(0, alfa(luz, 0.55));
    brilho.addColorStop(1, alfa(luz, 0));
    ctx.fillStyle = brilho;
    ctx.beginPath(); ctx.arc(xs - 6, yPista - 15, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = luz;
    ctx.fillRect(xs - 11, yPista - 17, 10, 5);
    // Observador, com o que ele ouve num balão.
    const ox = X(OBS[0]);
    const oy = Y(OBS[1]) + 6;
    ctx.fillStyle = c.nat;
    ctx.beginPath(); ctx.arc(ox, oy - 15, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(ox - 7, oy - 6, 14, 20, 5); ctx.fill();
    const foAgora = frequenciaNoObservador(t);
    const balao = foAgora ? `ouve ${fmt(foAgora, 0)} Hz` : vs >= v ? 'silêncio até o estrondo' : 'ainda não ouve';
    ctx.font = '600 12px JetBrains Mono Variable, monospace';
    const bw = ctx.measureText(balao).width + 18;
    ctx.fillStyle = c.surface;
    ctx.strokeStyle = alfa(c.nat, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(ox - bw / 2, oy + 22, bw, 24, 8); ctx.fill(); ctx.stroke();
    texto(ctx, balao, ox, oy + 38, c.fg, { alinhar: 'center', tamanho: 12, peso: 600, mono: true });
    // Escala.
    ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, h - 16); ctx.lineTo(12 + 100 * esc, h - 16); ctx.stroke();
    texto(ctx, '100 m', 12, h - 22, c.muted, { tamanho: 10 });
    texto(ctx, `câmera lenta: ${fmt(LENTO * 100, 0)}% da velocidade real`, w - 12, h - 12, c.muted, { alinhar: 'right', tamanho: 11 });

    // Frequência ouvida (e som, se ligado).
    const fo = foAgora;
    st.acc += dt;
    if (st.acc > 0.1) {
      st.acc = 0;
      setOuvida(fo);
    }
    const a = audio.current;
    if (a) {
      const agora = a.ctx.currentTime;
      if (fo && rodando) {
        a.osc.frequency.setTargetAtTime(fo, agora, 0.02);
        const d = Math.hypot(OBS[0] - xFonte(t), OBS[1]);
        a.gain.gain.setTargetAtTime(Math.min(0.12, 6 / d), agora, 0.05);
      } else {
        a.gain.gain.setTargetAtTime(0, agora, 0.05);
      }
    }
  };

  const lam = comprimentosDoppler(f0, v, Math.min(vs, v * 0.999));
  const am = anguloMach(v, vs);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Fonte sonora em movimento emitindo frentes de onda" proporcao={16 / 9} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Velocidade do som', valor: `${fmt(v, 1)} m/s`, nota: `a ${temp} °C` },
              { rotulo: 'Número de Mach', valor: fmt(vs / v, 2) },
              { rotulo: 'Ouvida na aproximação', valor: vs < v ? `${fmt(frequenciaDoppler(f0, v, 0, vs), 0)} Hz` : 'estrondo', cor: 'var(--danger)' },
              { rotulo: 'Ouvida no afastamento', valor: `${fmt(frequenciaDoppler(f0, v, 0, -vs), 0)} Hz`, cor: 'var(--mat)' },
              { rotulo: 'Ouvida agora por você', valor: ouvida ? `${fmt(ouvida, 0)} Hz` : vs >= v ? 'só o estrondo' : 'ainda em silêncio' },
              { rotulo: 'λ à frente / atrás', valor: vs < v ? `${fmt(lam.frente, 3)} / ${fmt(lam.tras, 3)} m` : '—', nota: `parada: ${fmt(lam.parado, 3)} m` },
              ...(am !== null ? [{ rotulo: 'Ângulo do cone de Mach', valor: `${fmt(am, 1)}°`, nota: 'sen α = v/vs' }] : []),
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={reiniciar} />
            <Deslizador rotulo="Velocidade da fonte" valor={vs} min={0} max={600} unidade="m/s" formatar={(x) => `${fmt(x, 0)} (${fmt(x * 3.6, 0)} km/h)`} onChange={(x) => { setVs(x); reiniciar(); }} />
            <Deslizador rotulo="Frequência da sirene" valor={f0} min={200} max={1200} passo={10} unidade="Hz" onChange={setF0} />
            <Deslizador rotulo="Temperatura do ar" valor={temp} min={-20} max={45} unidade="°C" onChange={setTemp} />
            <Alternar rotulo="Ouvir o que você escuta" marcado={som} onChange={setSom} dica="Toca a frequência que chega ao observador. Abaixe o volume antes." />
          </>
        }
      />
      <Explicacao enem={'O som da ambulância fica mais **agudo** quando ela se aproxima e mais **grave** quando se afasta; a frequência emitida não muda. O mesmo efeito com a luz é o **desvio para o vermelho** das galáxias que se afastam, e com ondas de rádio é o radar de velocidade.'}>
        {`A sirene emite sempre a mesma frequência, mas cada frente de onda sai de um ponto mais adiante. À frente da fonte as frentes se apertam (comprimento de onda menor, frequência maior); atrás, se afastam. Com o observador parado:
$$f' = f\\,\\frac{v}{v - v_f},$$
com $v_f$ positivo na aproximação. A frequência que você ouve muda no instante em que a frente de onda chega até você, não quando a ambulância passa: a simulação calcula esse atraso.

Acima da velocidade do som ($v_f > v$) a fonte ultrapassa as próprias ondas, que se acumulam num **cone de Mach** de abertura $\\sin\\alpha = v/v_f$: o estrondo sônico dos aviões supersônicos. A velocidade do som no ar cresce com a temperatura, cerca de 0,6 m/s por grau.`}
      </Explicacao>
    </div>
  );
}
