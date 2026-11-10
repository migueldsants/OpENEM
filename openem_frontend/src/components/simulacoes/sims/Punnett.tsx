import { useMemo, useRef, useState } from 'react';
import { cruzar, fenotipo, proporcao, type Gene } from '../../../lib/simulacoes/mais-modelos';
import { criarRng, fmt } from '../../../lib/simulacoes/numerico';
import { Explicacao, LayoutSim, Leituras, Segmentos } from '../ui';

const COR: Gene = { letra: 'A', dominante: 'amarela', recessivo: 'verde', dominancia: 'completa' };
const TEXTURA: Gene = { letra: 'B', dominante: 'lisa', recessivo: 'rugosa', dominancia: 'completa' };
const FLOR: Gene = { letra: 'V', dominante: 'vermelha', recessivo: 'branca', intermediario: 'rosa', dominancia: 'incompleta' };

type Modo = 'mono' | 'di' | 'incompleta';
const GENES: Record<Modo, Gene[]> = { mono: [COR], di: [COR, TEXTURA], incompleta: [FLOR] };

const TINTA: Record<string, string> = { amarela: '#facc15', verde: '#65a30d', vermelha: '#dc2626', rosa: '#f472b6', branca: '#f8fafc' };

/** Desenho do fenótipo: ervilha (cor + lisa/rugosa) ou flor. */
function Fenotipo({ genes, filho, tam = 26 }: { genes: Gene[]; filho: string[]; tam?: number }) {
  const fs = genes.map((g, i) => fenotipo(g, filho[i]));
  const cor = TINTA[fs[0]];
  if (genes[0].letra === 'V') {
    return (
      <svg width={tam} height={tam} viewBox="-12 -12 24 24" aria-label={`flor ${fs[0]}`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-6} rx={4.2} ry={6} fill={cor} stroke="rgba(0,0,0,0.35)" strokeWidth={0.6} transform={`rotate(${a})`} />
        ))}
        <circle r={3} fill="#facc15" />
      </svg>
    );
  }
  const rugosa = fs[1] === 'rugosa';
  const pts = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const r = 10 + (rugosa ? (i % 2 ? -1.6 : 0.8) : 0);
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
  return (
    <svg width={tam} height={tam} viewBox="-12 -12 24 24" aria-label={`ervilha ${fs.join(' e ')}`}>
      <polygon points={pts} fill={cor} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8} />
      <ellipse cx={-3} cy={-3.5} rx={3} ry={2} fill="rgba(255,255,255,0.45)" />
    </svg>
  );
}

const OPCOES = (g: Gene) => {
  const M = g.letra.toUpperCase();
  const m = g.letra.toLowerCase();
  return [M + M, M + m, m + m];
};

function Progenitor({ titulo, genes, valor, onChange }: { titulo: string; genes: Gene[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{titulo}</p>
      {genes.map((g, i) => (
        <div key={g.letra} className="flex items-center gap-2">
          <div className="seg flex flex-1" role="radiogroup" aria-label={`${titulo}: gene ${g.letra}`}>
            {OPCOES(g).map((o) => (
              <button key={o} type="button" role="radio" aria-checked={valor[i] === o} data-active={valor[i] === o} className="flex-1 font-data" onClick={() => onChange(valor.map((x, k) => (k === i ? o : x)))}>
                {o}
              </button>
            ))}
          </div>
          <span className="w-16 shrink-0 text-xs text-muted">{fenotipo(g, valor[i])}</span>
        </div>
      ))}
    </div>
  );
}

export default function Punnett() {
  const [modo, setModo] = useState<Modo>('mono');
  const [pai, setPai] = useState<Record<Modo, string[]>>({ mono: ['Aa'], di: ['Aa', 'Bb'], incompleta: ['Vv'] });
  const [mae, setMae] = useState<Record<Modo, string[]>>({ mono: ['Aa'], di: ['Aa', 'Bb'], incompleta: ['Vv'] });
  const [filhos, setFilhos] = useState<Record<string, number> | null>(null);
  const rng = useRef(criarRng(1866));
  const genes = GENES[modo];
  const r = useMemo(() => cruzar(genes, pai[modo], mae[modo]), [genes, pai, mae, modo]);
  const totalFilhos = filhos ? Object.values(filhos).reduce((s, x) => s + x, 0) : 0;

  const gerar = (n: number) => {
    const cont: Record<string, number> = { ...(filhos ?? {}) };
    const celulas = r.quadro.flat();
    for (let i = 0; i < n; i++) {
      // Sorteia um gameta de cada um (cada célula do quadro tem a mesma chance quando os gametas são equiprováveis).
      const gp = r.gametasPai[Math.floor(rng.current() * r.gametasPai.length)];
      const gm = r.gametasMae[Math.floor(rng.current() * r.gametasMae.length)];
      const cel = celulas.find((c) => c.linha.join() === gp.gameta.join() && c.coluna.join() === gm.gameta.join())!;
      const f = genes.map((g, k) => fenotipo(g, cel.filho[k])).join(', ');
      cont[f] = (cont[f] ?? 0) + 1;
    }
    setFilhos(cont);
  };
  const mudarModo = (m: Modo) => {
    setModo(m);
    setFilhos(null);
  };

  const palco = (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 overflow-auto rounded-xl bg-surface-2 p-4">
      <table className="border-separate border-spacing-1 text-center" aria-label="Quadro de Punnett">
        <thead>
          <tr>
            <th className="p-1 text-[11px] font-medium text-muted">
              ♂ \ ♀
            </th>
            {r.gametasMae.map((g) => (
              <th key={g.gameta.join()} scope="col" className="rounded-lg bg-[color-mix(in_oklab,var(--lin)_18%,transparent)] px-3 py-1.5 font-data text-base font-bold">
                {g.gameta.join('')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.quadro.map((linha, i) => (
            <tr key={i}>
              <th scope="row" className="rounded-lg bg-[color-mix(in_oklab,var(--mat)_18%,transparent)] px-3 py-1.5 font-data text-base font-bold">
                {r.gametasPai[i].gameta.join('')}
              </th>
              {linha.map((c, j) => (
                <td key={j} className={`rounded-lg border border-line bg-surface ${modo === 'di' ? 'px-1.5 py-1' : 'px-4 py-2'}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <Fenotipo genes={genes} filho={c.filho} tam={modo === 'di' ? 30 : 52} />
                    <span className={`font-data font-semibold ${modo === 'di' ? 'text-xs' : 'text-sm'}`}>{c.filho.join('')}</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex w-full max-w-lg flex-col gap-2 text-sm" aria-label="Proporção de fenótipos">
        {r.fenotipos.map((f) => (
          <li key={f.f} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate">{f.f}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
              <span className="block h-full rounded-full bg-[var(--nat)]" style={{ width: `${f.p * 100}%` }} />
            </span>
            <span className="w-12 shrink-0 text-right font-data">{fmt(f.p * 100, 1)}%</span>
            {filhos && <span className="w-16 shrink-0 text-right font-data text-muted">{filhos[f.f] ?? 0} filhos</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={palco}
        leituras={
          <Leituras
            itens={[
              { rotulo: 'Cruzamento', valor: `${pai[modo].join('')} × ${mae[modo].join('')}` },
              { rotulo: 'Gametas de cada um', valor: `${r.gametasPai.length} e ${r.gametasMae.length}` },
              { rotulo: 'Proporção genotípica', valor: proporcao(r.genotipos.map((g) => g.p)), nota: r.genotipos.map((g) => g.g).join(' : ') },
              { rotulo: 'Proporção fenotípica', valor: proporcao(r.fenotipos.map((f) => f.p)), nota: r.fenotipos.map((f) => f.f).join(' : ') },
              ...(filhos ? [{ rotulo: 'Filhos sorteados', valor: totalFilhos.toLocaleString('pt-BR') }] : []),
            ]}
          />
        }
        controles={
          <>
            <Segmentos
              rotulo="Cruzamento"
              valor={modo}
              opcoes={[
                { valor: 'mono', rotulo: '1 gene' },
                { valor: 'di', rotulo: '2 genes' },
                { valor: 'incompleta', rotulo: 'Incompleta' },
              ]}
              onChange={mudarModo}
            />
            <p className="text-xs text-muted text-pretty">
              {modo === 'incompleta'
                ? 'Flor maravilha: nenhum alelo domina, e o heterozigoto é rosa.'
                : modo === 'di'
                  ? 'As ervilhas de Mendel: cor (A amarela, a verde) e textura (B lisa, b rugosa).'
                  : 'Ervilhas de Mendel: A (amarela) domina a (verde).'}
            </p>
            <Progenitor titulo="Pai (♂)" genes={genes} valor={pai[modo]} onChange={(v) => { setPai({ ...pai, [modo]: v }); setFilhos(null); }} />
            <Progenitor titulo="Mãe (♀)" genes={genes} valor={mae[modo]} onChange={(v) => { setMae({ ...mae, [modo]: v }); setFilhos(null); }} />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="btn btn-primary" onClick={() => gerar(16)}>
                16 filhos
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => gerar(1000)}>
                1.000 filhos
              </button>
            </div>
            {filhos && (
              <button type="button" className="btn btn-ghost w-full" onClick={() => setFilhos(null)}>
                Zerar os filhos
              </button>
            )}
          </>
        }
      />
      <Explicacao
        enem={'Cai montar o cruzamento a partir do enunciado (quem é heterozigoto, quem é homozigoto recessivo), calcular a **probabilidade de um filho** com certo fenótipo e usar a **regra do "e"** (multiplica: genes independentes) e do **"ou"** (soma). O cruzamento-teste (com o homozigoto recessivo) revela se um indivíduo dominante é AA ou Aa.'}
      >
        {`Cada indivíduo tem **dois alelos** de cada gene, um vindo de cada genitor, e cada **gameta** leva só um (1ª lei de Mendel, da segregação). O **quadro de Punnett** cruza todos os gametas do pai (linhas) com todos os da mãe (colunas): cada casa é um filho possível, todos com a mesma chance.

**Aa × Aa** dá 1 AA : 2 Aa : 1 aa. Como A domina, 3 em cada 4 filhos mostram o dominante: a proporção **3 : 1**.

Com **dois genes** em cromossomos diferentes, eles se separam de forma independente (2ª lei): cada genitor AaBb faz 4 gametas e o quadro fica 4 × 4, com a proporção **9 : 3 : 3 : 1**.

Na **dominância incompleta**, o heterozigoto tem um fenótipo intermediário (a flor rosa), e as proporções de genótipo e fenótipo ficam iguais: 1 : 2 : 1.

Sorteie filhos e compare com o quadro: com poucos, a proporção sai torta; com muitos, chega perto da esperada.`}
      </Explicacao>
    </div>
  );
}
