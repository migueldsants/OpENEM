import { useMemo, useRef, useState } from 'react';
import { ANALITOS, corIndicador, curvaTitulacao, INDICADORES, pH, volumeEquivalencia } from '../../../lib/simulacoes/quimica';
import { fmt, fmtCientifico } from '../../../lib/simulacoes/numerico';
import { alfa, texto } from '../canvas';
import { Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, Seletor, type Quadro } from '../ui';

const GOTA = 0.05; // mL
/** Tempo de resposta do eletrodo do pHmetro e da mistura no erlenmeyer (s). */
const RESPOSTA = 0.35;

export default function Titulacao() {
  const [anKey, setAnKey] = useState('acetico');
  const [Ca, setCa] = useState(0.1);
  const [Va, setVa] = useState(25);
  const [Ct, setCt] = useState(0.1);
  const [indKey, setIndKey] = useState('fenolftaleina');
  const [gotejando, setGotejando] = useState(false);
  const [gotasPorS, setGotasPorS] = useState(3);
  const [V, setV] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Gotas a caminho: cada uma só entra no cálculo quando cai no líquido. */
  const gotas = useRef<{ y: number; dv: number }[]>([]);
  /** Volume que já caiu no erlenmeyer. */
  const vRef = useRef(0);
  /** Volume que já saiu da bureta (caiu ou está caindo). */
  const saiuRef = useRef(0);
  /** pH que o pHmetro mostra e pH da cor: seguem o real com o atraso da mistura. */
  const mostrado = useRef<number | null>(null);
  const acc = useRef(0);

  const analito = ANALITOS.find((a) => a.key === anKey)!;
  const ind = INDICADORES.find((i) => i.key === indKey)!;
  const t = useMemo(() => ({ analito, Ca, Va, Ct }), [analito, Ca, Va, Ct]);
  const Veq = volumeEquivalencia(t);
  const Vmax = Math.min(100, Math.max(10, 2 * Veq));
  const curva = useMemo(() => curvaTitulacao(t, Vmax, 300).map((p) => [p.v, p.pH] as [number, number]), [t, Vmax]);
  const phAgora = pH(t, V);
  const titulante = analito.tipo === 'acido' ? 'NaOH' : 'HCl';

  /** Solta `n` gotas da bureta, uma atrás da outra. */
  const soltar = (n: number) => {
    for (let i = 0; i < n && saiuRef.current + GOTA <= Vmax + 1e-9; i++) {
      saiuRef.current += GOTA;
      gotas.current.push({ y: -i * 14, dv: GOTA });
    }
  };
  const reiniciar = () => {
    vRef.current = 0;
    saiuRef.current = 0;
    mostrado.current = null;
    setV(0);
    setGotejando(false);
    setAviso(null);
    gotas.current = [];
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    // Torneira aberta: pinga gota a gota, no ritmo escolhido.
    if (gotejando) {
      acc.current += dt;
      if (acc.current >= 1 / gotasPorS) {
        acc.current = 0;
        if (saiuRef.current + GOTA <= Vmax + 1e-9) soltar(1);
        else setGotejando(false);
      }
    }
    // Com espaço, a vidraria vai para a direita e a curva de pH se desenha ao lado, gota a gota.
    const comCurva = w >= 560;
    const cx = comCurva ? w * 0.66 : w * 0.42;
    // Bureta.
    const bTopo = h * 0.04;
    const bAlt = h * 0.46;
    const bLarg = 22;
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - bLarg / 2, bTopo, bLarg, bAlt);
    // A bureta tem 50 mL; volumes maiores contam como reabastecida.
    const usado = saiuRef.current % 50;
    const restante = saiuRef.current > 0 && usado === 0 ? 0 : 50 - usado;
    ctx.fillStyle = alfa(c.mat, 0.25);
    const nivel = (restante / 50) * bAlt;
    ctx.fillRect(cx - bLarg / 2 + 1.5, bTopo + bAlt - nivel, bLarg - 3, nivel);
    for (let ml = 0; ml <= 50; ml += 5) {
      const y = bTopo + (ml / 50) * bAlt;
      ctx.beginPath(); ctx.moveTo(cx + bLarg / 2, y); ctx.lineTo(cx + bLarg / 2 + (ml % 10 ? 4 : 8), y); ctx.stroke();
      if (ml % 10 === 0) texto(ctx, String(ml), cx + bLarg / 2 + 11, y + 3, c.muted, { tamanho: 9 });
    }
    texto(ctx, `${titulante} ${fmt(Ct, 2)} mol/L`, cx - bLarg / 2 - 8, bTopo + 14, c.fg, { alinhar: 'right', tamanho: 11, peso: 600 });
    // Ponta e torneira.
    ctx.beginPath(); ctx.moveTo(cx - 4, bTopo + bAlt); ctx.lineTo(cx - 1.5, bTopo + bAlt + 26); ctx.lineTo(cx + 1.5, bTopo + bAlt + 26); ctx.lineTo(cx + 4, bTopo + bAlt); ctx.stroke();
    ctx.fillStyle = gotejando ? c.nat : c.muted;
    ctx.fillRect(cx - 12, bTopo + bAlt + 8, 24, 6);
    // Erlenmeyer.
    const eBase = h * 0.94;
    const eTopo = h * 0.6;
    const eLarg = Math.min(w * 0.36, 170);
    const gargalo = 26;
    const forma = () => {
      ctx.beginPath();
      ctx.moveTo(cx - gargalo / 2, eTopo);
      ctx.lineTo(cx - gargalo / 2, eTopo + 24);
      ctx.lineTo(cx - eLarg / 2, eBase);
      ctx.lineTo(cx + eLarg / 2, eBase);
      ctx.lineTo(cx + gargalo / 2, eTopo + 24);
      ctx.lineTo(cx + gargalo / 2, eTopo);
    };
    // Líquido (altura cresce com o volume total).
    const volTotal = Va + vRef.current;
    const frac = Math.min(0.85, 0.3 + volTotal / 250);
    const yLiq = eBase - frac * (eBase - eTopo - 24);
    ctx.save();
    forma();
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = alfa(c.mat, 0.08);
    ctx.fillRect(0, yLiq, w, h);
    // A gota precisa se misturar: a cor e o pHmetro seguem o pH real com um pequeno atraso.
    const real = pH(t, vRef.current);
    mostrado.current = mostrado.current === null ? real : mostrado.current + (real - mostrado.current) * Math.min(1, dt / RESPOSTA);
    ctx.fillStyle = corIndicador(ind, mostrado.current);
    ctx.fillRect(0, yLiq, w, h);
    ctx.restore();
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 2;
    forma();
    ctx.stroke();
    // Gotas caindo.
    ctx.fillStyle = alfa(c.mat, 0.7);
    let caiu = 0;
    gotas.current = gotas.current.filter((g) => {
      g.y += dt * 300;
      const y = bTopo + bAlt + 28 + g.y;
      if (y > yLiq) {
        caiu += g.dv;
        return false;
      }
      if (g.y >= 0) {
        ctx.beginPath(); ctx.ellipse(cx, y, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      return true;
    });
    if (caiu > 0) {
      const antes = pH(t, vRef.current);
      vRef.current = Math.min(Vmax, vRef.current + caiu);
      const depois = pH(t, vRef.current);
      setV(vRef.current);
      // Uma gota que move o pH mais de 1 unidade é o salto da equivalência: avisa o porquê.
      if (Math.abs(depois - antes) > 1) {
        setAviso(`Uma gota levou o pH de ${fmt(antes, 1)} para ${fmt(depois, 1)}: perto da equivalência quase não sobra ${analito.tipo === 'acido' ? 'ácido' : 'base'} para segurar o pH, e cada gota pesa muito.`);
      }
    }
    if (comCurva) {
      const gx0 = 54;
      const gx1 = w * 0.44;
      const gy0 = h * 0.14;
      const gy1 = h * 0.8;
      const GX = (v: number) => gx0 + (v / Vmax) * (gx1 - gx0);
      const GY = (ph: number) => gy1 - (ph / 14) * (gy1 - gy0);
      texto(ctx, 'Curva de titulação: pH a cada gota', gx0, gy0 - 16, c.fg, { tamanho: 12, peso: 700 });
      // Faixa de viragem do indicador, na cor que ele assume de cada lado.
      ctx.fillStyle = alfa(c.muted, 0.12);
      ctx.fillRect(gx0, GY(ind.faixa[1]), gx1 - gx0, GY(ind.faixa[0]) - GY(ind.faixa[1]));
      texto(ctx, 'viragem do indicador', gx1 - 6, GY(ind.faixa[1]) + 13, c.muted, { alinhar: 'right', tamanho: 10 });
      ctx.strokeStyle = alfa(c.muted, 0.3);
      ctx.lineWidth = 1;
      for (let ph = 0; ph <= 14; ph += 2) {
        ctx.beginPath(); ctx.moveTo(gx0, GY(ph)); ctx.lineTo(gx1, GY(ph)); ctx.stroke();
        texto(ctx, String(ph), gx0 - 8, GY(ph) + 4, c.muted, { alinhar: 'right', tamanho: 10, mono: true });
      }
      texto(ctx, `0`, gx0, gy1 + 16, c.muted, { alinhar: 'center', tamanho: 10, mono: true });
      texto(ctx, `${fmt(Vmax, 0)} mL de ${titulante}`, gx1, gy1 + 16, c.muted, { alinhar: 'right', tamanho: 10, mono: true });
      // O caminho inteiro, apagado, e o trecho já percorrido por cima.
      const traco = (ate: number, cor: string, larg: number) => {
        ctx.strokeStyle = cor;
        ctx.lineWidth = larg;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let k = 0;
        for (const [v, ph] of curva) {
          if (v > ate) break;
          if (k++) ctx.lineTo(GX(v), GY(ph)); else ctx.moveTo(GX(v), GY(ph));
        }
        ctx.stroke();
      };
      traco(Vmax, alfa(c.muted, 0.35), 1.5);
      traco(vRef.current, c.brand, 2.6);
      // Volume de equivalência e o ponto de agora.
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(c.fg, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(GX(Veq), gy0); ctx.lineTo(GX(Veq), gy1); ctx.stroke();
      ctx.setLineDash([]);
      texto(ctx, 'equivalência', GX(Veq) + 5, gy0 + 12, c.fg, { tamanho: 10, peso: 600 });
      const pxA = GX(vRef.current);
      const pyA = GY(real);
      ctx.fillStyle = alfa(c.brand, 0.25);
      ctx.beginPath(); ctx.arc(pxA, pyA, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.brand;
      ctx.beginPath(); ctx.arc(pxA, pyA, 5, 0, Math.PI * 2); ctx.fill();
    }
    // pHmetro.
    const mx = comCurva ? Math.min(w - 146, cx + Math.min(w * 0.36, 170) / 2 + 14) : w * 0.72;
    const my = h * 0.62;
    ctx.fillStyle = c.surface;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(mx, my, Math.min(w * 0.24, 130), 64, 10); ctx.fill(); ctx.stroke();
    texto(ctx, 'pH', mx + 12, my + 22, c.muted, { tamanho: 11, peso: 600 });
    texto(ctx, fmt(mostrado.current, 2), mx + 12, my + 52, c.fg, { tamanho: 26, peso: 700, mono: true });
    texto(ctx, `${analito.nome.split(',')[0]} · ${fmt(Va, 0)} mL`, cx, eBase + 14 > h ? h - 2 : eBase + 14, c.muted, { alinhar: 'center', tamanho: 10 });
  };

  const regiao =
    Math.abs(V - Veq) < Math.max(0.05, Veq * 0.01)
      ? 'ponto de equivalência'
      : V < Veq
        ? V > 0 && analito.Ka < 1 && analito.Ka > 1e-14
          ? 'solução-tampão (ácido/base fraca + sal)'
          : 'excesso do analito'
        : `excesso de ${titulante}`;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Bureta gotejando titulante num erlenmeyer com indicador" proporcao={4 / 3} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'pH', valor: fmt(phAgora, 2) },
              { rotulo: `${titulante} adicionado`, valor: `${fmt(V, 2)} mL` },
              { rotulo: 'Volume de equivalência', valor: `${fmt(Veq, 2)} mL`, nota: 'Ca·Va = Ct·Vt' },
              { rotulo: '[H⁺]', valor: `${fmtCientifico(10 ** -phAgora)} mol/L` },
              { rotulo: 'pH na equivalência', valor: fmt(pH(t, Veq), 2) },
              { rotulo: 'Situação', valor: regiao },
            ]}
          />
        }
        extra={
          <Bloco titulo="Curva de titulação">
            <Grafico
              series={[{ rotulo: 'pH', cor: 'var(--brand)', pontos: curva }]}
              rotuloX={`volume de ${titulante} (mL)`}
              rotuloY="pH"
              xMin={0}
              xMax={Vmax}
              yMin={0}
              yMax={14}
              verticais={[{ x: Veq, rotulo: 'equivalência' }]}
              horizontais={[{ y: ind.faixa[0], cor: 'var(--hum)' }, { y: ind.faixa[1], rotulo: `viragem: ${ind.nome}`, cor: 'var(--hum)' }]}
              pontos={[{ x: V, y: phAgora, cor: 'var(--fg)' }]}
              altura={220}
            />
          </Bloco>
        }
        controles={
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => soltar(1)}>
                +1 gota
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => soltar(Math.round(1 / GOTA))}>
                +1 mL
              </button>
              <button type="button" className={`btn ${gotejando ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setGotejando((g) => !g)}>
                {gotejando ? 'Fechar torneira' : 'Abrir torneira'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={reiniciar}>
                Recomeçar
              </button>
            </div>
            <Deslizador
              rotulo="Ritmo da torneira"
              valor={gotasPorS}
              min={1}
              max={10}
              unidade="gotas/s"
              onChange={setGotasPorS}
              dica={`Cada gota tem ${fmt(GOTA, 2)} mL. Perto da equivalência, pingue devagar.`}
            />
            {aviso && (
              <p role="status" className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-pretty">
                {aviso}
              </p>
            )}
            <Seletor rotulo="No erlenmeyer" valor={anKey} opcoes={ANALITOS.map((a) => ({ valor: a.key, rotulo: a.nome }))} onChange={(v) => { setAnKey(v); reiniciar(); }} />
            <Deslizador rotulo="Concentração do analito" valor={Ca} min={0.01} max={1} passo={0.01} unidade="mol/L" onChange={(v) => { setCa(v); reiniciar(); }} />
            <Deslizador rotulo="Volume do analito" valor={Va} min={10} max={50} unidade="mL" onChange={(v) => { setVa(v); reiniciar(); }} />
            <Deslizador rotulo={`Concentração do ${titulante}`} valor={Ct} min={0.01} max={1} passo={0.01} unidade="mol/L" onChange={(v) => { setCt(v); reiniciar(); }} />
            <Seletor rotulo="Indicador" valor={indKey} opcoes={INDICADORES.map((i) => ({ valor: i.key, rotulo: `${i.nome} (${fmt(i.faixa[0], 1)} a ${fmt(i.faixa[1], 1)})` }))} onChange={setIndKey} />
          </>
        }
      />
      <Explicacao enem={'O **ponto de viragem** do indicador precisa cair no salto de pH da equivalência. Ácido forte com base forte: equivalência em pH 7. Ácido fraco com base forte: a equivalência é **básica** (o ânion do ácido fraco hidrolisa), e a fenolftaleína é a escolha certa. Base fraca com ácido forte: equivalência **ácida**, use alaranjado de metila.'}>
        {`A titulação descobre a concentração de uma solução reagindo-a com outra de concentração conhecida. Na equivalência, a quantidade de matéria de base adicionada é igual à de ácido: $C_a V_a = C_t V_t$.

O pH de cada ponto é calculado sem atalhos, resolvendo o balanço de cargas da solução (para o ácido: $[H^+] + [Na^+] = [OH^-] + [A^-]$) junto com $K_w = 10^{-14}$ e o $K_a$. Por isso a curva vale em todo o percurso, inclusive na equivalência.

Com ácido fraco, antes da equivalência forma-se uma **solução-tampão** (ácido + sal): o pH quase não muda, e na **meia equivalência** $pH = pK_a$. O indicador é um ácido fraco cujas formas ácida e básica têm cores diferentes; a cor muda quando o pH atravessa a faixa de viragem.`}
      </Explicacao>
    </div>
  );
}
