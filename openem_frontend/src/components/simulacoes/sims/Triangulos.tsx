import { useRef, useState } from 'react';
import { pePerpendicular, triangulo, type P2 } from '../../../lib/simulacoes/matematica';
import { alfa, texto, type Cores } from '../canvas';
import { alca, desenharPlano, num, plano } from '../plano';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, type Ponteiro, type Quadro } from '../ui';

type Notavel = 'baricentro' | 'circuncentro' | 'incentro' | 'ortocentro';

const NOTAVEIS: { key: Notavel; nome: string; linhas: string; cor: keyof Cores }[] = [
  { key: 'baricentro', nome: 'Baricentro', linhas: 'medianas', cor: 'mat' },
  { key: 'circuncentro', nome: 'Circuncentro', linhas: 'mediatrizes', cor: 'hum' },
  { key: 'incentro', nome: 'Incentro', linhas: 'bissetrizes', cor: 'nat' },
  { key: 'ortocentro', nome: 'Ortocentro', linhas: 'alturas', cor: 'lin' },
];

const NOMES = ['A', 'B', 'C'];

export default function Triangulos() {
  const [pts, setPts] = useState<P2[]>([[-3, -2], [4, -2], [0, 3]]);
  const [mostrar, setMostrar] = useState<Record<Notavel, boolean>>({ baricentro: true, circuncentro: false, incentro: false, ortocentro: false });
  const [euler, setEuler] = useState(false);
  const [quadrados, setQuadrados] = useState(false);
  const [grade, setGrade] = useState(true);
  const [ativo, setAtivo] = useState<number | null>(null);
  const arrasto = useRef<number | null>(null);
  const [A, B, C] = pts;
  const t = triangulo(A, B, C, grade ? 0.5 : 0.3);

  const onPonteiro = (e: Ponteiro) => {
    const p = plano(e.w, e.h, 5.5);
    if (e.tipo === 'down') {
      const i = pts.findIndex((q) => Math.hypot(p.X(q[0]) - e.x, p.Y(q[1]) - e.y) < 24);
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
    const g = (v: number) => (grade ? Math.round(v) : Math.round(v * 20) / 20);
    const novo: P2 = [Math.max(p.xMin + 0.3, Math.min(p.xMax - 0.3, g(p.x(e.x)))), Math.max(p.yMin + 0.3, Math.min(p.yMax - 0.3, g(p.y(e.y))))];
    const lista = pts.map((q, k) => (k === i ? novo : q));
    // Não deixa os três pontos ficarem alinhados (o triângulo sumiria).
    if (triangulo(lista[0], lista[1], lista[2]).area > 0.2) setPts(lista);
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const p = plano(w, h, 5.5);
    desenharPlano(ctx, p, w, h, c);
    const X = (q: P2): [number, number] => [p.X(q[0]), p.Y(q[1])];
    const seg = (a: P2, b: P2, cor: string, larg = 1.2, tracejado = true) => {
      ctx.strokeStyle = cor;
      ctx.lineWidth = larg;
      ctx.setLineDash(tracejado ? [5, 4] : []);
      ctx.beginPath(); ctx.moveTo(...X(a)); ctx.lineTo(...X(b)); ctx.stroke();
      ctx.setLineDash([]);
    };
    // Quadrados sobre os lados (Pitágoras).
    if (quadrados) {
      const cent: P2 = t.baricentro;
      for (const [U, V] of [[A, B], [B, C], [C, A]] as [P2, P2][]) {
        const d: P2 = [V[0] - U[0], V[1] - U[1]];
        let n: P2 = [-d[1], d[0]];
        const m: P2 = [(U[0] + V[0]) / 2, (U[1] + V[1]) / 2];
        if ((cent[0] - m[0]) * n[0] + (cent[1] - m[1]) * n[1] > 0) n = [-n[0], -n[1]];
        const q = [U, V, [V[0] + n[0], V[1] + n[1]], [U[0] + n[0], U[1] + n[1]]] as P2[];
        ctx.fillStyle = alfa(c.mat, 0.12);
        ctx.strokeStyle = alfa(c.mat, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        q.forEach((v, i) => (i ? ctx.lineTo(...X(v)) : ctx.moveTo(...X(v))));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const lado = Math.hypot(d[0], d[1]);
        const centroQ: P2 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
        texto(ctx, num(lado * lado, 1), ...X(centroQ), c.mat, { alinhar: 'center', tamanho: 11, peso: 700, mono: true });
      }
    }
    // Triângulo.
    ctx.fillStyle = alfa(c.brand, 0.1);
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(...X(A)); ctx.lineTo(...X(B)); ctx.lineTo(...X(C)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Linhas e pontos notáveis.
    const meio = (u: P2, v: P2): P2 => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    const ponto = (q: P2 | null, cor: string, nome: string) => {
      if (!q) return;
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(...X(q), 5, 0, Math.PI * 2); ctx.fill();
      texto(ctx, nome, X(q)[0] + 8, X(q)[1] - 7, cor, { tamanho: 11, peso: 700 });
    };
    const lados: [P2, P2, P2][] = [[A, B, C], [B, C, A], [C, A, B]];
    if (mostrar.baricentro) {
      for (const [u, v, op] of lados) seg(op, meio(u, v), c.mat);
      ponto(t.baricentro, c.mat, 'G');
    }
    if (mostrar.circuncentro && t.circuncentro) {
      const O = t.circuncentro;
      ctx.strokeStyle = alfa(c.hum, 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(...X(O), t.raioCircunscrito * p.esc, 0, Math.PI * 2); ctx.stroke();
      for (const [u, v] of lados) seg(meio(u, v), O, c.hum);
      ponto(O, c.hum, 'O');
    }
    if (mostrar.incentro) {
      const I = t.incentro;
      ctx.strokeStyle = alfa(c.nat, 0.75);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(...X(I), t.raioInscrito * p.esc, 0, Math.PI * 2); ctx.stroke();
      for (const v of [A, B, C]) seg(v, I, c.nat);
      ponto(I, c.nat, 'I');
    }
    if (mostrar.ortocentro && t.ortocentro) {
      for (const [u, v, op] of lados) {
        const pe = pePerpendicular(op, u, v);
        seg(op, pe, c.lin);
        // Prolonga o lado até o pé da altura (triângulo obtusângulo).
        seg(u, pe, alfa(c.lin, 0.4), 1);
      }
      ponto(t.ortocentro, c.lin, 'H');
    }
    if (euler && t.circuncentro && t.ortocentro) {
      const O = t.circuncentro;
      const H = t.ortocentro;
      const d: P2 = [H[0] - O[0], H[1] - O[1]];
      seg([O[0] - d[0] * 3, O[1] - d[1] * 3], [H[0] + d[0] * 3, H[1] + d[1] * 3], alfa(c.danger, 0.8), 1.5, false);
      ponto(O, c.hum, 'O');
      ponto(t.baricentro, c.mat, 'G');
      ponto(H, c.lin, 'H');
    }
    // Ângulos nos vértices.
    const ang = [t.angulos.A, t.angulos.B, t.angulos.C];
    pts.forEach((v, i) => {
      const [vx, vy] = X(v);
      const outros = pts.filter((_, k) => k !== i);
      const a1 = Math.atan2(-(outros[0][1] - v[1]), outros[0][0] - v[0]);
      const a2 = Math.atan2(-(outros[1][1] - v[1]), outros[1][0] - v[0]);
      let ini = a1;
      let fim = a2;
      if (((fim - ini + 2 * Math.PI) % (2 * Math.PI)) > Math.PI) [ini, fim] = [fim, ini];
      const reto = Math.abs(ang[i] - 90) < (grade ? 0.5 : 0.3);
      ctx.strokeStyle = reto ? c.danger : c.brand;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (reto) {
        const r = 12;
        ctx.moveTo(vx + Math.cos(ini) * r, vy + Math.sin(ini) * r);
        ctx.lineTo(vx + (Math.cos(ini) + Math.cos(fim)) * r, vy + (Math.sin(ini) + Math.sin(fim)) * r);
        ctx.lineTo(vx + Math.cos(fim) * r, vy + Math.sin(fim) * r);
      } else {
        ctx.arc(vx, vy, 20, ini, fim);
      }
      ctx.stroke();
      const bis = (ini + fim) / 2 + (((fim - ini + 2 * Math.PI) % (2 * Math.PI)) > Math.PI ? Math.PI : 0);
      texto(ctx, `${num(ang[i], 1)}°`, vx + Math.cos(bis) * 38, vy + Math.sin(bis) * 38 + 4, c.brand, { alinhar: 'center', tamanho: 11, peso: 700, mono: true });
      // Rótulo do vértice, para fora do triângulo.
      const fora: P2 = [v[0] - t.baricentro[0], v[1] - t.baricentro[1]];
      const L = Math.hypot(...fora) || 1;
      texto(ctx, NOMES[i], vx + (fora[0] / L) * 22, vy - (fora[1] / L) * 22 + 5, c.fg, { alinhar: 'center', tamanho: 14, peso: 800 });
      alca(ctx, vx, vy, c.brand, c, ativo === i);
    });
  };

  const { a, b, c } = t.lados;
  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Triângulo ${t.tipoLados} e ${t.tipoAngulos}`} proporcao={4 / 3} onPonteiro={onPonteiro} alturaMin={300} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Lados (a, b, c)', valor: `${num(a)} · ${num(b)} · ${num(c)}` },
              { rotulo: 'Soma dos ângulos', valor: `${num(t.angulos.A + t.angulos.B + t.angulos.C, 1)}°` },
              { rotulo: 'Classificação', valor: `${t.tipoLados}, ${t.tipoAngulos}` },
              { rotulo: 'Área', valor: num(t.area), nota: 'base × altura ÷ 2' },
              { rotulo: 'Perímetro', valor: num(t.perimetro) },
              { rotulo: 'Raio da circunscrita', valor: num(t.raioCircunscrito), nota: 'R = abc / 4·área' },
              { rotulo: 'Raio da inscrita', valor: num(t.raioInscrito), nota: 'r = área / semiperímetro' },
            ]}
          />
        }
        controles={
          <>
            <p className="text-xs text-muted text-pretty">Arraste os vértices A, B e C. Ligue os pontos notáveis e veja as retas que se cruzam neles.</p>
            {NOTAVEIS.map((n) => (
              <Alternar
                key={n.key}
                rotulo={`${n.nome} (${n.linhas})`}
                marcado={mostrar[n.key]}
                onChange={(v) => setMostrar({ ...mostrar, [n.key]: v })}
              />
            ))}
            <Alternar rotulo="Reta de Euler" marcado={euler} onChange={setEuler} dica="Circuncentro, baricentro e ortocentro sempre na mesma reta." />
            <Alternar rotulo="Quadrados nos lados (Pitágoras)" marcado={quadrados} onChange={setQuadrados} dica="Num triângulo retângulo, a área do quadrado maior é a soma das outras duas." />
            <Alternar rotulo="Grudar na grade" marcado={grade} onChange={setGrade} />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="btn btn-ghost" onClick={() => setPts([[-3, -2], [3, -2], [-3, 2.5]])}>
                Retângulo 3-4-5
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPts([[-3, -2], [3, -2], [0, -2 + 3 * Math.sqrt(3)]])}>
                Equilátero
              </button>
            </div>
          </>
        }
      />
      <Explicacao
        enem={'Cai identificar o ponto certo para uma situação: o **circuncentro** é equidistante dos três vértices (o lugar para um posto que atende três cidades), o **incentro** é equidistante dos três lados (o maior círculo que cabe no terreno) e o **baricentro** é o centro de equilíbrio (divide cada mediana na razão 2 : 1). Também caem a soma dos ângulos internos, o **teorema de Pitágoras** e as áreas.'}
      >
        {`Todo triângulo tem quatro **pontos notáveis**, cada um onde três retas especiais se cruzam:

- **Baricentro (G)**, encontro das **medianas** (do vértice ao meio do lado oposto). É o centro de massa e fica sempre dentro do triângulo, a 2/3 de cada vértice.
- **Circuncentro (O)**, encontro das **mediatrizes** dos lados. É o centro da circunferência que passa pelos três vértices; num triângulo retângulo cai no meio da hipotenusa, num obtusângulo fica fora.
- **Incentro (I)**, encontro das **bissetrizes** dos ângulos. É o centro da circunferência inscrita, que toca os três lados; fica sempre dentro.
- **Ortocentro (H)**, encontro das **alturas**. Num retângulo é o vértice do ângulo reto; num obtusângulo fica fora.

No **equilátero** os quatro coincidem. Nos outros, O, G e H ficam sempre alinhados, na **reta de Euler**. Arraste um vértice e confira que a soma dos ângulos não sai de 180°.`}
      </Explicacao>
    </div>
  );
}
