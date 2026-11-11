import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { limparZero, PARAMETROS, tentarInterpretar, zeros, type Parametro, type Valores } from '../../../lib/simulacoes/expressao';
import { alfa, texto, type Cores } from '../canvas';
import { curva, desenharPlano, num, plano } from '../plano';
import { Alternar, Deslizador, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Ponteiro, type Quadro } from '../ui';

const NOMES = ['f', 'g', 'h'] as const;
const CORES: (keyof Pick<Cores, 'mat' | 'hum' | 'lin'>)[] = ['mat', 'hum', 'lin'];
const CHAVE = 'openem.funcoes.minhas';

const EXEMPLOS = ['x^2 - 2x - 3', 'a x^2 + b x + c', '2^x', 'log(x; 2)', 'sen(x) + x/2', '1/x', '|x| - 2', 'raiz(x)', 'x^3 - 3x', 'k·sen(x)'];

const JANELAS = [
  { valor: '3', rotulo: '±3' },
  { valor: '6', rotulo: '±6' },
  { valor: '12', rotulo: '±12' },
  { valor: '25', rotulo: '±25' },
] as const;

function lerSalvas(): [string, string, string] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (Array.isArray(v) && v.length === 3 && v.every((s) => typeof s === 'string')) return v.map((s: string) => s.slice(0, 80)) as [string, string, string];
  } catch {
    // Sem armazenamento (aba anônima, prévia): começa do exemplo.
  }
  return ['x^2 - 2x - 3', '', ''];
}

/** Máximos e mínimos locais: onde a inclinação troca de sinal, refinados por busca ternária. */
function extremos(f: (x: number) => number, x0: number, x1: number): { x: number; y: number; tipo: 'máx' | 'mín' }[] {
  const n = 1500;
  const dx = (x1 - x0) / n;
  const out: { x: number; y: number; tipo: 'máx' | 'mín' }[] = [];
  let ya = f(x0);
  let yb = f(x0 + dx);
  for (let i = 2; i <= n; i++) {
    const yc = f(x0 + i * dx);
    if ([ya, yb, yc].every(Number.isFinite)) {
      const max = yb > ya && yb > yc;
      const min = yb < ya && yb < yc;
      if (max || min) {
        let lo = x0 + (i - 2) * dx;
        let hi = x0 + i * dx;
        for (let k = 0; k < 60; k++) {
          const m1 = lo + (hi - lo) / 3;
          const m2 = hi - (hi - lo) / 3;
          if ((f(m1) < f(m2)) === max) lo = m1;
          else hi = m2;
        }
        const x = (lo + hi) / 2;
        const y = f(x);
        // Pico de assíntota (1/x perto de 0) não é extremo.
        if (Number.isFinite(y) && Math.abs(y) < 1e6) out.push({ x, y, tipo: max ? 'máx' : 'mín' });
      }
    }
    ya = yb;
    yb = yc;
  }
  return out;
}

export function MinhasFuncoes({ seletor }: { seletor: ReactNode }) {
  const [textos, setTextos] = useState<[string, string, string]>(lerSalvas);
  const [valores, setValores] = useState<Record<Parametro, number>>({ a: 1, b: -2, c: -3, d: 1, k: 2, m: 1, n: 1 });
  const [janela, setJanela] = useState<(typeof JANELAS)[number]['valor']>('6');
  const [sinal, setSinal] = useState(true);
  const [mira, setMira] = useState<number | null>(null);
  const id = useId();
  const meia = Number(janela);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(textos));
    } catch {
      // Sem armazenamento: as funções valem só nesta visita.
    }
  }, [textos]);

  const lidas = textos.map((t) => (t.trim() ? tentarInterpretar(t) : null));
  const funcoes = lidas.flatMap((r, i) => (r?.ok ? [{ nome: NOMES[i], cor: CORES[i], f: (x: number) => r.fn.f(x, valores as Valores), parametros: r.fn.parametros }] : []));
  const parametros = PARAMETROS.filter((p) => funcoes.some((f) => f.parametros.includes(p)));
  const f = funcoes.find((q) => q.nome === 'f');

  // Zeros, extremos e interseções de f, refeitos só quando muda o texto, um parâmetro ou a janela.
  const analise = useMemo(() => {
    const fs = textos.map((t) => {
      const r = t.trim() ? tentarInterpretar(t) : null;
      return r?.ok ? (x: number) => r.fn.f(x, valores as Valores) : null;
    });
    const ff = fs[0];
    if (!ff) return null;
    const a = meia * 1.7;
    return {
      zeros: zeros(ff, -a, a).map(limparZero),
      extremos: extremos(ff, -a, a).slice(0, 6),
      intersecoes: fs.flatMap((q, i) => (i > 0 && q ? [{ com: NOMES[i], xs: zeros((x) => ff(x) - q(x), -a, a).map(limparZero) }] : [])),
    };
  }, [textos, valores, meia]);

  const onPonteiro = (e: Ponteiro) => {
    if (e.tipo === 'up') return;
    setMira(plano(e.w, e.h, meia).x(e.x));
  };

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const p = plano(w, h, meia);
    desenharPlano(ctx, p, w, h, c, meia >= 12 ? 5 : 1);
    if (sinal && f) {
      for (let px = 0; px < w; px += 2) {
        const v = f.f(p.x(px));
        if (!Number.isFinite(v) || Math.abs(v) < 1e-9) continue;
        ctx.fillStyle = alfa(v > 0 ? c.nat : c.danger, 0.55);
        ctx.fillRect(px, p.Y(0) - 3, 2, 6);
      }
    }
    for (const q of funcoes) {
      curva(ctx, p, w, q.f, c[q.cor], 2.6);
      // Nome da curva perto da borda direita, onde ela ainda aparece.
      for (let px = w - 30; px > 30; px -= 6) {
        const y = q.f(p.x(px));
        const py = p.Y(y);
        if (Number.isFinite(y) && py > 14 && py < h - 14) {
          texto(ctx, q.nome, px + 6, py - 6, c[q.cor], { tamanho: 14, peso: 800, mono: true });
          break;
        }
      }
    }
    const marca = (x: number, y: number, cor: string, rotulo?: string) => {
      if (x < p.xMin || x > p.xMax || y < p.yMin || y > p.yMax) return;
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(p.X(x), p.Y(y), 4.5, 0, Math.PI * 2); ctx.fill();
      if (rotulo) texto(ctx, rotulo, p.X(x) + 7, p.Y(y) + 15, cor, { tamanho: 10, peso: 600 });
    };
    if (f && analise) {
      analise.zeros.forEach((x) => marca(x, 0, c.danger));
      analise.extremos.forEach((e) => marca(e.x, e.y, c.fg, e.tipo));
      analise.intersecoes.forEach((i) => i.xs.forEach((x) => marca(x, f.f(x), c.brand)));
    }
    if (mira !== null && funcoes.length) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = alfa(c.fg, 0.3);
      ctx.beginPath(); ctx.moveTo(p.X(mira), 0); ctx.lineTo(p.X(mira), h); ctx.stroke();
      ctx.setLineDash([]);
      const linhas = funcoes.map((q) => ({ q, y: q.f(mira) }));
      linhas.forEach(({ q, y }) => {
        if (!Number.isFinite(y)) return;
        ctx.fillStyle = c[q.cor];
        ctx.beginPath(); ctx.arc(p.X(mira), p.Y(y), 3.5, 0, Math.PI * 2); ctx.fill();
      });
      const textoMira = [`x = ${num(mira)}`, ...linhas.map(({ q, y }) => `${q.nome}(x) = ${Number.isFinite(y) ? num(y) : 'não existe'}`)];
      ctx.font = '600 12px JetBrains Mono Variable, monospace';
      const larg = Math.max(...textoMira.map((t) => ctx.measureText(t).width)) + 16;
      const bx = p.X(mira) + larg + 14 > w ? p.X(mira) - larg - 10 : p.X(mira) + 10;
      ctx.fillStyle = alfa(c.surface, 0.92);
      ctx.strokeStyle = c.line;
      ctx.beginPath(); ctx.roundRect(bx, 10, larg, 8 + textoMira.length * 17, 8); ctx.fill(); ctx.stroke();
      textoMira.forEach((t, i) => texto(ctx, t, bx + 8, 26 + i * 17, i === 0 ? c.muted : c[linhas[i - 1].q.cor], { tamanho: 12, mono: true, peso: 600 }));
    }
  };

  const lista = (xs: number[]) => (xs.length ? xs.slice(0, 5).map((x) => num(x)).join('; ') + (xs.length > 5 ? '…' : '') : 'nenhum na janela');
  const f0 = f ? f.f(0) : NaN;

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Gráfico de ${funcoes.map((q) => `${q.nome}(x)`).join(', ') || 'nenhuma função'}`} proporcao={4 / 3} onPonteiro={onPonteiro} alturaMin={300} />}
        leituras={
          <Leituras
            itens={
              f && analise
                ? [
                    { rotulo: 'f(0)', valor: Number.isFinite(f0) ? num(f0) : 'não existe', nota: 'onde corta o eixo y' },
                    { rotulo: 'Zeros de f', valor: lista(analise.zeros), cor: 'var(--danger)' },
                    { rotulo: 'Máx. e mín. locais', valor: analise.extremos.length ? analise.extremos.slice(0, 3).map((e) => `${e.tipo} (${num(e.x)}; ${num(e.y)})`).join(' · ') : 'nenhum na janela' },
                    ...analise.intersecoes.map((i) => ({ rotulo: `f = ${i.com} em x`, valor: lista(i.xs), cor: 'var(--brand)' })),
                  ]
                : [{ rotulo: 'f(x)', valor: 'digite uma função' }]
            }
          />
        }
        controles={
          <>
            {seletor}
            {textos.map((t, i) => {
              const r = lidas[i];
              const erro = r && !r.ok ? r.erro : null;
              return (
                <div key={i} className="space-y-1">
                  <label htmlFor={`${id}-${i}`} className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: `var(--${CORES[i]})` }} />
                    {NOMES[i]}(x) =
                  </label>
                  <input
                    id={`${id}-${i}`}
                    className="input font-data"
                    value={t}
                    maxLength={80}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={i === 0 ? 'ex.: x^2 - 4' : 'opcional, para comparar'}
                    aria-invalid={!!erro}
                    aria-describedby={erro ? `${id}-${i}-erro` : undefined}
                    onChange={(e) => setTextos(textos.map((x, k) => (k === i ? e.target.value : x)) as [string, string, string])}
                  />
                  {erro && (
                    <p id={`${id}-${i}-erro`} className="text-xs text-danger">
                      {erro}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Exemplos (vão para f):</p>
              <div className="flex flex-wrap gap-1">
                {EXEMPLOS.map((ex) => (
                  <button key={ex} type="button" className="chip font-data text-xs" onClick={() => setTextos([ex, textos[1], textos[2]])}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>
            {parametros.map((p) => (
              <Deslizador key={p} rotulo={`Parâmetro ${p}`} valor={valores[p]} min={-5} max={5} passo={0.1} onChange={(v) => setValores({ ...valores, [p]: v })} />
            ))}
            <Segmentos rotulo="Janela (x e y de)" valor={janela} opcoes={JANELAS} onChange={setJanela} />
            <Alternar rotulo="Estudo do sinal de f" marcado={sinal} onChange={setSinal} />
            <p className="text-xs text-muted text-pretty">
              Escreva com x e os parâmetros {PARAMETROS.join(', ')}. Vale 2x, x², x^3, (x+1)(x−1), |x|, raiz(x), sen, cos, tg, ln, log(x) (base 10), log(x; 2), exp, pi e e. Decimal com vírgula ou ponto.
            </p>
          </>
        }
      />
      <Explicacao
        enem={'Montar a função a partir do enunciado é metade da questão: "uma taxa fixa de 5 mais 2 por quilômetro" é $f(x) = 2x + 5$; "dobra a cada hora" é $f(x) = k \\cdot 2^x$. Desenhe as duas funções de um problema e a **interseção** é o ponto em que os dois planos custam o mesmo.'}
      >
        {`Digite qualquer função de $x$ e veja o gráfico. Com duas ou três funções juntas, a simulação acha onde elas se cruzam: é a solução da equação $f(x) = g(x)$.

**O que a simulação marca:**
- os **zeros** de $f$ (onde o gráfico corta o eixo $x$), que resolvem $f(x) = 0$;
- os **máximos e mínimos locais** (onde a curva para de subir e começa a descer, ou o contrário), como o vértice da parábola;
- as **interseções** de $f$ com $g$ e $h$.

**Parâmetros:** as letras $a, b, c, d, k, m, n$ viram controles deslizantes. Escreva $a x^2 + b x + c$ e mexa em cada um para ver o que ele faz: $a$ abre e fecha a parábola, $c$ sobe e desce, $b$ a empurra de lado.

Os zeros e extremos são achados numericamente (troca de sinal e bissecção), dentro da janela que está na tela. Passe o mouse ou o dedo pelo gráfico para ler o valor de cada função.`}
      </Explicacao>
    </div>
  );
}
