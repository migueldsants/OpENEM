import { useRef, useState } from 'react';
import { anguloEntre, direcao, leiDosCossenos, modulo, somaVetores, type Vetor } from '../../../lib/simulacoes/mais-modelos';
import { alfa, seta, texto } from '../canvas';
import { alca, desenharPlano, num, plano } from '../plano';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Ponteiro, type Quadro } from '../ui';

const COR = ['mat', 'hum', 'lin'] as const;
const NOMES = ['a', 'b', 'c'];

export default function Vetores() {
  const [vs, setVs] = useState<Vetor[]>([[4, 1], [1, 3], [-2, 2]]);
  const [n, setN] = useState<'2' | '3'>('2');
  const [regra, setRegra] = useState<'paralelogramo' | 'poligono'>('paralelogramo');
  const [componentes, setComponentes] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  const arrasto = useRef<number | null>(null);
  const qtd = Number(n);
  const usados = vs.slice(0, qtd);
  const R = somaVetores(usados);
  const regraUsada = qtd === 3 ? 'poligono' : regra;

  /** Ponta de cada vetor desenhado: na regra do polígono, um começa onde o outro termina. */
  const pontas = (): { de: Vetor; ate: Vetor }[] => {
    let o: Vetor = [0, 0];
    return usados.map((v) => {
      const de = regraUsada === 'poligono' ? o : ([0, 0] as Vetor);
      const ate: Vetor = [de[0] + v[0], de[1] + v[1]];
      o = ate;
      return { de, ate };
    });
  };

  const onPonteiro = (e: Ponteiro) => {
    const p = plano(e.w, e.h, 6);
    const ps = pontas();
    if (e.tipo === 'down') {
      const i = ps.findIndex((q) => Math.hypot(p.X(q.ate[0]) - e.x, p.Y(q.ate[1]) - e.y) < 22);
      arrasto.current = i >= 0 ? i : null;
      setAtivo(arrasto.current);
      return;
    }
    if (e.tipo === 'up') {
      arrasto.current = null;
      setAtivo(null);
      return;
    }
    const i = arrasto.current;
    if (i === null) return;
    const ponta: Vetor = [Math.round(p.x(e.x) * 2) / 2, Math.round(p.y(e.y) * 2) / 2];
    const v: Vetor = [ponta[0] - ps[i].de[0], ponta[1] - ps[i].de[1]];
    if (modulo(v) < 0.5) return;
    setVs(vs.map((q, k) => (k === i ? v : q)));
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const p = plano(w, h, 6);
    desenharPlano(ctx, p, w, h, c);
    const X = (q: Vetor): [number, number] => [p.X(q[0]), p.Y(q[1])];
    const ps = pontas();
    if (regraUsada === 'paralelogramo' && qtd === 2) {
      // Os lados opostos do paralelogramo, tracejados, e a área sombreada.
      const [a, b] = usados;
      const s: Vetor = [a[0] + b[0], a[1] + b[1]];
      ctx.fillStyle = alfa(c.fg, 0.05);
      ctx.beginPath(); ctx.moveTo(...X([0, 0])); ctx.lineTo(...X(a)); ctx.lineTo(...X(s)); ctx.lineTo(...X(b)); ctx.closePath(); ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = alfa(c.hum, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(...X(a)); ctx.lineTo(...X(s)); ctx.stroke();
      ctx.strokeStyle = alfa(c.mat, 0.6);
      ctx.beginPath(); ctx.moveTo(...X(b)); ctx.lineTo(...X(s)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (componentes) {
      ctx.setLineDash([3, 4]);
      ps.forEach(({ de, ate }, i) => {
        ctx.strokeStyle = alfa(c[COR[i]], 0.75);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(...X(de)); ctx.lineTo(...X([ate[0], de[1]])); ctx.lineTo(...X(ate)); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // Resultante.
    if (modulo(R) > 0.05) {
      seta(ctx, ...X([0, 0]), ...X(R), c.danger, 3.5);
      texto(ctx, `R = ${num(modulo(R))}`, X(R)[0] + 8, X(R)[1] - 8, c.danger, { tamanho: 13, peso: 800, mono: true });
    }
    ps.forEach(({ de, ate }, i) => {
      seta(ctx, ...X(de), ...X(ate), c[COR[i]], 3);
      const m: Vetor = [(de[0] + ate[0]) / 2, (de[1] + ate[1]) / 2];
      texto(ctx, NOMES[i], X(m)[0] - 12, X(m)[1] - 8, c[COR[i]], { tamanho: 14, peso: 800 });
      alca(ctx, ...X(ate), c[COR[i]], c, ativo === i);
    });
  };

  const theta = qtd === 2 ? anguloEntre(usados[0], usados[1]) : null;
  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Soma de ${qtd} vetores com resultante de módulo ${num(modulo(R))}`} proporcao={4 / 3} onPonteiro={onPonteiro} alturaMin={300} />}
        leituras={
          <Leituras
            itens={[
              ...usados.map((v, i) => ({ rotulo: `${NOMES[i]} = (${num(v[0])}; ${num(v[1])})`, valor: `|${NOMES[i]}| = ${num(modulo(v))}`, cor: `var(--${COR[i]})` })),
              { rotulo: `R = (${num(R[0])}; ${num(R[1])})`, valor: `|R| = ${num(modulo(R))}`, cor: 'var(--danger)', nota: `direção: ${num(direcao(R), 1)}°` },
              ...(theta !== null
                ? [
                    { rotulo: 'Ângulo entre a e b', valor: `${num(theta, 1)}°` },
                    { rotulo: 'Lei dos cossenos', valor: num(leiDosCossenos(modulo(usados[0]), modulo(usados[1]), theta)), nota: '|R|² = a² + b² + 2ab·cos θ' },
                  ]
                : []),
            ]}
          />
        }
        controles={
          <>
            <p className="text-xs text-muted text-pretty">Arraste a ponta de cada vetor. A seta vermelha é a soma (a resultante).</p>
            <Segmentos
              rotulo="Vetores"
              valor={n}
              opcoes={[
                { valor: '2', rotulo: 'Dois' },
                { valor: '3', rotulo: 'Três' },
              ]}
              onChange={setN}
            />
            {qtd === 2 && (
              <Segmentos
                rotulo="Regra"
                valor={regra}
                opcoes={[
                  { valor: 'paralelogramo', rotulo: 'Paralelogramo' },
                  { valor: 'poligono', rotulo: 'Polígono' },
                ]}
                onChange={setRegra}
              />
            )}
            <Alternar rotulo="Componentes x e y" marcado={componentes} onChange={setComponentes} dica="Somar vetores é somar as componentes: Rx = ax + bx, Ry = ay + by." />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="btn btn-ghost" onClick={() => setVs([[4, 0], [0, 3], vs[2]])}>
                Perpendiculares
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setVs([[3, 1], [-3, -1], vs[2]])}>
                Opostos
              </button>
            </div>
          </>
        }
      />
      <Explicacao
        enem={'Grandezas **vetoriais** (força, velocidade, deslocamento) somam com direção: dois vetores de 3 e 4 dão resultante entre 1 e 7, e 5 quando são perpendiculares. Cai no barco atravessando o rio, no avião com vento e na soma de forças para achar a força resultante da 2ª lei de Newton.'}
      >
        {`Um **vetor** tem módulo (tamanho), direção e sentido. Para somar:

- **Regra do paralelogramo**: os dois vetores saem do mesmo ponto; a soma é a diagonal do paralelogramo que eles formam.
- **Regra do polígono**: um vetor começa onde o anterior termina; a soma vai do início do primeiro ao fim do último. Vale para quantos vetores quiser.

As duas dão o mesmo resultado. O módulo da soma de dois vetores depende do ângulo $\\theta$ entre eles: $|R|^2 = a^2 + b^2 + 2ab\\cos\\theta$. Na mesma direção e sentido, somam; perpendiculares, viram Pitágoras; opostos, subtraem.

Ligue as **componentes**: somar vetores é somar separadamente as partes em $x$ e em $y$.`}
      </Explicacao>
    </div>
  );
}
