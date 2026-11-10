import { useMemo, useRef, useState } from 'react';
import { C_CELULA, estadoCelula, passoOsmose, tonicidade, V_LISE, V_MIN, V_PAREDE, volumeEquilibrio, type TipoCelula } from '../../../lib/simulacoes/mais-modelos';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto, usaMovimentoReduzido } from '../canvas';
import { Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, Segmentos, type Quadro } from '../ui';

/** Permeabilidade da membrana à água, em volumes por (osmol/L) por segundo de animação. */
const P = 1.1;
const SOLUCOES: { nome: string; c: number }[] = [
  { nome: 'Água destilada', c: 0 },
  { nome: 'Soro fisiológico', c: 0.3 },
  { nome: 'Água do mar', c: 1 },
];
const SOLUTO = '#f59e3c';
const AGUA = '#3b82f6';

const quica = (x: number) => {
  const m = ((x % 2) + 2) % 2;
  return m < 1 ? m : 2 - m;
};

export default function Osmose() {
  const [tipo, setTipo] = useState<TipoCelula>('animal');
  const [cFora, setCFora] = useState(0.3);
  const [vista, setVista] = useState({ V: 1, hist: [[0, 1]] as [number, number][] });
  const sim = useRef({ V: 1, t: 0, rompida: false, hist: [[0, 1]] as [number, number][] });
  const acc = useRef(0);
  const relogio = useRef(0);
  const [parado] = useState(usaMovimentoReduzido);
  const pontos = useMemo(() => {
    const r = criarRng(12);
    return Array.from({ length: 150 }, () => ({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5, a: r() * Math.PI * 2, d: Math.sqrt(r()) }));
  }, []);

  const recomecar = () => {
    sim.current = { V: 1, t: 0, rompida: false, hist: [[0, 1]] };
    setVista({ V: 1, hist: [[0, 1]] });
  };
  const mudarSolucao = (c: number) => setCFora(c);

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const s = sim.current;
    relogio.current += dt;
    const antes = s.V;
    // Vários passos pequenos por quadro: perto do equilíbrio a conta é estável.
    // A hemácia que estourou não se recompõe: só uma célula nova.
    if (!s.rompida) for (let i = 0; i < 6; i++) s.V = passoOsmose(s.V, C_CELULA, cFora, dt / 6, P, tipo);
    if (tipo === 'animal' && s.V >= V_LISE - 1e-6) s.rompida = true;
    s.t += dt;
    acc.current += dt;
    if (acc.current > 0.12) {
      acc.current = 0;
      if (Math.abs(s.V - antes) > 1e-5 || s.hist.length < 2) {
        s.hist.push([s.t, s.V]);
        if (s.hist.length > 400) s.hist.shift();
      }
      setVista({ V: s.V, hist: s.hist.slice() });
    }
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) * 0.2;
    const t = parado ? 0 : relogio.current;
    // Solução de fora, com o soluto espalhado conforme a concentração.
    ctx.fillStyle = alfa(AGUA, 0.1);
    ctx.fillRect(0, 0, w, h);
    const R = base * Math.sqrt(s.V); // em 2D a área faz o papel do volume
    const dentroDaCelula = (x: number, y: number) => (tipo === 'animal' ? Math.hypot(x - cx, y - cy) < R + 8 : Math.abs(x - cx) < base * 1.32 && Math.abs(y - cy) < base * 1.02);
    const nFora = Math.round(cFora * 120);
    for (let i = 0; i < nFora; i++) {
      const q = pontos[i];
      const x = quica(q.x + q.vx * t * 0.06) * w;
      const y = quica(q.y + q.vy * t * 0.06) * h;
      // Nem dentro da célula nem sobre a legenda ou a frase de baixo.
      if (dentroDaCelula(x, y) || (x < 190 && y < 44) || (y > h - 28 && Math.abs(x - cx) < 260)) continue;
      ctx.fillStyle = SOLUTO;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    const lise = s.rompida;
    if (tipo === 'vegetal') {
      // Parede celular (rígida) e, dentro, a membrana que encolhe ou encosta.
      const pw = base * 2.5;
      const ph = base * 1.9;
      ctx.fillStyle = alfa('#65a30d', 0.18);
      ctx.strokeStyle = '#65a30d';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 14); ctx.fill(); ctx.stroke();
      const f = Math.sqrt(Math.min(1, s.V / V_PAREDE));
      ctx.fillStyle = alfa('#22c55e', 0.3);
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(cx - (pw / 2 - 6) * f, cy - (ph / 2 - 6) * f, (pw - 12) * f, (ph - 12) * f, 12 * f + 4); ctx.fill(); ctx.stroke();
      // Vacúolo.
      ctx.fillStyle = alfa(AGUA, 0.35);
      ctx.beginPath(); ctx.roundRect(cx - (pw / 2 - 26) * f, cy - (ph / 2 - 22) * f, (pw - 52) * f, (ph - 44) * f, 10); ctx.fill();
      for (let i = 0; i < 26; i++) {
        const q = pontos[149 - i];
        ctx.fillStyle = SOLUTO;
        ctx.beginPath(); ctx.arc(cx + (q.x - 0.5) * (pw - 40) * f, cy + (q.y - 0.5) * (ph - 36) * f, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = alfa('#f2587a', lise ? 0.08 : 0.28);
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3;
      if (lise) ctx.setLineDash([10, 9]);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 26; i++) {
        const q = pontos[149 - i];
        // Com a lise, o conteúdo escapa.
        const raio = (lise ? R * (1 + 0.5 * q.d) : R - 8) * q.d;
        ctx.fillStyle = SOLUTO;
        ctx.beginPath(); ctx.arc(cx + Math.cos(q.a) * raio, cy + Math.sin(q.a) * raio, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Setas da água: para o lado mais concentrado, mais longas com a diferença maior.
    const cDentro = C_CELULA / s.V;
    const dif = cDentro - cFora;
    const travada = (tipo === 'animal' ? s.V >= V_LISE - 1e-6 : s.V >= V_PAREDE - 1e-6) && dif > 0;
    // Murcha até o limite: o que resta é o citoplasma, que não encolhe mais.
    const noFundo = s.V <= V_MIN + 1e-6 && dif < 0;
    if (Math.abs(dif) > 0.004 && !lise && !noFundo) {
      const borda = tipo === 'animal' ? R : base * 1.1;
      const L = Math.min(34, 10 + Math.abs(dif) * 60) * (travada ? 0.5 : 1);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
        const pulso = parado ? 0 : ((t * 0.8 + i * 0.13) % 1) * 6;
        const r0 = borda + (dif > 0 ? L / 2 - pulso : -L / 2 + pulso);
        const r1 = r0 + (dif > 0 ? -L : L);
        seta(ctx, cx + Math.cos(a) * r0 * (tipo === 'vegetal' ? 1.15 : 1), cy + Math.sin(a) * r0, cx + Math.cos(a) * r1 * (tipo === 'vegetal' ? 1.15 : 1), cy + Math.sin(a) * r1, AGUA, 2.2);
      }
    }
    texto(ctx, lise ? 'A membrana não aguentou: lise' : dif > 0.004 ? (travada ? 'A parede segura: a pressão de turgor equilibra a entrada de água' : 'A água entra na célula') : dif < -0.004 ? (noFundo ? 'A célula perdeu quase toda a água que podia perder' : 'A água sai da célula') : 'Em equilíbrio: entra e sai a mesma quantidade', cx, h - 12, c.fg, { alinhar: 'center', tamanho: 12, peso: 700 });
    texto(ctx, '● soluto (não atravessa)', 12, 18, SOLUTO, { tamanho: 11, peso: 600 });
    texto(ctx, '→ água', 12, 34, AGUA, { tamanho: 11, peso: 600 });
  };

  const cDentro = C_CELULA / vista.V;
  const ton = tonicidade(cFora, C_CELULA);
  const vEq = volumeEquilibrio(C_CELULA, cFora);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Célula ${tipo} em solução ${ton}: ${estadoCelula(tipo, vista.V)}`} proporcao={16 / 10} alturaMin={280} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'A solução é', valor: ton, nota: 'em relação ao interior da célula no começo' },
              { rotulo: 'Volume da célula', valor: `${fmt(vista.V * 100, 0)}%`, nota: Number.isFinite(vEq) ? `equilíbrio em ${fmt(vEq * 100, 0)}%` : 'sem equilíbrio em água pura' },
              { rotulo: 'Concentração dentro', valor: `${fmt(cDentro, 2)} osmol/L`, cor: SOLUTO },
              { rotulo: 'Concentração fora', valor: `${fmt(cFora, 2)} osmol/L` },
              { rotulo: 'Célula', valor: estadoCelula(tipo, vista.V), cor: vista.V >= V_LISE - 1e-6 && tipo === 'animal' ? 'var(--danger)' : undefined },
            ]}
          />
        }
        extra={
          <Bloco titulo="Volume da célula ao longo do tempo">
            <Grafico
              series={[{ rotulo: 'volume', cor: 'var(--brand)', pontos: vista.hist.map(([t, v]) => [t, v * 100]) }]}
              rotuloX="tempo (s)"
              rotuloY="volume (%)"
              yMin={30}
              yMax={170}
              horizontais={[{ y: 100, rotulo: 'volume inicial' }]}
              altura={220}
            />
          </Bloco>
        }
        controles={
          <>
            <Segmentos
              rotulo="Célula"
              valor={tipo}
              opcoes={[
                { valor: 'animal', rotulo: 'Animal (hemácia)' },
                { valor: 'vegetal', rotulo: 'Vegetal' },
              ]}
              onChange={(v) => {
                setTipo(v);
                recomecar();
              }}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Mergulhar em</p>
              <div className="flex flex-wrap gap-1.5">
                {SOLUCOES.map((sol) => (
                  <button key={sol.nome} type="button" className="chip" data-active={Math.abs(cFora - sol.c) < 1e-9} onClick={() => mudarSolucao(sol.c)}>
                    {sol.nome}
                  </button>
                ))}
              </div>
            </div>
            <Deslizador rotulo="Concentração de fora" valor={cFora} min={0} max={1.2} passo={0.05} unidade="osmol/L" onChange={mudarSolucao} dica="O interior da célula começa em 0,30 osmol/L, como o soro fisiológico." />
            <button type="button" className="btn btn-ghost w-full" onClick={recomecar}>
              Célula nova
            </button>
          </>
        }
      />
      <Explicacao
        enem={'Cai o que acontece com a célula em cada meio: em solução **hipotônica** a água entra (a hemácia pode estourar, a **hemólise**; a célula vegetal fica **túrgida**, protegida pela parede); em **hipertônica** a água sai (a hemácia murcha, a vegetal sofre **plasmólise**). É por isso que salgar a carne conserva, que a salada murcha com sal e que o soro precisa ser **isotônico**.'}
      >
        {`A **osmose** é a passagem de **água** por uma membrana semipermeável, do lado **menos concentrado** em soluto para o **mais concentrado**. A membrana deixa a água passar e segura o soluto; a água vai "diluir" o lado mais concentrado até as concentrações se igualarem. É um transporte **passivo**: não gasta energia da célula.

Compare a solução de fora com o interior da célula:

- **Isotônica** (mesma concentração): entra e sai a mesma quantidade de água; o volume não muda.
- **Hipotônica** (menos concentrada): a água entra. A célula **animal** incha e pode romper a membrana (lise). A **vegetal** tem parede celular: incha até a parede segurar, e fica túrgida.
- **Hipertônica** (mais concentrada): a água sai. A célula animal murcha; na vegetal, a membrana se descola da parede (**plasmólise**).

O volume de equilíbrio é aquele em que a concentração de dentro iguala a de fora: como o soluto não sai, $V_{eq} = V_0 \\cdot \\dfrac{c_{dentro}}{c_{fora}}$.`}
      </Explicacao>
    </div>
  );
}
