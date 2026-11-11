import { useRef, useState } from 'react';
import { hardyWeinberg, proximaGeracao, selecao, type Aptidao } from '../../../lib/simulacoes/vida-terra';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { texto, usaMovimentoReduzido } from '../canvas';
import { BarraExecucao, Bloco, Deslizador, Explicacao, Grafico, LayoutSim, Leituras, Palco2D, type Quadro } from '../ui';

const LINHAS = 8;
const GERACOES = 200;
const CORES = ['#f2587a', '#669dfb', '#13b981', '#f59e3c', '#ac8bf5', '#3fa7c4', '#e0a83c', '#b0855a'];
const COR_GEN = { AA: '#3f2d20', Aa: '#9a6b42', aa: '#e3c79b' };

interface Estado {
  g: number;
  p: number[];
  hist: number[][]; // hist[linha] = p por geração
  det: number[];
  genotipos: ('AA' | 'Aa' | 'aa')[];
}

export default function Genetica() {
  const [N, setN] = useState(50);
  const [p0, setP0] = useState(0.5);
  const [wAa, setWAa] = useState(1);
  const [waa, setWaa] = useState(1);
  const [ritmo, setRitmo] = useState(10);
  const [rodando, setRodando] = useState(!usaMovimentoReduzido());
  const w: Aptidao = { AA: 1, Aa: wAa, aa: waa };
  const novo = (pi = p0): Estado => ({ g: 0, p: Array(LINHAS).fill(pi), hist: Array.from({ length: LINHAS }, () => [pi]), det: [pi], genotipos: [] });
  const sim = useRef<Estado>(novo());
  const rng = useRef(criarRng(99));
  const acc = useRef({ ger: 0, ui: 0 });
  const [vista, setVista] = useState<Estado>(() => novo());

  const reiniciar = (pi = p0) => {
    sim.current = novo(pi);
    setVista({ ...sim.current });
  };

  const sortearIndividuos = (p: number) => {
    const out: Estado['genotipos'] = [];
    for (let i = 0; i < N; i++) {
      const a1 = rng.current() < p;
      const a2 = rng.current() < p;
      out.push(a1 && a2 ? 'AA' : a1 || a2 ? 'Aa' : 'aa');
    }
    return out;
  };

  const quadro: Quadro = (ctx, wd, h, dt, c) => {
    const st = sim.current;
    if (rodando && st.g < GERACOES) {
      acc.current.ger += dt * ritmo;
      while (acc.current.ger >= 1 && st.g < GERACOES) {
        acc.current.ger -= 1;
        st.p = st.p.map((pi) => proximaGeracao(pi, N, w, rng.current));
        st.p.forEach((pi, i) => st.hist[i].push(pi));
        st.det.push(selecao(st.det[st.det.length - 1], w));
        st.g++;
        st.genotipos = sortearIndividuos(st.p[0]);
      }
      acc.current.ui += dt;
      if (acc.current.ui > 0.15) {
        acc.current.ui = 0;
        setVista({ ...st, p: [...st.p], hist: st.hist.map((x) => x.slice()), det: st.det.slice() });
      }
    }
    if (st.genotipos.length !== N) st.genotipos = sortearIndividuos(st.p[0]);
    // A população da linha 1 (vermelha): cada besouro é um indivíduo.
    const cols = Math.ceil(Math.sqrt((N * wd) / h));
    const lins = Math.ceil(N / cols);
    const tam = Math.min((wd - 20) / cols, (h - 46) / lins);
    const ox = (wd - cols * tam) / 2;
    st.genotipos.forEach((gen, i) => {
      const x = ox + (i % cols) * tam + tam / 2;
      const y = 14 + Math.floor(i / cols) * tam + tam / 2;
      ctx.fillStyle = COR_GEN[gen];
      ctx.beginPath(); ctx.ellipse(x, y, tam * 0.3, tam * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - tam * 0.38); ctx.lineTo(x, y + tam * 0.38); ctx.stroke();
    });
    texto(ctx, `População 1 · geração ${st.g} · p(A) = ${fmt(st.p[0], 2)}`, 12, h - 10, c.fg, { peso: 600, tamanho: 12 });
    texto(ctx, '● AA  ● Aa  ● aa', wd - 12, h - 10, c.muted, { alinhar: 'right', tamanho: 11 });
  };

  const pMedio = vista.p.reduce((a, b) => a + b, 0) / LINHAS;
  const fixadas = vista.p.filter((x) => x >= 1).length;
  const perdidas = vista.p.filter((x) => x <= 0).length;
  const hw = hardyWeinberg(vista.p[0]);
  const H = vista.p.reduce((a, pi) => a + 2 * pi * (1 - pi), 0) / LINHAS;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo="População de besouros com três genótipos de cor" proporcao={16 / 9} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Geração', valor: String(vista.g) },
              { rotulo: 'p(A) médio', valor: fmt(pMedio, 3), nota: `previsto sem deriva: ${fmt(vista.det[vista.det.length - 1], 3)}` },
              { rotulo: 'Alelo A fixado', valor: `${fixadas} de ${LINHAS}` },
              { rotulo: 'Alelo A perdido', valor: `${perdidas} de ${LINHAS}` },
              { rotulo: 'Heterozigose média', valor: fmt(H, 3), nota: '2pq: a variabilidade' },
              { rotulo: 'Pop. 1 (Hardy-Weinberg)', valor: `${fmt(hw.AA * 100, 0)} / ${fmt(hw.Aa * 100, 0)} / ${fmt(hw.aa * 100, 0)}%`, nota: 'AA / Aa / aa' },
            ]}
          />
        }
        extra={
          <Bloco titulo={`Frequência do alelo A em ${LINHAS} populações de ${N} indivíduos`}>
            <Grafico
              series={[
                ...vista.hist.map((hs, i) => ({ rotulo: `pop. ${i + 1}`, cor: CORES[i], pontos: hs.map((v, g) => [g, v] as [number, number]), largura: 1.5 })),
                { rotulo: 'sem deriva (população infinita)', cor: 'var(--fg)', pontos: vista.det.map((v, g) => [g, v] as [number, number]), tracejado: true },
              ]}
              rotuloX="geração"
              rotuloY="p(A)"
              xMin={0}
              xMax={GERACOES}
              yMin={0}
              yMax={1}
              altura={230}
            />
          </Bloco>
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => reiniciar()} />
            <Deslizador rotulo="Tamanho de cada população (N)" valor={N} min={5} max={500} passo={5} unidade="indivíduos" onChange={(v) => { setN(v); reiniciar(); }} dica="Populações pequenas: a deriva manda. Grandes: a seleção manda." />
            <Deslizador rotulo="Frequência inicial de A" valor={p0} min={0.05} max={0.95} passo={0.05} onChange={(v) => { setP0(v); reiniciar(v); }} />
            <Deslizador rotulo="Aptidão de Aa (AA = 1)" valor={wAa} min={0.5} max={1.5} passo={0.01} onChange={setWAa} />
            <Deslizador rotulo="Aptidão de aa (AA = 1)" valor={waa} min={0} max={1.5} passo={0.01} onChange={setWaa} dica="Menor que 1: seleção contra aa. Aa maior que os dois: vantagem do heterozigoto (anemia falciforme e malária)." />
            <Deslizador rotulo="Ritmo" valor={ritmo} min={1} max={40} unidade="gerações por segundo" onChange={setRitmo} />
          </>
        }
      />
      <Explicacao enem={'O equilíbrio de **Hardy-Weinberg** ($p^2 + 2pq + q^2 = 1$) só vale numa população grande, com cruzamentos ao acaso e sem seleção, mutação ou migração. A **deriva genética** explica o efeito fundador e o gargalo populacional: em populações pequenas, alelos se perdem por acaso e a variabilidade cai, o que ameaça espécies em extinção.'}>
        {`Cada geração é sorteada da anterior (modelo de **Wright-Fisher**): os indivíduos se cruzam ao acaso, a seleção natural altera as chances de cada genótipo deixar descendentes e, por fim, $2N$ alelos são sorteados para a geração seguinte.

- **Sem seleção** (todas as aptidões iguais a 1) e com $N$ grande, a frequência quase não muda: é o equilíbrio de Hardy-Weinberg.
- Com **$N$ pequeno**, cada população segue um caminho diferente só por acaso, e o alelo acaba **fixado** ou **perdido**. A chance de fixar é a frequência inicial.
- Com **seleção** contra $aa$, o alelo $A$ aumenta nas oito populações, mais rápido no começo; o alelo recessivo nunca some de vez numa população grande, porque se esconde nos heterozigotos.

A linha tracejada é o que aconteceria numa população infinita, só com a seleção.`}
      </Explicacao>
    </div>
  );
}
