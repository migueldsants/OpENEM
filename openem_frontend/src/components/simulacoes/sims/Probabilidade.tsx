import { useMemo, useRef, useState } from 'react';
import { distribuicaoSoma, esperanca } from '../../../lib/simulacoes/matematica';
import { criarRng } from '../../../lib/simulacoes/numerico';
import { alfa, texto } from '../canvas';
import { num } from '../plano';
import { Bloco, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, Segmentos, type Quadro } from '../ui';

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function dado(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, face: number, giro: number, fg: string, fundo: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.fillStyle = fundo;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-L / 2, -L / 2, L, L, L * 0.18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fg;
  for (const [px, py] of PIPS[face]) {
    ctx.beginPath(); ctx.arc(px * L * 0.26, py * L * 0.26, L * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export default function Probabilidade() {
  const [n, setN] = useState<'1' | '2' | '3'>('2');
  const [contagem, setContagem] = useState<number[]>([]);
  const [ultimo, setUltimo] = useState<number[]>([3, 4]);
  const [historico, setHistorico] = useState<[number, number][]>([]);
  const [alvo, setAlvo] = useState(7);
  const rng = useRef(criarRng(20261109));
  const giro = useRef(0);
  const nd = Number(n);
  const teorica = useMemo(() => distribuicaoSoma(nd), [nd]);
  const total = contagem.reduce((s, x) => s + x, 0);
  const minimo = nd;
  const maximo = 6 * nd;

  const lancar = (vezes: number) => {
    const cont = contagem.length ? [...contagem] : new Array(maximo + 1).fill(0);
    let faces: number[] = [];
    const hist = [...historico];
    let acertos = cont[alvo] ?? 0;
    for (let v = 0; v < vezes; v++) {
      faces = Array.from({ length: nd }, () => 1 + Math.floor(rng.current() * 6));
      const soma = faces.reduce((a, b) => a + b, 0);
      cont[soma]++;
      if (soma === alvo) acertos++;
      const k = total + v + 1;
      // Guarda a frequência relativa em pontos espaçados (o gráfico não precisa de todos).
      if (k <= 50 || k % Math.ceil(k / 50) === 0) hist.push([k, acertos / k]);
    }
    giro.current = 0.6;
    setContagem(cont);
    setUltimo(faces);
    setHistorico(hist);
  };
  const zerar = (novoN?: '1' | '2' | '3') => {
    if (novoN) setN(novoN);
    const nn = Number(novoN ?? n);
    setContagem([]);
    setHistorico([]);
    setUltimo(Array.from({ length: nn }, (_, i) => i + 3));
    setAlvo(Math.round(3.5 * nn));
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    giro.current = Math.max(0, giro.current - dt * 1.6);
    // Dados do último lançamento.
    const L = Math.min(56, h * 0.16);
    const topo = L * 0.9;
    ultimo.forEach((f, i) => {
      const x = w / 2 + (i - (ultimo.length - 1) / 2) * (L * 1.4);
      dado(ctx, x, topo, L, f, Math.sin(giro.current * 9 + i) * giro.current, c.fg, c.surface);
    });
    texto(ctx, total ? `soma ${ultimo.reduce((a, b) => a + b, 0)}` : 'toque em "Lançar"', w / 2, topo + L * 0.95, c.muted, { alinhar: 'center', tamanho: 12, peso: 600 });
    // Histograma: frequência observada (barras) e probabilidade teórica (pontos).
    const somas = Array.from({ length: maximo - minimo + 1 }, (_, i) => minimo + i);
    const base = h - 26;
    const alto = h - topo - L * 1.3 - 40;
    const maxP = Math.max(...teorica) * 1.25;
    const bw = (w - 40) / somas.length;
    somas.forEach((s, i) => {
      const x = 20 + i * bw;
      const obs = total ? (contagem[s] ?? 0) / total : 0;
      ctx.fillStyle = s === alvo ? c.brand : alfa(c.mat, 0.7);
      ctx.fillRect(x + bw * 0.12, base - (obs / maxP) * alto, bw * 0.76, (obs / maxP) * alto);
      const yt = base - (teorica[s] / maxP) * alto;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + bw * 0.1, yt); ctx.lineTo(x + bw * 0.9, yt); ctx.stroke();
      texto(ctx, String(s), x + bw / 2, base + 16, s === alvo ? c.brand : c.muted, { alinhar: 'center', tamanho: 11, mono: true, peso: s === alvo ? 700 : 500 });
    });
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(14, base); ctx.lineTo(w - 14, base); ctx.stroke();
    texto(ctx, '▬ probabilidade teórica', w - 16, base - alto - 6, c.fg, { alinhar: 'right', tamanho: 11 });
    texto(ctx, '■ frequência observada', 16, base - alto - 6, c.mat, { tamanho: 11 });
  };

  const media = total ? contagem.reduce((s, x, i) => s + x * i, 0) / total : 0;
  const freqAlvo = total ? (contagem[alvo] ?? 0) / total : 0;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Lançamento de ${nd} dados com ${total} lançamentos`} proporcao={16 / 10} alturaMin={280} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Lançamentos', valor: total.toLocaleString('pt-BR') },
              { rotulo: 'Média das somas', valor: total ? num(media, 3) : '–', nota: `esperada: ${num(esperanca(teorica), 2)}` },
              { rotulo: `Saiu soma ${alvo}`, valor: total ? `${num(freqAlvo * 100, 1)}%` : '–', cor: 'var(--brand)' },
              { rotulo: `P(soma = ${alvo})`, valor: `${num(teorica[alvo] * 100, 1)}%`, nota: `${Math.round(teorica[alvo] * 6 ** nd)} casos de ${6 ** nd}` },
              { rotulo: 'Resultados possíveis', valor: `6^${nd} = ${6 ** nd}` },
            ]}
          />
        }
        extra={
          <Bloco titulo={`Frequência da soma ${alvo} ao longo dos lançamentos`}>
            <Grafico
              series={[{ rotulo: 'frequência observada', cor: 'var(--brand)', pontos: historico }]}
              rotuloX="lançamentos"
              rotuloY="frequência"
              yMin={0}
              yMax={Math.min(1, teorica[alvo] * 3)}
              horizontais={[{ y: teorica[alvo], rotulo: 'probabilidade', cor: 'var(--fg)' }]}
              altura={220}
            />
            <p className="text-xs text-muted text-pretty">Com poucos lançamentos a frequência pula muito; com milhares, ela gruda na probabilidade (lei dos grandes números).</p>
          </Bloco>
        }
        controles={
          <>
            <Segmentos
              rotulo="Dados"
              valor={n}
              opcoes={[
                { valor: '1', rotulo: '1 dado' },
                { valor: '2', rotulo: '2 dados' },
                { valor: '3', rotulo: '3 dados' },
              ]}
              onChange={(v) => zerar(v)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="btn btn-primary" onClick={() => lancar(1)}>
                Lançar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => lancar(10)}>
                10 vezes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => lancar(100)}>
                100 vezes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => lancar(1000)}>
                1.000 vezes
              </button>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Soma que estou acompanhando</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: maximo - minimo + 1 }, (_, i) => minimo + i).map((s) => (
                  <button key={s} type="button" className="chip font-data" data-active={s === alvo} onClick={() => { setAlvo(s); setHistorico([]); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-ghost w-full" onClick={() => zerar()}>
              Zerar
            </button>
          </>
        }
      />
      <Explicacao
        enem={'A probabilidade é **casos favoráveis ÷ casos possíveis**, com os casos igualmente prováveis. Com dois dados há 36 pares; a soma 7 sai de 6 jeitos (1+6, 2+5…), por isso é a mais provável: 6/36 = 1/6. Questões também pedem o **evento complementar** ("pelo menos um") e a multiplicação para eventos independentes.'}
      >
        {`Um dado honesto tem 6 faces igualmente prováveis. Com mais de um dado, as **somas não são igualmente prováveis**: há um jeito só de tirar 2 com dois dados (1 e 1), mas seis de tirar 7. Por isso o histograma tem forma de pirâmide com dois dados e de sino com três.

A **probabilidade teórica** (o traço) vem da contagem de casos. A **frequência observada** (as barras) vem dos lançamentos sorteados. Com 10 lançamentos elas mal se parecem; com 1.000, quase coincidem. É a **lei dos grandes números**: a frequência relativa tende à probabilidade, mas cada lançamento continua imprevisível.

A **média** das somas também tende ao **valor esperado**: 3,5 por dado (a média de 1 a 6).`}
      </Explicacao>
    </div>
  );
}
