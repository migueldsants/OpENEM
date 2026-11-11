import { useRef, useState } from 'react';
import {
  afimPorPontos,
  exponencialPorPontos,
  formaGeral,
  logaritmo,
  quadraticaPorVertice,
  raizes,
  senoPorPico,
  type Familia,
  type P2,
} from '../../../lib/simulacoes/matematica';
import { alfa, texto } from '../canvas';
import { MinhasFuncoes } from './MinhasFuncoes';
import { alca, comSinal, curva, desenharPlano, num, plano } from '../plano';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type ItemLeitura, type Ponteiro, type Quadro } from '../ui';

type Pontos = Record<Familia, P2[]>;

const INICIAIS: Pontos = {
  afim: [[-2, -1], [2, 3]],
  quadratica: [[1, -3], [3, 1]],
  exponencial: [[0, 1], [1, 2]],
  logaritmica: [[2, 1]],
  seno: [[0, 2], [Math.PI, -2], [2 * Math.PI, 2]],
};

/** O que cada alça pode fazer: andar livre, só na vertical ou só na horizontal. */
type Trava = 'livre' | 'vertical' | 'horizontal';
const TRAVAS: Record<Familia, Trava[]> = {
  afim: ['livre', 'livre'],
  quadratica: ['livre', 'livre'],
  exponencial: ['vertical', 'vertical'],
  logaritmica: ['horizontal'],
  seno: ['livre', 'vertical', 'horizontal'],
};

interface Funcao {
  f: (x: number) => number;
  formula: string;
  leituras: ItemLeitura[];
  /** Pontos especiais para marcar: raízes, vértice, intercepto. */
  marcas: { p: P2; rotulo: string }[];
  inversa?: (x: number) => number;
}

function montar(fam: Familia, pts: P2[]): Funcao {
  switch (fam) {
    case 'afim': {
      const { a, b } = afimPorPontos(pts[0], pts[1]);
      const raiz = Math.abs(a) > 1e-9 ? -b / a : null;
      return {
        f: (x) => a * x + b,
        formula: `f(x) = ${coef(a)}x ${comSinal(b)}`,
        leituras: [
          { rotulo: 'Coeficiente angular (a)', valor: num(a), nota: 'quanto y sobe quando x anda 1' },
          { rotulo: 'Coeficiente linear (b)', valor: num(b), nota: 'onde a reta corta o eixo y' },
          { rotulo: 'Raiz (zero)', valor: raiz === null ? (Math.abs(b) < 1e-9 ? 'todo x' : 'não tem') : num(raiz) },
          { rotulo: 'A função é', valor: a > 1e-9 ? 'crescente' : a < -1e-9 ? 'decrescente' : 'constante' },
        ],
        marcas: [...(raiz !== null ? [{ p: [raiz, 0] as P2, rotulo: 'raiz' }] : []), { p: [0, b], rotulo: 'b' }],
      };
    }
    case 'quadratica': {
      const q = quadraticaPorVertice(pts[0], pts[1]);
      const g = formaGeral(q);
      const rs = raizes(g.a, g.b, g.c);
      const delta = g.b * g.b - 4 * g.a * g.c;
      return {
        f: (x) => q.a * (x - q.h) ** 2 + q.k,
        formula: `f(x) = ${coef(g.a)}x² ${comSinal(g.b)}x ${comSinal(g.c)}`,
        leituras: [
          { rotulo: 'a · b · c', valor: `${num(g.a)} · ${num(g.b)} · ${num(g.c)}` },
          { rotulo: 'Δ = b² − 4ac', valor: num(delta), nota: delta > 0 ? 'duas raízes reais' : Math.abs(delta) < 1e-9 ? 'uma raiz (dupla)' : 'nenhuma raiz real' },
          { rotulo: 'Raízes', valor: rs.length ? rs.map((r) => num(r)).join(' e ') : 'não tem' },
          { rotulo: 'Vértice', valor: `(${num(q.h)}, ${num(q.k)})`, nota: 'xv = −b/2a, yv = −Δ/4a' },
          { rotulo: 'Concavidade', valor: g.a > 0 ? 'para cima (mínimo)' : 'para baixo (máximo)' },
          { rotulo: 'Imagem', valor: g.a > 0 ? `y ≥ ${num(q.k)}` : `y ≤ ${num(q.k)}` },
        ],
        marcas: [...rs.map((r) => ({ p: [r, 0] as P2, rotulo: 'raiz' })), { p: [q.h, q.k], rotulo: 'vértice' }, { p: [0, g.c], rotulo: 'c' }],
      };
    }
    case 'exponencial': {
      const { k, base } = exponencialPorPontos(pts[0], pts[1]);
      return {
        f: (x) => (base > 0 ? k * base ** x : NaN),
        formula: base > 0 ? `f(x) = ${num(k)} · ${num(base)}ˣ` : 'a base precisa ser positiva',
        leituras: [
          { rotulo: 'Base', valor: num(base), nota: 'f(1) ÷ f(0)' },
          { rotulo: 'f(0)', valor: num(k) },
          { rotulo: 'A função é', valor: base <= 0 ? '–' : base > 1 ? (k > 0 ? 'crescente' : 'decrescente') : base < 1 ? (k > 0 ? 'decrescente' : 'crescente') : 'constante' },
          { rotulo: 'Assíntota', valor: 'y = 0', nota: 'a curva chega perto do eixo x e nunca toca' },
        ],
        marcas: [{ p: [0, k], rotulo: 'f(0)' }],
      };
    }
    case 'logaritmica': {
      const base = pts[0][0];
      const f = logaritmo(base);
      return {
        f,
        formula: base > 0 && base !== 1 ? `f(x) = log${baseSub(base)} x` : 'a base precisa ser positiva e diferente de 1',
        leituras: [
          { rotulo: 'Base', valor: num(base), nota: 'o ponto onde f(x) = 1' },
          { rotulo: 'Domínio', valor: 'x > 0' },
          { rotulo: 'Raiz', valor: 'x = 1', nota: 'log de 1 é 0 em qualquer base' },
          { rotulo: 'A função é', valor: base > 1 ? 'crescente' : base < 1 && base > 0 ? 'decrescente' : '–' },
        ],
        marcas: [{ p: [1, 0], rotulo: 'raiz' }],
        inversa: (x) => base ** x,
      };
    }
    case 'seno': {
      const [pico, vale, prox] = pts;
      const T = Math.max(0.5, prox[0] - pico[0]);
      const D = (pico[1] + vale[1]) / 2;
      const s = senoPorPico(pico, T, D);
      return {
        f: (x) => s.A * Math.sin(s.B * (x - s.C)) + s.D,
        formula: `f(x) = ${num(s.A)} · sen(${num(s.B)}·(x ${comSinal(-s.C)})) ${comSinal(s.D)}`,
        leituras: [
          { rotulo: 'Amplitude', valor: num(Math.abs(s.A)), nota: 'metade da distância entre o pico e o vale' },
          { rotulo: 'Período', valor: num(T), nota: 'T = 2π/B' },
          { rotulo: 'Imagem', valor: `[${num(D - Math.abs(s.A))}, ${num(D + Math.abs(s.A))}]` },
          { rotulo: 'Linha do meio', valor: `y = ${num(D)}` },
        ],
        marcas: [],
      };
    }
  }
}

/** Coeficiente antes de x: 1 some e −1 vira só o sinal. */
const coef = (v: number) => (Math.abs(v - 1) < 1e-9 ? '' : Math.abs(v + 1) < 1e-9 ? '−' : num(v));

const baseSub = (b: number) => num(b).replace(/[\d,]/g, (d) => (d === ',' ? '‚' : '₀₁₂₃₄₅₆₇₈₉'[Number(d)]));

/** Mantém as alças da senoide coerentes: o vale fica no meio do período e o próximo pico na altura do pico. */
function ajustarSeno(pts: P2[]): P2[] {
  const [pico, vale, prox] = pts;
  const T = Math.max(0.5, prox[0] - pico[0]);
  return [pico, [pico[0] + T / 2, Math.min(vale[1], pico[1] - 0.25)], [pico[0] + T, pico[1]]];
}

export default function Funcoes() {
  const [fam, setFam] = useState<Familia | 'sua'>('quadratica');
  const [pontos, setPontos] = useState<Pontos>(INICIAIS);
  const [grade, setGrade] = useState(true);
  const [sinal, setSinal] = useState(true);
  const [inversa, setInversa] = useState(false);
  const [mira, setMira] = useState<number | null>(null);
  const [ativo, setAtivo] = useState<number | null>(null);
  const arrasto = useRef<number | null>(null);
  const seletor = (
    <Segmentos
      rotulo="Função"
      valor={fam}
      opcoes={[
        { valor: 'afim', rotulo: '1º grau' },
        { valor: 'quadratica', rotulo: '2º grau' },
        { valor: 'exponencial', rotulo: 'Exp.' },
        { valor: 'logaritmica', rotulo: 'Log' },
        { valor: 'seno', rotulo: 'Seno' },
        { valor: 'sua', rotulo: 'Sua função' },
      ]}
      onChange={setFam}
    />
  );
  // "Sua função": o aluno digita a expressão (outra tela, com o mesmo seletor no alto).
  if (fam === 'sua') return <MinhasFuncoes seletor={seletor} />;
  const pts = pontos[fam];
  const fn = montar(fam, pts);

  const onPonteiro = (e: Ponteiro) => {
    const p = plano(e.w, e.h, 6);
    const x = p.x(e.x);
    const y = p.y(e.y);
    if (e.tipo === 'down') {
      const i = pts.findIndex((q) => Math.hypot(p.X(q[0]) - e.x, p.Y(q[1]) - e.y) < 22);
      arrasto.current = i >= 0 ? i : null;
      setAtivo(arrasto.current);
    } else if (e.tipo === 'up') {
      arrasto.current = null;
      setAtivo(null);
    }
    setMira(x);
    const i = arrasto.current;
    if (i === null || e.tipo === 'up') return;
    const g = (v: number) => (grade ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100);
    const trava = TRAVAS[fam][i];
    let novo: P2 = [trava === 'vertical' ? pts[i][0] : g(x), trava === 'horizontal' ? pts[i][1] : g(y)];
    if (fam === 'logaritmica') novo = [Math.max(0.1, Math.abs(novo[0] - 1) < 0.05 ? 1.1 : novo[0]), 1];
    if (fam === 'exponencial' && i === 0 && Math.abs(novo[1]) < 0.1) novo = [0, 0.5];
    const lista = pts.map((q, k) => (k === i ? novo : q));
    setPontos({ ...pontos, [fam]: fam === 'seno' ? ajustarSeno(lista) : lista });
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const p = plano(w, h, 6);
    desenharPlano(ctx, p, w, h, c);
    // Estudo do sinal sobre o eixo x: verde onde f > 0, vermelho onde f < 0.
    if (sinal) {
      for (let px = 0; px < w; px += 2) {
        const v = fn.f(p.x(px));
        if (!Number.isFinite(v) || Math.abs(v) < 1e-9) continue;
        ctx.fillStyle = alfa(v > 0 ? c.nat : c.danger, 0.55);
        ctx.fillRect(px, p.Y(0) - 3, 2, 6);
      }
    }
    if (fam === 'logaritmica' && inversa && fn.inversa) {
      ctx.setLineDash([5, 5]);
      curva(ctx, p, w, (x) => x, alfa(c.muted, 0.8), 1.2);
      ctx.setLineDash([]);
      curva(ctx, p, w, fn.inversa, alfa(c.hum, 0.85), 2);
      texto(ctx, 'y = bˣ', p.X(1.6), p.Y(fn.inversa(1.6)) - 8, c.hum, { tamanho: 11, peso: 600 });
    }
    curva(ctx, p, w, fn.f, c.mat, 2.8);
    if (fam === 'exponencial') {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = alfa(c.muted, 0.7);
      ctx.beginPath(); ctx.moveTo(0, p.Y(0) - 1); ctx.lineTo(w, p.Y(0) - 1); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Leitura onde está o ponteiro.
    if (mira !== null && arrasto.current === null) {
      const v = fn.f(mira);
      if (Number.isFinite(v)) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = alfa(c.fg, 0.35);
        ctx.beginPath(); ctx.moveTo(p.X(mira), p.Y(0)); ctx.lineTo(p.X(mira), p.Y(v)); ctx.lineTo(p.X(0), p.Y(v)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c.fg;
        ctx.beginPath(); ctx.arc(p.X(mira), p.Y(v), 3.5, 0, Math.PI * 2); ctx.fill();
        texto(ctx, `(${num(mira, 2)}; ${num(v, 2)})`, p.X(mira) + 8, p.Y(v) - 8, c.fg, { tamanho: 11, mono: true, peso: 600 });
      }
    }
    for (const m of fn.marcas) {
      if (!Number.isFinite(m.p[1])) continue;
      ctx.fillStyle = c.danger;
      ctx.beginPath(); ctx.arc(p.X(m.p[0]), p.Y(m.p[1]), 4.5, 0, Math.PI * 2); ctx.fill();
      texto(ctx, m.rotulo, p.X(m.p[0]) + 7, p.Y(m.p[1]) + 15, c.danger, { tamanho: 10, peso: 600 });
    }
    pts.forEach((q, i) => alca(ctx, p.X(q[0]), p.Y(q[1]), c.brand, c, ativo === i));
    // Fórmula no alto.
    ctx.fillStyle = alfa(c.surface, 0.88);
    ctx.font = '700 15px JetBrains Mono Variable, monospace';
    const larg = ctx.measureText(fn.formula).width;
    ctx.beginPath(); ctx.roundRect(10, 10, larg + 20, 30, 8); ctx.fill();
    texto(ctx, fn.formula, 20, 30, c.mat, { tamanho: 15, peso: 700, mono: true });
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Gráfico de ${fn.formula}`} proporcao={4 / 3} onPonteiro={onPonteiro} alturaMin={300} />}
        leituras={<Leituras itens={fn.leituras} />}
        controles={
          <>
            {seletor}
            <p className="text-xs text-muted text-pretty">
              {
                {
                  afim: 'Arraste os dois pontos: a reta passa por eles.',
                  quadratica: 'Arraste o vértice e o outro ponto da parábola.',
                  exponencial: 'Arraste f(0) e f(1) na vertical: a base é a razão entre eles.',
                  logaritmica: 'Arraste o ponto na reta y = 1: ali x é a base.',
                  seno: 'Arraste o pico, o vale (amplitude) e o próximo pico (período).',
                }[fam]
              }{' '}
              Passe o mouse ou o dedo pelo gráfico para ler os valores.
            </p>
            <Alternar rotulo="Grudar na grade (de 0,5 em 0,5)" marcado={grade} onChange={setGrade} />
            <Alternar rotulo="Estudo do sinal no eixo x" marcado={sinal} onChange={setSinal} dica="Verde onde f(x) > 0, vermelho onde f(x) < 0." />
            {fam === 'logaritmica' && <Alternar rotulo="Mostrar a inversa (bˣ) e y = x" marcado={inversa} onChange={setInversa} dica="As inversas são simétricas em relação à reta y = x." />}
            <button type="button" className="btn btn-ghost w-full" onClick={() => setPontos({ ...pontos, [fam]: INICIAIS[fam] })}>
              Voltar ao começo
            </button>
          </>
        }
      />
      <Explicacao
        enem={'Cai ler o gráfico: o **sinal** de $a$ e de $\\Delta$ pela parábola, o **vértice** como lucro máximo ou custo mínimo, o crescimento **exponencial** (juros compostos, bactérias, decaimento) e o **logaritmo** como a operação que desfaz a potência (escala Richter, pH, decibéis). Questões de modelagem pedem montar $f(x) = ax + b$ a partir de dois pontos de uma tabela.'}
      >
        {`Cada família tem um formato e cada parâmetro tem um papel visível. Arraste os pontos e repare no que muda.

**1º grau**, $f(x) = ax + b$: uma reta. $a$ é a inclinação (quanto $y$ muda quando $x$ anda 1) e $b$ é onde ela corta o eixo $y$.

**2º grau**, $f(x) = ax^2 + bx + c$: uma parábola. O sinal de $a$ decide a concavidade; o $\\Delta = b^2 - 4ac$ decide quantas vezes ela corta o eixo $x$ (as raízes de Bhaskara). O vértice fica em $x_v = -\\tfrac{b}{2a}$.

**Exponencial**, $f(x) = k \\cdot b^x$: multiplica por $b$ a cada passo. Com $b > 1$ cresce cada vez mais rápido; com $0 < b < 1$ decai. Nunca toca o eixo $x$.

**Logaritmo**, $f(x) = \\log_b x$: a pergunta "a que expoente elevo $b$ para dar $x$?". Só existe para $x > 0$ e é a inversa da exponencial: os dois gráficos são o reflexo um do outro na reta $y = x$.

**Seno**, $f(x) = A \\sin(B(x - C)) + D$: uma onda com amplitude $|A|$, período $2\\pi/B$ e linha do meio em $y = D$.`}
      </Explicacao>
    </div>
  );
}
