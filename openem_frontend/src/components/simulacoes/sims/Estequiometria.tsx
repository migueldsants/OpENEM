import { useMemo, useRef, useState } from 'react';
import { massaParaConta } from '../../../lib/elementos';
import { balanceada, contarAtomos, escrever, massaMolarDe, menoresInteiros, REACOES, reagir, type Especie } from '../../../lib/simulacoes/estequiometria';
import { COR_ATOMO } from '../../../lib/simulacoes/moleculas';
import { fmt } from '../../../lib/simulacoes/numerico';
import { alfa, texto, usaMovimentoReduzido, type Cores } from '../canvas';
import { useDadosTabela } from '../dados';
import { Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, Seletor, type Quadro } from '../ui';

const COR_EXTRA: Record<string, string> = { Fe: '#b45309' };
const corDe = (el: string) => COR_ATOMO[el] ?? COR_EXTRA[el] ?? '#94a3b8';
const suave = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Átomos da espécie em ordem de desenho: os pesados numa fileira, os hidrogênios em volta. */
function atomosDe(esp: Especie): string[] {
  const lista = Object.entries(esp.atomos).flatMap(([el, n]) => Array.from({ length: n }, () => el));
  const pesados = lista.filter((x) => x !== 'H');
  return pesados.length ? [...pesados, ...lista.filter((x) => x === 'H')] : lista;
}

/** Uma molécula como um punhado de esferas; devolve a largura ocupada. */
function molecula(ctx: CanvasRenderingContext2D, esp: Especie, x: number, y: number, r: number, c: Cores, opacidade = 1) {
  const at = atomosDe(esp);
  const pesados = at.filter((a) => a !== 'H');
  const fileira = pesados.length ? pesados : at;
  const hs = pesados.length ? at.filter((a) => a === 'H') : [];
  const passo = r * 1.45;
  const x0 = x - ((fileira.length - 1) * passo) / 2;
  ctx.globalAlpha = opacidade;
  const bola = (bx: number, by: number, el: string, raio: number) => {
    ctx.fillStyle = corDe(el);
    ctx.beginPath(); ctx.arc(bx, by, raio, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = alfa(c.fg, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  hs.forEach((_, i) => {
    // Hidrogênios espalhados em volta da fileira.
    const ang = (Math.PI * 2 * i) / hs.length + Math.PI / 2 + (hs.length === 2 ? Math.PI / 5 : 0);
    const alvo = fileira.length === 1 ? 0 : i % fileira.length;
    bola(x0 + alvo * passo + Math.cos(ang) * r * 1.15, y + Math.sin(ang) * r * 1.15, 'H', r * 0.62);
  });
  fileira.forEach((el, i) => bola(x0 + i * passo, y, el, el === 'H' ? r * 0.7 : r));
  ctx.globalAlpha = 1;
}

function Passo({ rotulo, valor, onChange, min, max }: { rotulo: string; valor: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate font-data text-sm font-semibold">{rotulo}</span>
      <button type="button" className="btn btn-ghost px-3 py-1.5" onClick={() => onChange(valor - 1)} disabled={valor <= min} aria-label={`Diminuir ${rotulo}`}>
        −
      </button>
      <span className="w-8 text-center font-data text-base font-bold tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button type="button" className="btn btn-ghost px-3 py-1.5" onClick={() => onChange(valor + 1)} disabled={valor >= max} aria-label={`Aumentar ${rotulo}`}>
        +
      </button>
    </div>
  );
}

export default function Estequiometria() {
  const dados = useDadosTabela();
  const [key, setKey] = useState('agua');
  const [modo, setModo] = useState<'balancear' | 'reagir'>('balancear');
  const r = REACOES.find((x) => x.key === key)!;
  const nr = r.reagentes.length;
  const especies = [...r.reagentes, ...r.produtos];
  const [coefs, setCoefs] = useState<number[]>(() => especies.map(() => 1));
  const [qtd, setQtd] = useState<number[]>([4, 3]);
  const prog = useRef(0);
  const [reagindo, setReagindo] = useState(false);

  const massas = useMemo(() => Object.fromEntries((dados?.catalogo.elementos ?? []).map((e) => [e.simbolo, massaParaConta(e)])), [dados]);
  const ok = balanceada(r, coefs);
  const res = reagir(r, qtd);
  const escolher = (k: string) => {
    const nova = REACOES.find((x) => x.key === k)!;
    setKey(k);
    setCoefs([...nova.reagentes, ...nova.produtos].map(() => 1));
    setQtd(nova.coef.slice(0, nova.reagentes.length).map((c, i) => c * 2 + (i ? 1 : 0)));
    prog.current = 0;
    setReagindo(false);
  };
  const mudarQtd = (i: number, v: number) => {
    setQtd(qtd.map((q, k) => (k === i ? v : q)));
    prog.current = 0;
    setReagindo(false);
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    if (modo === 'balancear') {
      // A equação, com as moléculas de cada lado e a contagem de átomos embaixo.
      const meio = w / 2;
      const yMol = h * 0.3;
      const rBase = Math.max(7, Math.min(22, w / 40, h / 16));
      const lado = (esps: Especie[], cs: number[], x0: number, x1: number) => {
        const larg = (x1 - x0) / esps.length;
        esps.forEach((esp, i) => {
          const cx = x0 + larg * (i + 0.5);
          const n = cs[i];
          const cols = Math.min(n, 3);
          // A molécula cresce com o palco, mas as colunas precisam caber na fatia da espécie.
          const tam = Math.max(...Object.values(esp.atomos)) > 4 ? 0.8 : 1;
          const rAt = Math.min(rBase * tam, larg / (cols * 5.4), (h * 0.4) / (Math.ceil(n / cols) * 3.6));
          for (let k = 0; k < n; k++) {
            const col = k % cols;
            const lin = Math.floor(k / cols);
            molecula(ctx, esp, cx + (col - (cols - 1) / 2) * rAt * 5.2, yMol + (lin - (Math.ceil(n / cols) - 1) / 2) * rAt * 3.6, rAt, c);
          }
          texto(ctx, `${n === 1 ? '' : n} ${esp.formula}`.trim(), cx, h * 0.58, c.fg, { alinhar: 'center', tamanho: 16, peso: 800, mono: true });
          if (i < esps.length - 1) texto(ctx, '+', x0 + larg * (i + 1), h * 0.58, c.muted, { alinhar: 'center', tamanho: 16, peso: 700 });
        });
      };
      lado(r.reagentes, coefs.slice(0, nr), 12, meio - 26);
      lado(r.produtos, coefs.slice(nr), meio + 26, w - 12);
      texto(ctx, '→', meio, h * 0.58, ok ? c.nat : c.muted, { alinhar: 'center', tamanho: 22, peso: 800 });
      // Contagem de cada elemento dos dois lados.
      const a = contarAtomos(r.reagentes, coefs.slice(0, nr));
      const b = contarAtomos(r.produtos, coefs.slice(nr));
      const els = [...new Set([...Object.keys(a), ...Object.keys(b)])];
      const passo = Math.min(120, (w - 40) / els.length);
      els.forEach((el, i) => {
        const x = w / 2 + (i - (els.length - 1) / 2) * passo;
        const y = h * 0.82;
        const igual = a[el] === b[el];
        ctx.fillStyle = alfa(igual ? c.nat : c.danger, 0.14);
        ctx.strokeStyle = alfa(igual ? c.nat : c.danger, 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - passo / 2 + 6, y - 24, passo - 12, 44, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = corDe(el);
        ctx.beginPath(); ctx.arc(x - passo / 2 + 22, y - 2, 7, 0, Math.PI * 2); ctx.fill();
        texto(ctx, el, x - passo / 2 + 34, y + 3, c.fg, { tamanho: 13, peso: 800 });
        texto(ctx, `${a[el] ?? 0} ${igual ? '=' : '≠'} ${b[el] ?? 0}`, x + passo / 2 - 14, y + 3, igual ? c.nat : c.danger, { alinhar: 'right', tamanho: 14, peso: 800, mono: true });
      });
      texto(ctx, ok ? (menoresInteiros(coefs) ? 'Balanceada!' : 'Balanceada, mas dá para simplificar os coeficientes') : 'Os átomos de cada elemento precisam ser iguais dos dois lados', w / 2, h - 8, ok ? c.nat : c.muted, { alinhar: 'center', tamanho: 12, peso: 700 });
      return;
    }
    // Reagir: os reagentes à esquerda; depois, os produtos à direita e a sobra no lugar.
    if (reagindo) prog.current = Math.min(1, prog.current + dt / (usaMovimentoReduzido() ? 0.01 : 1.8));
    const p = prog.current;
    const some = suave(Math.min(1, p / 0.55));
    const surge = suave(Math.max(0, (p - 0.45) / 0.55));
    const rAt = Math.max(6, Math.min(15, w / 60, h / 28));
    const meio = w / 2;
    const zona = (x0: number, x1: number, titulo: string) => {
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x0, 26, x1 - x0, h - 38, 12); ctx.stroke();
      texto(ctx, titulo, (x0 + x1) / 2, 18, c.muted, { alinhar: 'center', tamanho: 11, peso: 700 });
    };
    zona(10, meio - 22, p < 1 ? 'Reagentes' : 'Sobrou');
    zona(meio + 22, w - 10, 'Produtos');
    texto(ctx, '→', meio, h / 2, p > 0 ? c.brand : c.muted, { alinhar: 'center', tamanho: 22, peso: 800 });
    const grade = (esps: Especie[], ns: number[], x0: number, x1: number, desenhar: (esp: Especie, x: number, y: number, k: number, i: number) => void) => {
      const larg = (x1 - x0) / esps.length;
      esps.forEach((esp, i) => {
        const cols = 3;
        const cx = x0 + larg * (i + 0.5);
        for (let k = 0; k < ns[i]; k++) {
          const x = cx + ((k % cols) - (cols - 1) / 2) * Math.min(rAt * 5, larg / 3.3);
          // A grade fica centrada na altura da zona.
          const linhas = Math.ceil(ns[i] / cols);
          const y = h / 2 + (Math.floor(k / cols) - (linhas - 1) / 2) * rAt * 3.7;
          desenhar(esp, x, y, k, i);
        }
        texto(ctx, esp.formula, cx, h - 20, c.fg, { alinhar: 'center', tamanho: 12, peso: 700, mono: true });
      });
    };
    grade(r.reagentes, qtd, 16, meio - 28, (esp, x, y, k, i) => {
      const consumida = k >= res.sobra[i];
      // As consumidas vão para o centro e somem; a sobra fica.
      if (consumida) molecula(ctx, esp, x + (meio - x) * some * 0.8, y + (h / 2 - y) * some * 0.8, rAt, c, 1 - some);
      else molecula(ctx, esp, x, y, rAt, c);
    });
    grade(r.produtos, res.produtos, meio + 28, w - 16, (esp, x, y) => {
      if (surge > 0) molecula(ctx, esp, meio + (x - meio) * surge, h / 2 + (y - h / 2) * surge, rAt, c, surge);
    });
  };

  const massa = (esp: Especie, n: number) => (dados ? `${fmt(n * massaMolarDe(esp, massas), 1)} g` : '–');

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco2D
            quadro={quadro}
            rotulo={modo === 'balancear' ? `Equação ${escrever(r, coefs)}, ${ok ? 'balanceada' : 'ainda não balanceada'}` : `Reação com ${qtd.map((q, i) => `${q} de ${r.reagentes[i].formula}`).join(' e ')}`}
            proporcao={16 / 10}
            alturaMin={300}
          />
        }
        leituras={
          <Leituras
            itens={
              modo === 'balancear'
                ? [
                    { rotulo: 'Equação', valor: escrever(r, coefs) },
                    { rotulo: 'Situação', valor: ok ? (menoresInteiros(coefs) ? 'balanceada' : 'balanceada, simplifique') : 'não balanceada', cor: ok ? 'var(--nat)' : 'var(--danger)' },
                    { rotulo: 'Resposta', valor: ok ? escrever(r, r.coef) : 'continue tentando', nota: 'os menores números inteiros' },
                  ]
                : [
                    { rotulo: 'Reagente limitante', valor: res.limitante === null ? (res.vezes ? 'nenhum (proporção exata)' : 'falta reagente') : r.reagentes[res.limitante].formula, cor: 'var(--danger)', nota: 'o que acaba primeiro' },
                    ...r.produtos.map((esp, j) => ({ rotulo: `${esp.formula} formado`, valor: `${res.produtos[j]} mol`, nota: massa(esp, res.produtos[j]) })),
                    ...r.reagentes.map((esp, i) => ({ rotulo: `Sobra de ${esp.formula}`, valor: `${res.sobra[i]} mol`, nota: massa(esp, res.sobra[i]) })),
                    { rotulo: 'Massa antes = depois', valor: dados ? `${fmt(r.reagentes.reduce((s, esp, i) => s + qtd[i] * massaMolarDe(esp, massas), 0), 1)} g` : '–', nota: 'lei de Lavoisier: nada se perde' },
                  ]
            }
          />
        }
        controles={
          <>
            <Seletor rotulo="Reação" valor={key} opcoes={REACOES.map((x) => ({ valor: x.key, rotulo: x.nome }))} onChange={escolher} />
            <Segmentos
              rotulo="Atividade"
              valor={modo}
              opcoes={[
                { valor: 'balancear', rotulo: 'Balancear' },
                { valor: 'reagir', rotulo: 'Reagir' },
              ]}
              onChange={setModo}
            />
            {modo === 'balancear' ? (
              <>
                <p className="text-xs text-muted text-pretty">Ajuste o coeficiente de cada substância até a contagem de todos os átomos fechar.</p>
                <div className="space-y-1.5 rounded-xl border border-line bg-surface-2 p-3">
                  {especies.map((esp, i) => (
                    <Passo key={`${esp.formula}${i}`} rotulo={esp.formula} valor={coefs[i]} min={1} max={9} onChange={(v) => setCoefs(coefs.map((x, k) => (k === i ? v : x)))} />
                  ))}
                </div>
                <button type="button" className="btn btn-ghost w-full" onClick={() => setCoefs(r.coef)}>
                  Mostrar a resposta
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted text-pretty">
                  Escolha quanto há de cada reagente (em mol) e veja quem acaba primeiro. A proporção da reação é {escrever(r, r.coef)}.
                </p>
                <div className="space-y-1.5 rounded-xl border border-line bg-surface-2 p-3">
                  {r.reagentes.map((esp, i) => (
                    <Passo key={esp.formula} rotulo={`${esp.formula} (mol)`} valor={qtd[i]} min={0} max={12} onChange={(v) => mudarQtd(i, v)} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" className="btn btn-primary" onClick={() => { prog.current = 0; setReagindo(true); }}>
                    Reagir
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { prog.current = 0; setReagindo(false); }}>
                    Voltar
                  </button>
                </div>
              </>
            )}
            <p className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-pretty">{r.contexto}</p>
          </>
        }
      />
      <Explicacao
        enem={'Estequiometria aparece em quase toda prova: **balancear** a equação, converter massa em mol pela massa molar, usar a **proporção dos coeficientes** e achar o **reagente limitante** (o que acaba primeiro e decide quanto produto se forma). Também caem pureza e rendimento, que entram como uma porcentagem em cima dessa conta.'}
      >
        {`Numa reação química os átomos só se rearranjam: nenhum some, nenhum aparece (**lei de Lavoisier**). Por isso a equação precisa estar **balanceada**: o mesmo número de átomos de cada elemento dos dois lados. Os números que se ajustam são os **coeficientes**, na frente das fórmulas; os índices dentro da fórmula não mudam, porque mudariam a substância.

Os coeficientes dão a **proporção em mol**: em $2\\,H_2 + O_2 \\rightarrow 2\\,H_2O$, cada 2 mol de hidrogênio reagem com 1 mol de oxigênio.

Na prática os reagentes quase nunca estão na proporção exata. O que acaba primeiro é o **reagente limitante**; o outro está **em excesso** e sobra. Para achar o limitante, divida a quantidade de cada reagente pelo seu coeficiente: o menor resultado manda.

As massas usam as massas atômicas da tabela periódica do OpENEM. Repare que a massa total antes e depois é a mesma.`}
      </Explicacao>
    </div>
  );
}
