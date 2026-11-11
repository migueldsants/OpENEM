import { useRef, useState } from 'react';
import {
  comprimentoTransicao,
  corComprimento,
  energiaFoton,
  energiaNivel,
  faixaEspectro,
  raioNivel,
  serieEspectral,
} from '../../../lib/simulacoes/quimica';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto } from '../canvas';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const N_MAX = 6;
const VIDA = 0.9; // s até o elétron excitado cair (desacelerado para ver)

interface Transicao {
  de: number;
  para: number;
  nm: number;
}

const rgb = (nm: number) => {
  const [r, g, b] = corComprimento(nm);
  return r + g + b === 0 ? null : `rgb(${r}, ${g}, ${b})`;
};

export default function Hidrogenio() {
  const [lampada, setLampada] = useState(false);
  const sim = useRef({
    n: 1,
    desde: 0,
    t: 0,
    fotons: [] as { nm: number; idade: number; ang: number }[],
    linhas: new Map<string, number>(),
    rng: criarRng(11),
    // Os últimos saltos, para a seta no diagrama de níveis: subida (absorção, sem fóton) e descida (emissão).
    saltos: [] as { de: number; para: number; nm: number | null; t: number }[],
  });
  const [ultima, setUltima] = useState<Transicao | null>(null);
  const [nAtual, setNAtual] = useState(1);
  const acc = useRef(0);

  const excitar = (n: number) => {
    if (n !== sim.current.n) sim.current.saltos.push({ de: sim.current.n, para: n, nm: null, t: sim.current.t });
    sim.current.n = n;
    sim.current.desde = sim.current.t;
    setNAtual(n);
  };
  const limpar = () => {
    sim.current.linhas = new Map();
    setUltima(null);
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const st = sim.current;
    st.t += dt;
    // Emissão espontânea: o elétron cai para um nível mais baixo qualquer.
    if (st.n > 1 && st.t - st.desde > VIDA) {
      const para = 1 + Math.floor(st.rng() * (st.n - 1));
      const nm = comprimentoTransicao(st.n, para);
      st.fotons.push({ nm, idade: 0, ang: st.rng() * Math.PI * 2 });
      const chave = `${st.n}-${para}`;
      st.linhas.set(chave, (st.linhas.get(chave) ?? 0) + 1);
      st.saltos.push({ de: st.n, para, nm, t: st.t });
      setUltima({ de: st.n, para, nm });
      st.n = para;
      st.desde = st.t;
      setNAtual(para);
    }
    if (lampada && st.n === 1) {
      acc.current += dt;
      if (acc.current > 0.35) {
        acc.current = 0;
        excitar(2 + Math.floor(st.rng() * (N_MAX - 1)));
      }
    }
    st.saltos = st.saltos.filter((sa) => st.t - sa.t < 1.6);
    // Átomo de Bohr (raios ∝ n², comprimidos para caber).
    const sy = h * 0.78; // topo do espectro
    const ax = w * 0.28;
    const ay = sy * 0.5;
    const Rmax = Math.min(w * 0.25, sy * 0.44);
    const raio = (n: number) => Math.sqrt(raioNivel(n) / raioNivel(N_MAX)) * Rmax;
    for (let n = 1; n <= N_MAX; n++) {
      const atual = n === st.n;
      ctx.strokeStyle = atual ? c.brand : alfa(c.muted, 0.38);
      ctx.lineWidth = atual ? 2.2 : 1;
      ctx.beginPath(); ctx.arc(ax, ay, raio(n), 0, Math.PI * 2); ctx.stroke();
      // Rótulos numa diagonal, para não se amontoarem.
      const a = -Math.PI / 4;
      texto(ctx, `${n}`, ax + Math.cos(a) * raio(n) + 4, ay + Math.sin(a) * raio(n) - 2, atual ? c.brand : c.muted, { tamanho: 10, peso: 700, mono: true });
    }
    // Núcleo (um próton) e o elétron com brilho, mais lento nas órbitas altas (v ∝ 1/n).
    const brilho = (x: number, y: number, r: number, cor: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, alfa(cor, 0.55));
      g.addColorStop(1, alfa(cor, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    brilho(ax, ay, 16, c.danger);
    ctx.fillStyle = c.danger;
    ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fill();
    const ang = (st.t * 4) / st.n;
    const ex = ax + raio(st.n) * Math.cos(ang);
    const ey = ay + raio(st.n) * Math.sin(ang);
    brilho(ex, ey, 13, c.mat);
    ctx.fillStyle = c.mat;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
    // Fótons saindo como ondas.
    st.fotons = st.fotons.filter((f) => {
      f.idade += dt;
      const d = 20 + f.idade * 220;
      if (d > Math.max(w, h)) return false;
      const cor = rgb(f.nm) ?? c.muted;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ondas = 18;
      const k = Math.max(0.15, Math.min(0.9, 400 / f.nm)) * 1.2;
      for (let i = 0; i <= ondas * 4; i++) {
        const s = d + i * 1.5;
        const amp = 4 * Math.sin(i * k);
        const x = ax + Math.cos(f.ang) * s - Math.sin(f.ang) * amp;
        const y = ay + Math.sin(f.ang) * s + Math.cos(f.ang) * amp;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      return true;
    });
    // Diagrama de níveis de energia, com os saltos recentes como setas (branca: absorção; na cor da luz: emissão).
    const dx0 = w * 0.62;
    const dx1 = w - 18;
    const fimLinha = dx1 - 70;
    const top = sy * 0.12;
    const base = sy * 0.9;
    const Y = (E: number) => top + (E / energiaNivel(1)) * (base - top);
    texto(ctx, 'Níveis de energia', dx0, top - 14, c.muted, { tamanho: 11, peso: 700 });
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = alfa(c.muted, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dx0, Y(0)); ctx.lineTo(fimLinha, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
    texto(ctx, '0 eV', dx1, Y(0) + 4, c.muted, { alinhar: 'right', tamanho: 10, mono: true });
    for (let n = 1; n <= N_MAX; n++) {
      const y = Y(energiaNivel(n));
      const atual = n === st.n;
      ctx.strokeStyle = atual ? c.brand : c.fg;
      ctx.lineWidth = atual ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(dx0, y); ctx.lineTo(fimLinha, y); ctx.stroke();
      // Os níveis altos ficam colados: só o atual e os três primeiros ganham rótulo.
      if (n <= 3 || atual) texto(ctx, `n=${n}`, dx0 - 8, y + 4, atual ? c.brand : c.muted, { alinhar: 'right', tamanho: 10, peso: 700, mono: true });
      if (n <= 3) texto(ctx, `${fmt(energiaNivel(n), 2)} eV`, dx1, y + 4, c.muted, { alinhar: 'right', tamanho: 10, mono: true });
    }
    st.saltos.forEach((sa, k) => {
      const x = dx0 + 22 + ((k * 24) % Math.max(24, fimLinha - dx0 - 44));
      const cor = sa.nm === null ? c.fg : (rgb(sa.nm) ?? c.muted);
      ctx.globalAlpha = Math.max(0, 1 - (st.t - sa.t) / 1.6);
      seta(ctx, x, Y(energiaNivel(sa.de)), x, Y(energiaNivel(sa.para)), cor, 2.5);
      ctx.globalAlpha = 1;
    });
    // Espectro: o visível aparece apagado, de referência; cada linha emitida acende por cima.
    const sh = h * 0.1;
    const sx0 = 16;
    const sx1 = w - 16;
    const X = (nm: number) => sx0 + ((nm - 380) / (750 - 380)) * (sx1 - sx0);
    ctx.fillStyle = '#05050a';
    ctx.beginPath(); ctx.roundRect(sx0, sy, sx1 - sx0, sh, 6); ctx.fill();
    ctx.globalAlpha = 0.14;
    for (let x = sx0; x < sx1; x += 2) {
      const cor = rgb(380 + ((x - sx0) / (sx1 - sx0)) * 370);
      if (!cor) continue;
      ctx.fillStyle = cor;
      ctx.fillRect(x, sy, 2, sh);
    }
    ctx.globalAlpha = 1;
    let maxCont = 1;
    st.linhas.forEach((v) => (maxCont = Math.max(maxCont, v)));
    let uv = 0;
    let iv = 0;
    st.linhas.forEach((cont, chave) => {
      const [a, b] = chave.split('-').map(Number);
      const nm = comprimentoTransicao(a, b);
      if (nm < 380) { uv += cont; return; }
      if (nm > 750) { iv += cont; return; }
      const cor = rgb(nm)!;
      const g = ctx.createLinearGradient(X(nm) - 8, 0, X(nm) + 8, 0);
      g.addColorStop(0, alfa(cor, 0));
      g.addColorStop(0.5, cor);
      g.addColorStop(1, alfa(cor, 0));
      ctx.globalAlpha = 0.45 + 0.55 * (cont / maxCont);
      ctx.fillStyle = g;
      ctx.fillRect(X(nm) - 8, sy, 16, sh);
      ctx.fillStyle = cor;
      ctx.fillRect(X(nm) - 1.5, sy, 3, sh);
      ctx.globalAlpha = 1;
      texto(ctx, `${fmt(nm, 0)} nm`, X(nm), sy - 5, c.fg, { alinhar: 'center', tamanho: 10, mono: true, peso: 600 });
    });
    texto(ctx, `UV (Lyman): ${uv}`, sx0, sy + sh + 15, c.muted, { tamanho: 10 });
    texto(ctx, `IV (Paschen…): ${iv}`, sx1, sy + sh + 14, c.muted, { alinhar: 'right', tamanho: 10 });
    texto(ctx, 'espectro visível (380 a 750 nm)', (sx0 + sx1) / 2, sy + sh + 14, c.muted, { alinhar: 'center', tamanho: 10 });
  };

  const regiao = ultima ? faixaEspectro(ultima.nm) : null;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="Átomo de Bohr, diagrama de níveis de energia e espectro de emissão" proporcao={16 / 10} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Nível do elétron', valor: `n = ${nAtual}`, nota: `${fmt(energiaNivel(nAtual), 2)} eV` },
              { rotulo: 'Última transição', valor: ultima ? `${ultima.de} → ${ultima.para}` : '—' },
              { rotulo: 'Comprimento de onda', valor: ultima ? `${fmt(ultima.nm, 1)} nm` : '—', cor: ultima ? (rgb(ultima.nm) ?? undefined) : undefined },
              { rotulo: 'Energia do fóton', valor: ultima ? `${fmt(energiaFoton(ultima.nm), 2)} eV` : '—' },
              { rotulo: 'Série', valor: ultima ? serieEspectral(ultima.para) : '—' },
              { rotulo: 'Região', valor: regiao ?? '—' },
            ]}
          />
        }
        controles={
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Dar energia ao elétron (absorção)</p>
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" className="btn btn-ghost px-0" onClick={() => excitar(n)} title={`Absorver ${fmt(energiaNivel(n) - energiaNivel(1), 2)} eV`}>
                    n={n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">Do nível 1 até o escolhido. Depois de um instante o elétron volta, emitindo fótons.</p>
            </div>
            <Alternar rotulo="Lâmpada de hidrogênio (descarga contínua)" marcado={lampada} onChange={setLampada} dica="Excita átomos sem parar: o espectro de linhas vai aparecendo." />
            <button type="button" className="btn btn-ghost w-full" onClick={limpar}>
              Limpar espectro
            </button>
          </>
        }
      />
      <Explicacao enem={'O **espectro de linhas** é a impressão digital de cada elemento: é como se descobriu o hélio no Sol. Os fogos de artifício e o **teste de chama** usam a mesma ideia: elétrons excitados pelo calor voltam a níveis mais baixos e emitem luz de cores bem definidas (sódio amarelo, cobre verde, estrôncio vermelho).'}>
        {`No modelo de **Bohr**, o elétron só ocupa órbitas com energias permitidas, $E_n = -13{,}6\\ \\text{eV}/n^2$. Ao absorver exatamente a diferença de energia, salta para um nível mais alto; ao voltar, emite um **fóton** com essa energia:
$$E_{fóton} = h f = \\frac{hc}{\\lambda} = E_{inicial} - E_{final}.$$
Saltos que terminam no nível 2 (**série de Balmer**) dão as quatro linhas visíveis do hidrogênio: vermelha (656 nm), azul-esverdeada (486 nm) e duas violetas (434 e 410 nm). Os que terminam no nível 1 (**Lyman**) têm energia maior e caem no ultravioleta; no nível 3 (**Paschen**), no infravermelho.

Os comprimentos de onda saem da fórmula de Rydberg com a massa do próton e conferem com os medidos. Os raios das órbitas crescem com $n^2$ (aqui comprimidos para caber).`}
      </Explicacao>
    </div>
  );
}
