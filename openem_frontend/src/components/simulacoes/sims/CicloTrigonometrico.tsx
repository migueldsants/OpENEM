import { useRef, useState } from 'react';
import { notavelMaisPerto, quadrante, radianosEmPi, reducao } from '../../../lib/simulacoes/matematica';
import { alfa, texto } from '../canvas';
import { alca, num } from '../plano';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, type Ponteiro, type Quadro } from '../ui';

const RAD = Math.PI / 180;

/** Valor de seno, cosseno e tangente como frações com raiz nos ângulos notáveis. */
function exato(v: number): string {
  const tabela: [number, string][] = [
    [0, '0'], [0.5, '1/2'], [Math.SQRT2 / 2, '√2/2'], [Math.sqrt(3) / 2, '√3/2'], [1, '1'], [Math.sqrt(3) / 3, '√3/3'], [Math.sqrt(3), '√3'],
  ];
  const t = tabela.find(([x]) => Math.abs(Math.abs(v) - x) < 1e-6);
  if (!t) return num(v, 3);
  return t[1] === '0' ? '0' : `${v < 0 ? '−' : ''}${t[1]}`;
}

export default function CicloTrigonometrico() {
  const [graus, setGraus] = useState(30);
  const [sen, setSen] = useState(true);
  const [cos, setCos] = useState(true);
  const [tg, setTg] = useState(false);
  const [grudar, setGrudar] = useState(true);
  const arrastando = useRef(false);

  const geo = (w: number, h: number) => {
    const R = Math.min(h * 0.38, w * 0.2);
    return { R, cx: R + 34, cy: h / 2, gx0: 2 * R + 80, gx1: w - 20 };
  };

  const onPonteiro = (e: Ponteiro) => {
    if (e.tipo === 'up') {
      arrastando.current = false;
      return;
    }
    const g = geo(e.w, e.h);
    const naCirc = Math.hypot(e.x - g.cx, e.y - g.cy) < g.R + 40;
    const noGrafico = e.x > g.gx0 - 10;
    if (e.tipo === 'down') arrastando.current = naCirc || noGrafico;
    if (!arrastando.current) return;
    let ang: number;
    if (noGrafico && !naCirc) ang = Math.max(0, Math.min(360, ((e.x - g.gx0) / (g.gx1 - g.gx0)) * 360));
    else ang = ((Math.atan2(g.cy - e.y, e.x - g.cx) / RAD) % 360 + 360) % 360;
    const n = grudar ? notavelMaisPerto(ang, 4) : null;
    setGraus(n ?? Math.round(ang));
  };

  const s = Math.sin(graus * RAD);
  const c = Math.cos(graus * RAD);
  const t = Math.abs(c) < 1e-9 ? null : s / c;

  const quadro: Quadro = (ctx, w, h, _dt, k) => {
    const { R, cx, cy, gx0, gx1 } = geo(w, h);
    // Eixos e círculo.
    ctx.strokeStyle = k.muted;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - R - 20, cy); ctx.lineTo(cx + R + 26, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R - 20); ctx.lineTo(cx, cy + R + 20); ctx.stroke();
    ctx.strokeStyle = alfa(k.fg, 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // Quadrantes.
    ['1º', '2º', '3º', '4º'].forEach((q, i) => {
      const a = (45 + 90 * i) * RAD;
      texto(ctx, q, cx + Math.cos(a) * R * 0.55, cy - Math.sin(a) * R * 0.55 + 4, alfa(k.muted, 0.8), { alinhar: 'center', tamanho: 11 });
    });
    const px = cx + c * R;
    const py = cy - s * R;
    // Arco do ângulo.
    ctx.strokeStyle = k.brand;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, -graus * RAD, true); ctx.stroke();
    ctx.fillStyle = alfa(k.brand, 0.1);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, -graus * RAD, true); ctx.closePath(); ctx.fill();
    // Raio.
    ctx.strokeStyle = k.fg;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    if (cos) {
      ctx.strokeStyle = k.hum;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
      ctx.setLineDash([]);
      texto(ctx, 'cos', (cx + px) / 2, cy + (s >= 0 ? 16 : -8), k.hum, { alinhar: 'center', tamanho: 11, peso: 700 });
    }
    if (sen) {
      ctx.strokeStyle = k.mat;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, py); ctx.stroke();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
      ctx.setLineDash([]);
      texto(ctx, 'sen', cx + (c >= 0 ? -8 : 8), (cy + py) / 2, k.mat, { alinhar: c >= 0 ? 'right' : 'left', tamanho: 11, peso: 700 });
    }
    if (tg && t !== null && Math.abs(t) < 6) {
      // Eixo das tangentes: a reta x = R; o prolongamento do raio corta nela em y = tg.
      ctx.strokeStyle = alfa(k.muted, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + R, cy - R - 20); ctx.lineTo(cx + R, cy + R + 20); ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(k.fg, 0.5);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, cy - t * R); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = k.lin;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx + R, cy); ctx.lineTo(cx + R, cy - t * R); ctx.stroke();
      texto(ctx, 'tg', cx + R + 6, cy - (t * R) / 2, k.lin, { tamanho: 11, peso: 700 });
    }
    alca(ctx, px, py, k.brand, k, arrastando.current);
    texto(ctx, `${graus}° = ${radianosEmPi(graus)}`, cx, cy + R + 36 > h - 4 ? h - 6 : cy + R + 36, k.fg, { alinhar: 'center', tamanho: 13, peso: 700, mono: true });

    // Gráfico de 0 a 360°.
    const gy = (v: number) => cy - v * R;
    const gx = (a: number) => gx0 + ((gx1 - gx0) * a) / 360;
    ctx.strokeStyle = k.muted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx0, cy); ctx.lineTo(gx1, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx0, cy - R - 10); ctx.lineTo(gx0, cy + R + 10); ctx.stroke();
    for (const a of [90, 180, 270, 360]) {
      ctx.strokeStyle = alfa(k.line, 0.8);
      ctx.beginPath(); ctx.moveTo(gx(a), cy - R); ctx.lineTo(gx(a), cy + R); ctx.stroke();
      texto(ctx, radianosEmPi(a), gx(a), cy + R + 16, k.muted, { alinhar: 'center', tamanho: 10, mono: true });
    }
    texto(ctx, '1', gx0 - 6, gy(1) + 4, k.muted, { alinhar: 'right', tamanho: 10, mono: true });
    texto(ctx, '−1', gx0 - 6, gy(-1) + 4, k.muted, { alinhar: 'right', tamanho: 10, mono: true });
    const tracar = (f: (a: number) => number, cor: string, ate: number, larg: number) => {
      ctx.strokeStyle = cor;
      ctx.lineWidth = larg;
      ctx.beginPath();
      for (let a = 0; a <= ate; a += 2) {
        const y = gy(f(a * RAD));
        if (a === 0) ctx.moveTo(gx(a), y);
        else ctx.lineTo(gx(a), y);
      }
      ctx.stroke();
    };
    if (sen) {
      tracar(Math.sin, alfa(k.mat, 0.25), 360, 1.5);
      tracar(Math.sin, k.mat, graus, 2.5);
      ctx.fillStyle = k.mat;
      ctx.beginPath(); ctx.arc(gx(graus), gy(s), 4.5, 0, Math.PI * 2); ctx.fill();
      // A ponte: a altura do ponto no círculo é a altura do ponto no gráfico.
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = alfa(k.mat, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(gx(graus), gy(s)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (cos) {
      tracar(Math.cos, alfa(k.hum, 0.25), 360, 1.5);
      tracar(Math.cos, k.hum, graus, 2.5);
      ctx.fillStyle = k.hum;
      ctx.beginPath(); ctx.arc(gx(graus), gy(c), 4.5, 0, Math.PI * 2); ctx.fill();
    }
  };

  const q = quadrante(graus);
  const sinalTxt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v > 0 ? '+' : '−');

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Ciclo trigonométrico em ${graus} graus`} proporcao={16 / 8} onPonteiro={onPonteiro} alturaMin={260} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Ângulo', valor: `${graus}° = ${radianosEmPi(graus)}` },
              { rotulo: 'Quadrante', valor: q ? `${q}º` : 'sobre um eixo' },
              { rotulo: 'sen', valor: exato(s), cor: 'var(--mat)' },
              { rotulo: 'cos', valor: exato(c), cor: 'var(--hum)' },
              { rotulo: 'tg', valor: t === null ? 'não existe' : exato(t), cor: 'var(--lin)' },
              { rotulo: 'Sinais (sen, cos)', valor: `${sinalTxt(s)} , ${sinalTxt(c)}` },
              { rotulo: 'No 1º quadrante', valor: `${reducao(graus)}°`, nota: 'redução ao primeiro quadrante' },
              { rotulo: 'sen² + cos²', valor: num(s * s + c * c, 4) },
            ]}
          />
        }
        controles={
          <>
            <p className="text-xs text-muted text-pretty">Arraste o ponto no círculo (ou passe pelo gráfico) para mudar o ângulo.</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 330].map((a) => (
                <button key={a} type="button" className="chip justify-center font-data" data-active={graus === a} onClick={() => setGraus(a)}>
                  {a}°
                </button>
              ))}
            </div>
            <Alternar rotulo="Seno" marcado={sen} onChange={setSen} />
            <Alternar rotulo="Cosseno" marcado={cos} onChange={setCos} />
            <Alternar rotulo="Tangente" marcado={tg} onChange={setTg} dica="Não existe em 90° e 270°: o raio fica paralelo ao eixo das tangentes." />
            <Alternar rotulo="Grudar nos ângulos notáveis" marcado={grudar} onChange={setGrudar} />
          </>
        }
      />
      <Explicacao
        enem={'As questões usam a **tabela dos notáveis** (30°, 45°, 60°), os **sinais por quadrante** e fenômenos periódicos modelados por seno e cosseno (maré, temperatura ao longo do dia, roda-gigante): o máximo é a linha do meio mais a amplitude, e o período é o tempo de uma volta.'}
      >
        {`No **ciclo trigonométrico** o raio vale 1 e o ângulo começa no eixo $x$, girando no sentido anti-horário. Para o ponto $P$ no círculo, o **cosseno** é a coordenada $x$ e o **seno** é a coordenada $y$. Daí vem a relação fundamental $\\sin^2\\theta + \\cos^2\\theta = 1$ (o teorema de Pitágoras no triângulo do raio).

A **tangente** é $\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}$: o ponto onde o prolongamento do raio corta a reta vertical $x = 1$.

Os sinais seguem as coordenadas: no 1º quadrante tudo é positivo; no 2º só o seno; no 3º só a tangente; no 4º só o cosseno. Um ângulo de outro quadrante tem os mesmos valores, a menos do sinal, que o seu **correspondente** no 1º quadrante (150° e 30° têm o mesmo seno).

O gráfico ao lado desenrola o círculo: a altura do ponto vira a curva do seno, que se repete a cada $2\\pi$.`}
      </Explicacao>
    </div>
  );
}
