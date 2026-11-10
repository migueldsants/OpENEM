import { useRef, useState } from 'react';
import { colisao1D, energiaCinetica } from '../../../lib/simulacoes/mais-modelos';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto } from '../canvas';
import { BarraExecucao, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Ponteiro, type Quadro } from '../ui';

const TRILHO = 10; // m
const X1 = 2.5;
const X2 = 7;
/** Pixels por (m/s) nas setas de velocidade. */
const ESC_V = 22;

const lado = (m: number) => 0.55 + 0.22 * Math.cbrt(m); // m: o carrinho cresce com a massa

type Tipo = 'elastica' | 'parcial' | 'inelastica';
const RESTITUICAO: Record<Tipo, number> = { elastica: 1, parcial: 0.5, inelastica: 0 };

export default function Colisoes() {
  const [m1, setM1] = useState(2);
  const [m2, setM2] = useState(1);
  const [v1, setV1] = useState(3);
  const [v2, setV2] = useState(-1);
  const [tipo, setTipo] = useState<Tipo>('elastica');
  const [rodando, setRodando] = useState(false);
  const [vista, setVista] = useState({ v1: 3, v2: -1, colidiu: false });
  const sim = useRef({ x1: X1, x2: X2, v1: 3, v2: -1, colidiu: false, clarao: 0 });
  const acc = useRef(0);
  const arrasto = useRef<1 | 2 | null>(null);
  const e = RESTITUICAO[tipo];

  const reiniciar = (nv1 = v1, nv2 = v2) => {
    sim.current = { x1: X1, x2: X2, v1: nv1, v2: nv2, colidiu: false, clarao: 0 };
    setVista({ v1: nv1, v2: nv2, colidiu: false });
    setRodando(false);
  };
  const mudar = (fn: () => void, nv1 = v1, nv2 = v2) => {
    fn();
    reiniciar(nv1, nv2);
  };

  const geo = (w: number, h: number) => {
    const esc = (w - 32) / TRILHO;
    return { esc, chao: h * 0.52, X: (x: number) => 16 + x * esc };
  };

  // Arrastar a ponta da seta muda a velocidade inicial daquele carrinho.
  const onPonteiro = (ev: Ponteiro) => {
    if (ev.tipo === 'up') {
      arrasto.current = null;
      return;
    }
    const g = geo(ev.w, ev.h);
    const s = sim.current;
    const topo = (m: number) => g.chao - lado(m) * g.esc - 16;
    if (ev.tipo === 'down') {
      if (s.colidiu || rodando) return;
      const d1 = Math.hypot(ev.x - (g.X(s.x1) + v1 * ESC_V), ev.y - topo(m1));
      const d2 = Math.hypot(ev.x - (g.X(s.x2) + v2 * ESC_V), ev.y - topo(m2));
      arrasto.current = Math.min(d1, d2) > 34 ? null : d1 <= d2 ? 1 : 2;
      return;
    }
    if (!arrasto.current) return;
    const qual = arrasto.current;
    const nv = Math.max(-5, Math.min(5, Math.round(((ev.x - g.X(qual === 1 ? s.x1 : s.x2)) / ESC_V) * 2) / 2));
    if (qual === 1) {
      setV1(nv);
      reiniciar(nv, v2);
    } else {
      setV2(nv);
      reiniciar(v1, nv);
    }
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    const s = sim.current;
    const g = geo(w, h);
    if (rodando) {
      const passos = 8;
      for (let i = 0; i < passos; i++) {
        s.x1 += (s.v1 * dt) / passos;
        s.x2 += (s.v2 * dt) / passos;
        const contato = s.x2 - lado(m2) / 2 - (s.x1 + lado(m1) / 2);
        if (!s.colidiu && contato <= 0 && s.v1 > s.v2) {
          [s.v1, s.v2] = colisao1D(m1, s.v1, m2, s.v2, e);
          s.colidiu = true;
          s.clarao = 1;
          // Grudados não se atravessam.
          s.x2 = s.x1 + lado(m1) / 2 + lado(m2) / 2;
        }
      }
      if (s.x1 < -1 || s.x1 > TRILHO + 1 || s.x2 < -1 || s.x2 > TRILHO + 1) setRodando(false);
      acc.current += dt;
      if (acc.current > 0.1) {
        acc.current = 0;
        setVista({ v1: s.v1, v2: s.v2, colidiu: s.colidiu });
      }
    }
    s.clarao = Math.max(0, s.clarao - dt * 2.5);
    // Trilho.
    ctx.fillStyle = alfa(c.muted, 0.35);
    ctx.fillRect(8, g.chao, w - 16, 4);
    for (let x = 0; x <= TRILHO; x++) {
      ctx.fillStyle = alfa(c.muted, 0.6);
      ctx.fillRect(g.X(x) - 0.5, g.chao + 4, 1, x % 5 ? 4 : 8);
      if (x % 5 === 0) texto(ctx, `${x} m`, g.X(x), g.chao + 24, c.muted, { alinhar: 'center', tamanho: 10, mono: true });
    }
    // Carrinhos.
    const carro = (x: number, m: number, v: number, cor: string, nome: string) => {
      const L = lado(m) * g.esc;
      const px = g.X(x);
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.roundRect(px - L / 2, g.chao - L - 5, L, L, 6); ctx.fill();
      ctx.fillStyle = c.fg;
      for (const dx of [-L * 0.28, L * 0.28]) {
        ctx.beginPath(); ctx.arc(px + dx, g.chao - 4, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      // A massa vai dentro do carrinho, com a letra encolhendo para caber no pequeno.
      texto(ctx, `${fmt(m, 1)} kg`, px, g.chao - L / 2, c.surface, { alinhar: 'center', tamanho: Math.max(8, Math.min(11, L / 3.4)), peso: 700 });
      // Em tela estreita as duas velocidades se encontram no meio: vão junto do nome.
      const estreito = w < 560;
      texto(ctx, estreito && Math.abs(v) > 0.05 ? `${nome} ${fmt(v, 1)} m/s` : nome, px, g.chao - L - 32, cor, { alinhar: 'center', tamanho: estreito ? 11 : 12, peso: 800 });
      if (Math.abs(v) > 0.05) {
        seta(ctx, px, g.chao - L - 16, px + v * ESC_V, g.chao - L - 16, c.fg, 2.5);
        if (!estreito) texto(ctx, `${fmt(v, 1)} m/s`, px + v * ESC_V + (v > 0 ? 16 : -16), g.chao - L - 12, c.fg, { alinhar: v > 0 ? 'left' : 'right', tamanho: 11, mono: true, peso: 600 });
      }
      if (!rodando && !s.colidiu) {
        // Alça da seta: dá para arrastar.
        ctx.fillStyle = alfa(c.brand, 0.25);
        ctx.beginPath(); ctx.arc(px + v * ESC_V, g.chao - L - 16, 11, 0, Math.PI * 2); ctx.fill();
      }
    };
    carro(s.x1, m1, s.v1, c.mat, 'A');
    carro(s.x2, m2, s.v2, c.hum, 'B');
    if (s.clarao > 0) {
      const px = g.X(s.x1 + lado(m1) / 2);
      ctx.strokeStyle = alfa(c.fg, s.clarao);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, g.chao - 26, 10 + (1 - s.clarao) * 26, 0, Math.PI * 2); ctx.stroke();
    }
    // Barras de quantidade de movimento: a de cada um e a total, que não muda.
    const base = h - 20;
    const p1 = m1 * s.v1;
    const p2 = m2 * s.v2;
    const maxP = Math.max(1, 5 * (m1 + m2) * 0.6);
    const zero = w / 2;
    const larg = (w / 2 - 70) / maxP;
    const barra = (y: number, p: number, cor: string, nome: string) => {
      ctx.fillStyle = cor;
      ctx.fillRect(p >= 0 ? zero : zero + p * larg, y - 9, Math.abs(p) * larg, 9);
      texto(ctx, nome, 14, y, cor, { tamanho: 11, peso: 700 });
      texto(ctx, `${fmt(p, 1)} kg·m/s`, w - 14, y, cor, { alinhar: 'right', tamanho: 11, mono: true });
    };
    barra(base - 44, p1, c.mat, 'p de A');
    barra(base - 26, p2, c.hum, 'p de B');
    barra(base - 8, p1 + p2, c.fg, 'p total');
    ctx.strokeStyle = alfa(c.muted, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(zero, base - 58); ctx.lineTo(zero, base - 2); ctx.stroke();
  };

  const colidem = v1 > v2;
  const [d1, d2] = colidem ? colisao1D(m1, v1, m2, v2, e) : [v1, v2];
  const ecAntes = energiaCinetica(m1, v1) + energiaCinetica(m2, v2);
  const ecDepois = energiaCinetica(m1, d1) + energiaCinetica(m2, d2);

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Dois carrinhos num trilho: A com ${fmt(m1, 1)} kg a ${fmt(v1, 1)} m/s e B com ${fmt(m2, 1)} kg a ${fmt(v2, 1)} m/s`} proporcao={16 / 9} onPonteiro={onPonteiro} alturaMin={260} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Momento total', valor: `${fmt(m1 * v1 + m2 * v2, 2)} kg·m/s`, nota: 'igual antes e depois, em qualquer colisão' },
              { rotulo: 'A depois', valor: colidem ? `${fmt(d1, 2)} m/s` : 'não colidem', cor: 'var(--mat)' },
              { rotulo: 'B depois', valor: colidem ? `${fmt(d2, 2)} m/s` : '–', cor: 'var(--hum)' },
              { rotulo: 'Energia cinética antes', valor: `${fmt(ecAntes, 2)} J` },
              { rotulo: 'Energia cinética depois', valor: `${fmt(ecDepois, 2)} J` },
              { rotulo: 'Energia dissipada', valor: ecAntes > 0 ? `${fmt(((ecAntes - ecDepois) / ecAntes) * 100, 0)}%` : '–', nota: 'vira calor, som e deformação' },
              { rotulo: 'Agora', valor: vista.colidiu ? 'depois da colisão' : rodando ? 'antes da colisão' : 'pronto para lançar' },
            ]}
          />
        }
        controles={
          <>
            <BarraExecucao rodando={rodando} onAlternar={() => setRodando((r) => !r)} onReiniciar={() => reiniciar()} />
            <Segmentos
              rotulo="Colisão"
              valor={tipo}
              opcoes={[
                { valor: 'elastica', rotulo: 'Elástica' },
                { valor: 'parcial', rotulo: 'Parcial' },
                { valor: 'inelastica', rotulo: 'Inelástica' },
              ]}
              onChange={(v) => mudar(() => setTipo(v))}
            />
            <p className="text-xs text-muted text-pretty">Arraste a ponta da seta de cada carrinho para mudar a velocidade, ou use os controles.</p>
            <Deslizador rotulo="Massa de A" valor={m1} min={0.5} max={5} passo={0.5} unidade="kg" onChange={(v) => mudar(() => setM1(v))} />
            <Deslizador rotulo="Velocidade de A" valor={v1} min={-5} max={5} passo={0.5} unidade="m/s" onChange={(v) => mudar(() => setV1(v), v, v2)} />
            <Deslizador rotulo="Massa de B" valor={m2} min={0.5} max={5} passo={0.5} unidade="kg" onChange={(v) => mudar(() => setM2(v))} />
            <Deslizador rotulo="Velocidade de B" valor={v2} min={-5} max={5} passo={0.5} unidade="m/s" onChange={(v) => mudar(() => setV2(v), v1, v)} dica="Negativa: B vem ao encontro de A." />
          </>
        }
      />
      <Explicacao
        enem={'Em toda colisão o **momento linear total se conserva** ($m_1v_1 + m_2v_2$ antes = depois). A energia cinética só se conserva na colisão **elástica**; na **perfeitamente inelástica** os corpos saem juntos e a perda é a maior possível. Cai em batidas de carros (airbag e cinto aumentam o tempo da colisão e diminuem a força), bolas de sinuca e no recuo de armas.'}
      >
        {`A **quantidade de movimento** (momento linear) de um corpo é $p = m \\cdot v$, e tem sinal: para a direita é positiva, para a esquerda, negativa. Durante a colisão os carrinhos trocam forças iguais e opostas (3ª lei de Newton), então o que um perde o outro ganha: o **momento total não muda**. Veja a barra "p total" antes e depois.

O tipo de colisão é dado pelo **coeficiente de restituição** $e$, a razão entre a velocidade de afastamento e a de aproximação:

- **Elástica** ($e = 1$): a energia cinética também se conserva. Com massas iguais, os carrinhos trocam de velocidade.
- **Parcialmente elástica** ($0 < e < 1$): parte da energia vira calor, som e deformação.
- **Perfeitamente inelástica** ($e = 0$): saem grudados, com $v = \\dfrac{m_1v_1 + m_2v_2}{m_1 + m_2}$.

Teste: um carrinho pesado batendo num leve parado quase não perde velocidade; um leve batendo num pesado volta.`}
      </Explicacao>
    </div>
  );
}
