import { useRef, useState } from 'react';
import { amplitudeDados, desvioPadrao, media, mediana, modas, variancia } from '../../../lib/simulacoes/matematica';
import { alfa, texto } from '../canvas';
import { num } from '../plano';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Ponteiro, type Quadro } from '../ui';

const MIN = 0;
const MAX = 20;
const LIMITE = 24;

const CONJUNTOS: { nome: string; dados: number[] }[] = [
  { nome: 'Notas da turma', dados: [4, 5, 6, 6, 7, 7, 7, 8, 8, 9] },
  { nome: 'Com valor extremo', dados: [4, 5, 5, 6, 6, 7, 19] },
  { nome: 'Duas modas', dados: [3, 3, 3, 4, 9, 10, 10, 10] },
  { nome: 'Tudo igual', dados: [8, 8, 8, 8, 8] },
];

type Ferramenta = 'mover' | 'por' | 'tirar';

/** Geometria do gráfico de pontos: eixo embaixo, pontos empilhados por valor. */
function geo(w: number, h: number) {
  const x0 = 28;
  const x1 = w - 28;
  const eixo = h - 64;
  const r = Math.max(6, Math.min(11, (x1 - x0) / (MAX - MIN) / 2.4));
  return { x0, x1, eixo, r, X: (v: number) => x0 + ((v - MIN) / (MAX - MIN)) * (x1 - x0), V: (px: number) => MIN + ((px - x0) / (x1 - x0)) * (MAX - MIN) };
}

/** Altura de cada ponto na pilha do seu valor. */
function pilhas(dados: number[]) {
  const cont = new Map<number, number>();
  return dados.map((v) => {
    const k = cont.get(v) ?? 0;
    cont.set(v, k + 1);
    return k;
  });
}

export default function Estatistica() {
  const [dados, setDados] = useState<number[]>(CONJUNTOS[0].dados);
  const [ferramenta, setFerramenta] = useState<Ferramenta>('mover');
  const [desvios, setDesvios] = useState(false);
  const [meios, setMeios] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  const arrasto = useRef<number | null>(null);
  const grudar = (v: number) => Math.max(MIN, Math.min(MAX, meios ? Math.round(v * 2) / 2 : Math.round(v)));

  const maisPerto = (g: ReturnType<typeof geo>, x: number, y: number) => {
    const p = pilhas(dados);
    let melhor = -1;
    let d = 26;
    dados.forEach((v, i) => {
      const dist = Math.hypot(g.X(v) - x, g.eixo - g.r - 4 - p[i] * g.r * 2.2 - y);
      if (dist < d) {
        d = dist;
        melhor = i;
      }
    });
    return melhor;
  };

  const onPonteiro = (e: Ponteiro) => {
    const g = geo(e.w, e.h);
    if (e.tipo === 'up') {
      arrasto.current = null;
      setAtivo(null);
      return;
    }
    if (e.tipo === 'down') {
      const i = maisPerto(g, e.x, e.y);
      if (ferramenta === 'tirar') {
        if (i >= 0 && dados.length > 1) setDados(dados.filter((_, k) => k !== i));
        return;
      }
      if (ferramenta === 'por' || i < 0) {
        if (dados.length >= LIMITE || (ferramenta === 'mover' && i < 0)) return;
        setDados([...dados, grudar(g.V(e.x))]);
        arrasto.current = dados.length;
        setAtivo(dados.length);
        return;
      }
      arrasto.current = i;
      setAtivo(i);
      return;
    }
    const i = arrasto.current;
    if (i === null) return;
    const v = grudar(g.V(e.x));
    if (dados[i] !== v) setDados(dados.map((x, k) => (k === i ? v : x)));
  };

  const m = media(dados);
  const md = mediana(dados);
  const mo = modas(dados);
  const dp = desvioPadrao(dados);

  const quadro: Quadro = (ctx, w, h, _dt, c) => {
    const g = geo(w, h);
    // Faixa de um desvio padrão para cada lado da média.
    ctx.fillStyle = alfa(c.mat, 0.12);
    ctx.fillRect(g.X(Math.max(MIN, m - dp)), 16, g.X(Math.min(MAX, m + dp)) - g.X(Math.max(MIN, m - dp)), g.eixo - 16);
    // Eixo.
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(g.x0 - 8, g.eixo); ctx.lineTo(g.x1 + 8, g.eixo); ctx.stroke();
    for (let v = MIN; v <= MAX; v++) {
      ctx.beginPath(); ctx.moveTo(g.X(v), g.eixo); ctx.lineTo(g.X(v), g.eixo + (v % 5 ? 4 : 7)); ctx.stroke();
      if (v % 2 === 0) texto(ctx, String(v), g.X(v), g.eixo + 20, c.muted, { alinhar: 'center', tamanho: 10, mono: true });
    }
    // Média: o ponto de equilíbrio (o apoio de uma gangorra).
    ctx.fillStyle = c.mat;
    ctx.beginPath(); ctx.moveTo(g.X(m), g.eixo + 24); ctx.lineTo(g.X(m) - 9, g.eixo + 40); ctx.lineTo(g.X(m) + 9, g.eixo + 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.mat;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.X(m), 16); ctx.lineTo(g.X(m), g.eixo); ctx.stroke();
    texto(ctx, `média ${num(m)}`, g.X(m), g.eixo + 54, c.mat, { alinhar: 'center', tamanho: 11, peso: 700 });
    // Mediana.
    ctx.strokeStyle = c.hum;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(g.X(md), 16); ctx.lineTo(g.X(md), g.eixo); ctx.stroke();
    ctx.setLineDash([]);
    texto(ctx, `mediana ${num(md)}`, g.X(md), 12, c.hum, { alinhar: Math.abs(g.X(md) - g.X(m)) < 70 && md < m ? 'right' : Math.abs(g.X(md) - g.X(m)) < 70 ? 'left' : 'center', tamanho: 11, peso: 700 });
    // Pontos.
    const p = pilhas(dados);
    dados.forEach((v, i) => {
      const x = g.X(v);
      const y = g.eixo - g.r - 4 - p[i] * g.r * 2.2;
      if (desvios) {
        ctx.strokeStyle = alfa(c.danger, 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(g.X(m), y); ctx.lineTo(x, y); ctx.stroke();
      }
      const moda = mo.includes(v);
      ctx.fillStyle = moda ? c.brand : c.fg;
      ctx.beginPath(); ctx.arc(x, y, i === ativo ? g.r + 2 : g.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.surface;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    texto(ctx, `± 1 desvio padrão (${num(dp)})`, g.X(Math.min(MAX, m + dp)) - 6, 34, alfa(c.mat, 0.95), { alinhar: 'right', tamanho: 11, peso: 600 });
  };

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={<Palco2D quadro={quadro} rotulo={`Gráfico de pontos com ${dados.length} valores, média ${num(m)} e mediana ${num(md)}`} proporcao={16 / 10} onPonteiro={onPonteiro} alturaMin={280} />}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Valores', valor: String(dados.length), nota: [...dados].sort((a, b) => a - b).map((v) => num(v)).join(', ') },
              { rotulo: 'Média', valor: num(m), cor: 'var(--mat)', nota: 'soma dos valores ÷ quantidade' },
              { rotulo: 'Mediana', valor: num(md), cor: 'var(--hum)', nota: 'o valor do meio, com os dados em ordem' },
              { rotulo: 'Moda', valor: mo.length ? mo.map((v) => num(v)).join(' e ') : 'não tem', cor: 'var(--brand)', nota: 'o valor que mais se repete' },
              { rotulo: 'Amplitude', valor: num(amplitudeDados(dados)), nota: 'maior − menor' },
              { rotulo: 'Variância', valor: num(variancia(dados)), nota: 'média dos quadrados dos desvios' },
              { rotulo: 'Desvio padrão', valor: num(dp), nota: 'raiz quadrada da variância' },
            ]}
          />
        }
        controles={
          <>
            <Segmentos
              rotulo="Ao tocar no gráfico"
              valor={ferramenta}
              opcoes={[
                { valor: 'mover', rotulo: 'Arrastar' },
                { valor: 'por', rotulo: 'Pôr' },
                { valor: 'tirar', rotulo: 'Tirar' },
              ]}
              onChange={setFerramenta}
            />
            <p className="text-xs text-muted text-pretty">
              {ferramenta === 'mover' ? 'Arraste um ponto e veja a média andar junto; a mediana só muda quando o ponto cruza o meio.' : ferramenta === 'por' ? `Toque no eixo para pôr um valor (até ${LIMITE}).` : 'Toque num ponto para tirá-lo.'}
            </p>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Conjuntos prontos</p>
              <div className="flex flex-wrap gap-1.5">
                {CONJUNTOS.map((cj) => (
                  <button key={cj.nome} type="button" className="chip" onClick={() => setDados(cj.dados)}>
                    {cj.nome}
                  </button>
                ))}
              </div>
            </div>
            <Alternar rotulo="Mostrar os desvios" marcado={desvios} onChange={setDesvios} dica="A distância de cada ponto até a média. O desvio padrão resume o tamanho típico dessas distâncias." />
            <Alternar rotulo="Aceitar meios (0,5)" marcado={meios} onChange={setMeios} />
          </>
        }
      />
      <Explicacao
        enem={'É um dos temas mais cobrados: calcular **média, mediana e moda** de uma tabela ou gráfico e escolher a medida certa. Com valores extremos (um salário muito alto), a **mediana** representa melhor o grupo que a média. O **desvio padrão** mede a regularidade: entre dois atletas de mesma média, o de menor desvio é o mais regular.'}
      >
        {`As **medidas de tendência central** resumem um conjunto de dados num número só:

- **Média**: a soma dividida pela quantidade. É o **ponto de equilíbrio** dos dados (o triângulo sob o eixo): cada valor puxa a média na sua direção, e um valor extremo puxa muito.
- **Mediana**: o valor do meio com os dados em ordem (com quantidade par, a média dos dois do meio). Metade dos dados fica de cada lado, e um valor extremo quase não a move.
- **Moda**: o valor mais frequente (os pontos em rosa). Pode haver mais de uma, ou nenhuma.

As **medidas de dispersão** dizem o quanto os dados se espalham: a **amplitude** (maior menos menor), a **variância** (a média dos quadrados dos desvios) e o **desvio padrão** (a raiz da variância, na mesma unidade dos dados). A faixa azul marca um desvio padrão para cada lado da média.

Teste o conjunto "Com valor extremo": arraste o ponto de 19 para perto dos outros e veja a média voltar, enquanto a mediana quase não sai do lugar.`}
      </Explicacao>
    </div>
  );
}
