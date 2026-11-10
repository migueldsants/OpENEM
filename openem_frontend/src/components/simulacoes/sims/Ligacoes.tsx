import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { decimalBr, rotuloIon, type Elemento } from '../../../lib/elementos';
import {
  carateriIonico,
  cargasCation,
  DATIVAS,
  eletronsValencia,
  ligar,
  natureza,
  type Estrutura,
  type Resultado,
} from '../../../lib/simulacoes/ligacoes';
import { criarRng } from '../../../lib/simulacoes/numerico';
import { alfa, seta, texto, usaMovimentoReduzido, type Cores } from '../canvas';
import { useDadosTabela } from '../dados';
import { Alternar, Explicacao, LayoutSim, Leituras, Palco2D, Segmentos, type Quadro } from '../ui';

const PARES: [string, string, string][] = [
  ['NaCl', 'Na', 'Cl'],
  ['MgO', 'Mg', 'O'],
  ['CaF₂', 'Ca', 'F'],
  ['Al₂O₃', 'Al', 'O'],
  ['H₂O', 'H', 'O'],
  ['CO₂', 'C', 'O'],
  ['NH₃', 'N', 'H'],
  ['CH₄', 'C', 'H'],
  ['HCl', 'H', 'Cl'],
  ['N₂', 'N', 'N'],
  ['O₂', 'O', 'O'],
  ['Fe', 'Fe', 'Fe'],
  ['Latão', 'Cu', 'Zn'],
];

const NOME_TIPO: Record<Resultado['tipo'], string> = {
  ionica: 'iônica',
  'covalente-apolar': 'covalente apolar',
  'covalente-polar': 'covalente polar',
  metalica: 'metálica',
  nenhuma: 'não se ligam',
};

const facil = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** Posições dos 8 elétrons de valência de Lewis em volta do átomo (um por lado, depois os pares). */
function slotsLewis(r: number): [number, number][] {
  const d = r + 7;
  const s = 5;
  // Um em cada lado primeiro (cima, direita, baixo, esquerda), depois o par de cada lado.
  return [
    [-s, -d], [d, -s], [s, d], [-d, s],
    [s, -d], [d, s], [-s, d], [-d, -s],
  ];
}

function atomoDesenho(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, simbolo: string, fundo: string, c: Cores) {
  ctx.fillStyle = fundo;
  ctx.strokeStyle = alfa(c.fg, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  texto(ctx, simbolo, x, y + 6, c.fg, { alinhar: 'center', tamanho: Math.min(20, r * 0.9), peso: 800 });
}

function eletron(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
}

/** Estrutura de Lewis (ou estrutural) de uma molécula, com os átomos chegando juntos conforme `p`. */
function desenharMolecula(ctx: CanvasRenderingContext2D, est: Estrutura, w: number, h: number, p: number, c: Cores, opcoes: { lewis: boolean; dEN?: Record<string, number> }) {
  const xs = est.atomos.map((a) => a.x);
  const ys = est.atomos.map((a) => a.y);
  const larg = Math.max(...xs) - Math.min(...xs) + 2.4;
  const alt = Math.max(...ys) - Math.min(...ys) + 2.4;
  const esc = Math.min((w - 40) / larg, (h - 90) / alt, 90);
  const cx = w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * esc;
  const cy = (h - 40) / 2 + ((Math.max(...ys) + Math.min(...ys)) / 2) * esc;
  const afasta = 1 + 1.4 * (1 - facil(p));
  const P = est.atomos.map((a) => [cx + a.x * esc * afasta, cy - a.y * esc * afasta] as [number, number]);
  const r = Math.min(22, esc * 0.3);
  const cores = [c.mat, c.hum];
  const corDe = (el: string) => cores[est.atomos.findIndex((a) => a.el === el) === 0 ? 0 : 1];
  // Ligações: traços ou pares de elétrons entre os átomos.
  for (const l of est.ligacoes) {
    const [x1, y1] = P[l.a];
    const [x2, y2] = P[l.b];
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    for (let k = 0; k < l.ordem; k++) {
      const off = (k - (l.ordem - 1) / 2) * 8;
      const ox = -uy * off;
      const oy = ux * off;
      const dativa = l.dativa && k === l.ordem - 1;
      // A dativa aparece também no modo Lewis: a seta diz quem doou o par.
      if (opcoes.lewis && dativa && p >= 1) seta(ctx, x1 + ux * r + ox, y1 + uy * r + oy + 14, x2 - ux * r + ox, y2 - uy * r + oy + 14, alfa(c.brand, 0.8), 1.6);
      if (!opcoes.lewis || p < 1) {
        ctx.globalAlpha = opcoes.lewis ? 1 - facil(p) * 0.6 : Math.min(1, facil(p) * 1.4);
        if (dativa) seta(ctx, x1 + ux * r + ox, y1 + uy * r + oy, x2 - ux * r + ox, y2 - uy * r + oy, c.brand, 2.2);
        else {
          ctx.strokeStyle = c.fg;
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x1 + ux * r + ox, y1 + uy * r + oy); ctx.lineTo(x2 - ux * r + ox, y2 - uy * r + oy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (opcoes.lewis) {
        // O par compartilhado: na dativa os dois vêm do doador; nas outras, um de cada átomo.
        const mx = (x1 + x2) / 2 + ox;
        const my = (y1 + y2) / 2 + oy;
        const junto = facil(p);
        const ca = corDe(est.atomos[l.a].el);
        const cb = dativa ? ca : corDe(est.atomos[l.b].el);
        eletron(ctx, mx - ux * 4 * junto - ux * (1 - junto) * L * 0.25, my - uy * 4 * junto - uy * (1 - junto) * L * 0.25, ca);
        eletron(ctx, mx + ux * 4 * junto + ux * (1 - junto) * L * 0.25, my + uy * 4 * junto + uy * (1 - junto) * L * 0.25, cb);
      }
    }
  }
  est.atomos.forEach((a, i) => {
    const [x, y] = P[i];
    atomoDesenho(ctx, x, y, r, a.el, alfa(i === 0 ? c.mat : c.hum, 0.16), c);
    if (opcoes.lewis) {
      for (const ang of a.pares) {
        const t = (ang * Math.PI) / 180;
        const dx = Math.cos(t);
        const dy = -Math.sin(t);
        const d = r + 8;
        eletron(ctx, x + dx * d - dy * 4, y + dy * d + dx * 4, corDe(a.el));
        eletron(ctx, x + dx * d + dy * 4, y + dy * d - dx * 4, corDe(a.el));
      }
    } else {
      for (const ang of a.pares) {
        const t = (ang * Math.PI) / 180;
        ctx.strokeStyle = alfa(c.fg, 0.55);
        ctx.lineWidth = 2;
        const d = r + 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(t) * d + Math.sin(t) * 6, y - Math.sin(t) * d + Math.cos(t) * 6);
        ctx.lineTo(x + Math.cos(t) * d - Math.sin(t) * 6, y - Math.sin(t) * d - Math.cos(t) * 6);
        ctx.stroke();
      }
    }
    const delta = opcoes.dEN?.[`${i}`];
    if (delta && p > 0.9) texto(ctx, delta > 0 ? 'δ+' : 'δ−', x - r - 4, y - r + 2, delta > 0 ? c.danger : c.mat, { alinhar: 'right', tamanho: 13, peso: 800 });
  });
  if (est.atomos.some((a) => a.carga)) {
    // Colchetes do íon.
    const minx = Math.min(...P.map((q) => q[0])) - r - 18;
    const maxx = Math.max(...P.map((q) => q[0])) + r + 18;
    const miny = Math.min(...P.map((q) => q[1])) - r - 16;
    const maxy = Math.max(...P.map((q) => q[1])) + r + 16;
    ctx.strokeStyle = c.fg;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(minx + 8, miny); ctx.lineTo(minx, miny); ctx.lineTo(minx, maxy); ctx.lineTo(minx + 8, maxy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(maxx - 8, miny); ctx.lineTo(maxx, miny); ctx.lineTo(maxx, maxy); ctx.lineTo(maxx - 8, maxy); ctx.stroke();
    texto(ctx, '+', maxx + 4, miny + 10, c.fg, { tamanho: 18, peso: 800 });
  }
}

export default function Ligacoes() {
  const dados = useDadosTabela();
  const [modo, setModo] = useState<'par' | 'dativa'>('par');
  const [zA, setZA] = useState(11);
  const [zB, setZB] = useState(17);
  const [carga, setCarga] = useState<number | undefined>(undefined);
  const [dativa, setDativa] = useState(DATIVAS[0].key);
  const [lewis, setLewis] = useState(true);
  const prog = useRef(usaMovimentoReduzido() ? 1 : 0);
  const mar = useMemo(() => {
    const r = criarRng(4);
    return Array.from({ length: 60 }, () => ({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5 }));
  }, []);
  const t = useRef(0);

  if (!dados) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted" aria-busy>
        Carregando a tabela periódica…
      </div>
    );
  }
  const els = dados.catalogo.elementos;
  const A = els[zA - 1];
  const B = els[zB - 1];
  const metal = natureza(A) === 'metal' ? A : natureza(B) === 'metal' ? B : null;
  const opcoesCarga = metal && natureza(A) !== natureza(B) ? cargasCation(metal) : [];
  const r = ligar(A, B, { cargaCation: carga && opcoesCarga.includes(carga) ? carga : undefined });
  const ex = DATIVAS.find((d) => d.key === dativa)!;
  const recomecar = () => {
    prog.current = usaMovimentoReduzido() ? 1 : 0;
  };
  const escolherPar = (a: string, b: string) => {
    setZA(els.find((e) => e.simbolo === a)!.z);
    setZB(els.find((e) => e.simbolo === b)!.z);
    setCarga(undefined);
    recomecar();
  };

  const quadro: Quadro = (ctx, w, h, dt, c) => {
    prog.current = Math.min(1, prog.current + dt / 2.2);
    t.current += dt;
    const p = prog.current;
    const altura = h - 46;
    if (modo === 'dativa') {
      desenharMolecula(ctx, ex.estrutura, w, h, p, c, { lewis });
      texto(ctx, ex.formula, w / 2, h - 14, c.fg, { alinhar: 'center', tamanho: 16, peso: 800 });
      return;
    }
    if (r.tipo === 'ionica' && r.ions) {
      const { cation, anion } = r.ions;
      const M = A === metal ? A : B;
      const X = A === metal ? B : A;
      const vM = eletronsValencia(M) ?? cation.carga;
      const vX = eletronsValencia(X) ?? 8 + anion.carga;
      const rC = 24;
      const rA = 30;
      const junta = facil(Math.max(0, (p - 0.55) / 0.45));
      const colX = (k: number, total: number) => altura / 2 + (k - (total - 1) / 2) * Math.min(80, (altura - 40) / Math.max(1, total));
      const xC = w * (0.3 + 0.1 * junta);
      const xA = w * (0.7 - 0.1 * junta);
      const cats = Array.from({ length: cation.n }, (_, i) => [xC, colX(i, cation.n)] as [number, number]);
      const ans = Array.from({ length: anion.n }, (_, i) => [xA, colX(i, anion.n)] as [number, number]);
      // Elétrons que mudam de dono: cada cátion dá `carga`, cada ânion recebe |carga|.
      const transf: { de: [number, number]; para: [number, number] }[] = [];
      let alvo = 0;
      let recebidos = 0;
      cats.forEach(([x, y]) => {
        for (let k = 0; k < cation.carga; k++) {
          const slots = slotsLewis(rA);
          const [ax, ay] = ans[alvo];
          const s = slots[vX + recebidos];
          const sM = slotsLewis(rC)[k % 8];
          transf.push({ de: [x + sM[0], y + sM[1]], para: [ax + (s?.[0] ?? 0), ay + (s?.[1] ?? 0)] });
          recebidos++;
          if (recebidos >= -anion.carga) {
            alvo++;
            recebidos = 0;
          }
        }
      });
      const ida = facil(Math.min(1, p / 0.55));
      cats.forEach(([x, y]) => {
        atomoDesenho(ctx, x, y, rC, ida >= 1 ? rotuloIon(cation.simbolo, cation.carga) : cation.simbolo, alfa(c.mat, 0.16), c);
        // Elétrons de valência que ficam (os metais de transição podem ter mais que a carga).
        slotsLewis(rC).slice(cation.carga, Math.max(cation.carga, Math.min(vM, 8))).forEach(([sx, sy]) => eletron(ctx, x + sx, y + sy, alfa(c.mat, 0.4)));
      });
      ans.forEach(([x, y]) => {
        atomoDesenho(ctx, x, y, rA, ida >= 1 ? rotuloIon(anion.simbolo, anion.carga) : anion.simbolo, alfa(c.hum, 0.16), c);
        slotsLewis(rA).slice(0, vX).forEach(([sx, sy]) => eletron(ctx, x + sx, y + sy, c.hum));
      });
      transf.forEach(({ de, para }) => eletron(ctx, de[0] + (para[0] - de[0]) * ida, de[1] + (para[1] - de[1]) * ida + Math.sin(ida * Math.PI) * -30, c.mat));
      if (ida > 0 && ida < 1) seta(ctx, xC + rC + 14, altura / 2 - 50, xA - rA - 14, altura / 2 - 50, alfa(c.mat, 0.6), 2);
      if (junta > 0.3) texto(ctx, 'atração entre cargas opostas', w / 2, 22, c.fg, { alinhar: 'center', tamanho: 12, peso: 600 });
    } else if (r.tipo === 'metalica') {
      const cols = 6;
      const lins = 3;
      const esp = Math.min((w - 60) / cols, (altura - 30) / lins);
      const ox = (w - esp * (cols - 1)) / 2;
      const oy = (altura - esp * (lins - 1)) / 2;
      const solto = facil(p);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < lins; j++) {
          const el = (i + j) % 2 && A.z !== B.z ? B.simbolo : A.simbolo;
          atomoDesenho(ctx, ox + i * esp, oy + j * esp, esp * 0.3, `${el}⁺`, alfa(c.mat, 0.16), c);
        }
      }
      mar.forEach((m, k) => {
        const i = k % cols;
        const j = Math.floor(k / cols) % lins;
        const presoX = ox + i * esp + Math.cos(k) * esp * 0.38;
        const presoY = oy + j * esp + Math.sin(k) * esp * 0.38;
        const q = (v: number) => {
          const u = ((v % 2) + 2) % 2;
          return u < 1 ? u : 2 - u;
        };
        const livreX = ox - esp * 0.4 + q(m.x + m.vx * t.current * 0.25) * esp * (cols - 0.2);
        const livreY = oy - esp * 0.4 + q(m.y + m.vy * t.current * 0.25) * esp * (lins - 0.2);
        eletron(ctx, presoX + (livreX - presoX) * solto, presoY + (livreY - presoY) * solto, c.hum);
      });
      if (p > 0.6) texto(ctx, 'mar de elétrons livres', w / 2, 22, c.hum, { alinhar: 'center', tamanho: 12, peso: 600 });
    } else if (r.estrutura) {
      // δ+ no menos eletronegativo quando a ligação é polar.
      const dEN: Record<string, number> = {};
      if (r.tipo === 'covalente-polar' && A.eletronegatividade && B.eletronegatividade) {
        const centralEl = r.estrutura.atomos[0].el;
        const outro = r.estrutura.atomos[1]?.el;
        const en = (s: string) => (s === A.simbolo ? A.eletronegatividade!.valor : B.eletronegatividade!.valor);
        r.estrutura.atomos.forEach((a, i) => {
          if (outro) dEN[`${i}`] = a.el === centralEl ? Math.sign(en(outro) - en(centralEl)) : Math.sign(en(centralEl) - en(a.el));
        });
      }
      desenharMolecula(ctx, r.estrutura, w, altura + 20, p, c, { lewis, dEN });
    } else {
      // Sem molécula para desenhar: os dois átomos com os elétrons de valência.
      [A, B].forEach((e, i) => {
        const x = w * (i ? 0.66 : 0.34);
        atomoDesenho(ctx, x, altura / 2, 30, e.simbolo, alfa(i ? c.hum : c.mat, 0.16), c);
        slotsLewis(30).slice(0, Math.min(8, eletronsValencia(e) ?? 0)).forEach(([sx, sy]) => eletron(ctx, x + sx, altura / 2 + sy, i ? c.hum : c.mat));
      });
    }
    // Régua da diferença de eletronegatividade.
    if (r.dEN !== null) {
      const x0 = 30;
      const x1 = w - 30;
      const y = h - 18;
      const X = (v: number) => x0 + (Math.min(v, 3.5) / 3.5) * (x1 - x0);
      const faixas: [number, number, string, string][] = [
        [0, 0.4, c.nat, 'apolar'],
        [0.4, 1.7, c.hum, 'polar'],
        [1.7, 3.5, c.danger, 'iônica'],
      ];
      for (const [a, b, cor, nome] of faixas) {
        ctx.fillStyle = alfa(cor, 0.35);
        ctx.fillRect(X(a), y - 4, X(b) - X(a), 8);
        texto(ctx, nome, (X(a) + X(b)) / 2, y - 9, cor, { alinhar: 'center', tamanho: 10, peso: 600 });
      }
      ctx.fillStyle = c.fg;
      ctx.beginPath(); ctx.moveTo(X(r.dEN), y - 7); ctx.lineTo(X(r.dEN) - 5, y - 15); ctx.lineTo(X(r.dEN) + 5, y - 15); ctx.closePath(); ctx.fill();
      texto(ctx, `Δ = ${decimalBr(r.dEN.toFixed(2))}`, X(r.dEN), y + 15 > h ? h - 1 : y + 15, c.fg, { alinhar: 'center', tamanho: 10, mono: true, peso: 700 });
    }
  };

  const opcaoEl = (e: Elemento) => (
    <option key={e.z} value={e.z}>
      {e.simbolo} · {e.nome}
      {e.eletronegatividade ? ` (${decimalBr(String(e.eletronegatividade.valor))})` : ''}
    </option>
  );

  return (
    <div className="lg:h-full">
      <LayoutSim
        palco={
          <Palco2D
            quadro={quadro}
            rotulo={modo === 'dativa' ? `Ligação dativa no ${ex.nome}` : `Ligação ${NOME_TIPO[r.tipo]} entre ${A.nome} e ${B.nome}: ${r.formula}`}
            proporcao={16 / 11}
            alturaMin={300}
          />
        }
        leituras={
          <Leituras
            itens={
              modo === 'dativa'
                ? [
                    { rotulo: 'Espécie', valor: `${ex.formula} · ${ex.nome}` },
                    { rotulo: 'Ligação', valor: 'covalente dativa (coordenada)', nota: 'o par vem inteiro de um átomo só' },
                  ]
                : [
                    { rotulo: 'Ligação', valor: NOME_TIPO[r.tipo] },
                    { rotulo: 'Fórmula', valor: r.formula },
                    { rotulo: 'Δ eletronegatividade', valor: r.dEN === null ? '–' : decimalBr(r.dEN.toFixed(2)), nota: 'escala de Pauling, da tabela periódica' },
                    ...(r.dEN !== null && r.tipo !== 'metalica' && r.tipo !== 'nenhuma' ? [{ rotulo: 'Caráter iônico', valor: `${Math.round(carateriIonico(r.dEN) * 100)}%`, nota: 'estimativa de Pauling: 1 − e^(−Δ²/4)' }] : []),
                    ...(r.geometria ? [{ rotulo: 'Geometria', valor: r.geometria }] : []),
                    ...(r.molecula ? [{ rotulo: 'Molécula', valor: r.molecula, cor: r.molecula === 'polar' ? 'var(--danger)' : 'var(--nat)' }] : []),
                    ...(r.ions ? [{ rotulo: 'Íons', valor: `${r.ions.cation.n} ${rotuloIon(r.ions.cation.simbolo, r.ions.cation.carga)} + ${r.ions.anion.n} ${rotuloIon(r.ions.anion.simbolo, r.ions.anion.carga)}` }] : []),
                  ]
            }
          />
        }
        rotuloExtra="O que acontece"
        extra={
          <div className="space-y-3 text-sm">
            <p className="text-pretty">{modo === 'dativa' ? ex.texto : r.explicacao}</p>
            {modo === 'par' && (
              <p className="text-xs text-muted text-pretty">
                Eletronegatividades da <Link to={`/tabela-periodica?z=${A.z}`} className="font-semibold underline">tabela periódica do OpENEM</Link> (PubChem, escala de Pauling). A classificação usa a natureza dos elementos (metal, ametal) e a diferença de eletronegatividade; é a regra da escola, e há casos intermediários (o AlCl₃ tem muito de covalente).
              </p>
            )}
          </div>
        }
        controles={
          <>
            <Segmentos
              rotulo="Ver"
              valor={modo}
              opcoes={[
                { valor: 'par', rotulo: 'Dois elementos' },
                { valor: 'dativa', rotulo: 'Ligação dativa' },
              ]}
              onChange={(v) => {
                setModo(v);
                recomecar();
              }}
            />
            {modo === 'par' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['lig-a', 'Elemento 1', zA, setZA],
                    ['lig-b', 'Elemento 2', zB, setZB],
                  ].map(([id, rot, val, set]) => (
                    <div key={id as string} className="space-y-1">
                      <label htmlFor={id as string} className="text-sm font-medium">
                        {rot as string}
                      </label>
                      <select
                        id={id as string}
                        className="input"
                        value={val as number}
                        onChange={(e) => {
                          (set as (z: number) => void)(Number(e.target.value));
                          setCarga(undefined);
                          recomecar();
                        }}
                      >
                        {els.map(opcaoEl)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Pares para começar</p>
                  <div className="flex flex-wrap gap-1">
                    {PARES.map(([rot, a, b]) => (
                      <button key={rot} type="button" className="chip text-xs" data-active={A.simbolo === a && B.simbolo === b} onClick={() => escolherPar(a, b)}>
                        {rot}
                      </button>
                    ))}
                  </div>
                </div>
                {opcoesCarga.length > 1 && metal && (
                  <Segmentos
                    rotulo={`Íon do ${metal.nome.toLowerCase()}`}
                    valor={String(carga && opcoesCarga.includes(carga) ? carga : opcoesCarga[0])}
                    opcoes={opcoesCarga.map((q) => ({ valor: String(q), rotulo: rotuloIon(metal.simbolo, q) }))}
                    onChange={(v) => {
                      setCarga(Number(v));
                      recomecar();
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Exemplo">
                {DATIVAS.map((d) => (
                  <button key={d.key} type="button" role="radio" aria-checked={dativa === d.key} data-active={dativa === d.key} className="chip" onClick={() => { setDativa(d.key); recomecar(); }}>
                    {d.formula}
                  </button>
                ))}
              </div>
            )}
            <Alternar rotulo="Mostrar os elétrons (Lewis)" marcado={lewis} onChange={setLewis} dica="Desligado, as ligações viram traços (fórmula estrutural)." />
            <button type="button" className="btn btn-primary w-full" onClick={recomecar}>
              Formar a ligação de novo
            </button>
          </>
        }
      />
      <Explicacao
        enem={'O ENEM pede para reconhecer o tipo de ligação pelas **propriedades**: compostos iônicos têm ponto de fusão alto e conduzem corrente só fundidos ou em solução; metais conduzem no estado sólido e são maleáveis; substâncias moleculares têm pontos de fusão baixos e não conduzem. Também cai a **polaridade** (que decide a solubilidade: "semelhante dissolve semelhante") e a fórmula de um composto iônico pelas cargas dos íons.'}
      >
        {`Os átomos se ligam para ficar mais estáveis, em geral com 8 elétrons na última camada (a **regra do octeto**; 2 no hidrogênio). Há três jeitos:

**Iônica** (metal com ametal): o metal tem poucos elétrons de valência e baixa eletronegatividade; ele **perde** elétrons e vira cátion. O ametal **ganha** e vira ânion. Os íons de cargas opostas se atraem e formam um retículo cristalino; a fórmula (NaCl, MgCl₂, Al₂O₃) é a proporção que deixa o total neutro.

**Covalente** (ametal com ametal ou hidrogênio): nenhum dos dois cede; eles **compartilham** pares de elétrons. Um par é uma ligação simples, dois são uma dupla, três uma tripla. Se as eletronegatividades forem diferentes, os elétrons ficam mais perto do mais eletronegativo e a ligação é **polar** (δ+ e δ−). A **dativa** é a covalente em que o par inteiro vem de um átomo só.

**Metálica** (metal com metal): os átomos perdem os elétrons de valência para um **mar de elétrons** livres que mantém os cátions juntos. É por isso que os metais conduzem eletricidade e são maleáveis.

Escolha dois elementos quaisquer da tabela periódica e veja qual ligação eles fazem, a fórmula e a estrutura. A régua embaixo mostra a diferença de eletronegatividade.`}
      </Explicacao>
    </div>
  );
}
