// Organiza os blocos despejados (paginas/<id>.json) em tema + textos
// motivadores e grava o catálogo usado pelo app:
//   openem_frontend/src/data/redacoes.json  (temas, textos, fontes)
//   openem_frontend/public/redacoes/*.webp  (charges, gráficos, infográficos)
//
// O texto sai sempre do PDF, nunca digitado: o roteiro (roteiro/*.json) só diz
// onde fica cada coisa quando a leitura automática não acerta sozinha.
//
//   node redacao/montar.mjs            grava tudo
//   node redacao/montar.mjs --ver ID   mostra o rascunho de um caderno
import * as mupdf from 'mupdf';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const raiz = join(aqui, '..', '..', '..');
const fontes = JSON.parse(readFileSync(join(aqui, 'fontes.json'), 'utf8'));
// O roteiro fica em lotes (roteiro/*.json), juntados aqui.
const roteiro = {};
for (const a of readdirSync(join(aqui, 'roteiro')).sort()) {
  for (const [id, spec] of Object.entries(JSON.parse(readFileSync(join(aqui, 'roteiro', a), 'utf8')))) roteiro[id] = { ...roteiro[id], ...spec };
}
const ver = process.argv.includes('--ver') ? process.argv[process.argv.indexOf('--ver') + 1] : null;

const ROTULO = /^\s*TEXTO\s+([IVX]+|\d+)\s*$/i;
const PROPOSTA = /^\s*PROPOSTA DE REDA[ÇC][ÃA]O\s*$/i;
const INSTRUCOES = /^\s*(INSTRU[ÇC][ÕO]ES( PARA A REDA[ÇC][ÃA]O)?|OBSERVA[ÇC][ÕO]ES)\s*:?\s*$/i;
const TEXTOS_MOTIVADORES = /^\s*TEXTOS MOTIVADORES\s*$/i;

/** Lixo de página: código de barras, rodapé do caderno, número solto. */
const LIXO = [/^\*\w+\*$/, /CADERNO\s+\d+\s*[•·\-–|]/i, /[•·]\s*\dº\s*DIA\s*[•·]/i, /^\s*(LC|CH|CN|MT)\s*[-–]\s*\dº dia/i, /^P[áa]gina\s+\d+$/i, /^\d{1,3}$/, /^ENEM\s*\d{4}$/i, /^(ENEM\s?\d{4}\s*){3,}/i, /LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS/i, /^RASCUNHO$/i, /^DA REDAÇÃO$/i];
const lixo = (t) => LIXO.some((r) => r.test(t.trim()));

/**
 * Figura do roteiro → { p, box }. Aceita a caixa pronta ou "entre": [a, b] —
 * o espaço entre o fim do bloco a e o começo do bloco b, na largura da coluna.
 */
function resolverFigura(f, blocos) {
  if (f.box) return f;
  const [a, b] = f.entre.map((i) => blocos[i]);
  const pag = blocos.find((x) => x.tipo === 'pagina' && x.p === a.p);
  const W = pag.box[2];
  const cx = ((a.box[0] + a.box[2]) / 2 + (b.box[0] + b.box[2]) / 2) / 2;
  const largos = a.box[2] - a.box[0] > W * 0.6 && b.box[2] - b.box[0] > W * 0.6;
  const esq = cx < W / 2;
  const col = blocos.filter((x) => x.p === a.p && x.tipo !== 'pagina' && x.box[2] - x.box[0] < W * 0.6 && (esq ? x.box[2] < W / 2 + 6 : x.box[0] > W / 2 - 6));
  const x0 = f.x ? f.x[0] : largos || !col.length ? Math.min(a.box[0], b.box[0]) : Math.min(...col.map((x) => x.box[0]));
  const x1 = f.x ? f.x[1] : largos || !col.length ? Math.max(a.box[2], b.box[2]) : Math.max(...col.map((x) => x.box[2]));
  const folga = (bl) => (bl.linhas ? bl.linhas[bl.linhas.length - 1].size * 0.35 : 0);
  return { ...f, p: a.p, box: [x0, a.box[3] + folga(a) + (f.dy0 || 0), x1, b.box[1] - folga(b) + (f.dy1 || 0)] };
}

const dentro = (box, x, y) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];

// Negrito e itálico viajam dentro do texto como marcadores de uso privado,
// para sobreviver à junção de linhas: \uE001 abre negrito, \uE002 itálico,
// \uE003 os dois; \uE000 fecha. No fim viram `partes`.
const ABRE = ['', '\uE001', '\uE002', '\uE003'];
const FECHA = '\uE000';
const MARCAS = /[\uE000-\uE003]/g;

/** Linha com os marcadores de estilo (os espaços ficam fora do trecho marcado). */
function marcada(l) {
  if (!l.r) return l.t;
  return l.r
    .map(([t, k]) => {
      if (!k || !t.trim()) return t;
      const [, ini, meio, fim] = t.match(/^(\s*)([\s\S]*?)(\s*)$/);
      return ini + ABRE[k] + meio + FECHA + fim;
    })
    .join('');
}

/** Texto com marcadores → partes { t, b?, i? }; `null` se não há estilo. */
export function partesDe(texto) {
  // Trecho que fecha e reabre no mesmo estilo (quebra de linha) é um só.
  const s = texto.replace(/\uE000(\s*)([\uE001-\uE003])/g, (m, esp, abre, i, tudo) => {
    const antes = tudo.slice(0, i).match(/[\uE001-\uE003](?=[^\uE000-\uE003]*$)/);
    return antes && antes[0] === abre ? esp : m;
  });
  if (!/[\uE001-\uE003]/.test(s)) return null;
  const partes = [];
  let k = 0;
  for (const pedaco of s.split(/([\uE000-\uE003])/)) {
    if (pedaco === FECHA) k = 0;
    else if (ABRE.includes(pedaco) && pedaco) k = ABRE.indexOf(pedaco);
    else if (pedaco) partes.push({ t: pedaco, ...(k & 1 ? { b: true } : {}), ...(k & 2 ? { i: true } : {}) });
  }
  return partes;
}
const semMarcas = (s) => s.replace(MARCAS, '');

/** Junta linhas num parágrafo, desfazendo a hifenização de fim de linha. */
export function juntar(linhas) {
  let out = '';
  for (const bruto of linhas) {
    const l = bruto.replace(/\s+/g, ' ').trim();
    if (!l) continue;
    if (!out) out = l;
    else if (/[a-záéíóúâêôãõç]-[\uE000-\uE003]*$/i.test(out) && /^[\uE000-\uE003]*[a-záéíóúâêôãõç]/.test(l)) {
      // Hífen no fim da linha: quase sempre é só a quebra, mas pode ser o hífen
      // de uma palavra composta. Os compostos ficam em hifens.json, conferidos
      // um a um contra a página; toda junção é registrada para essa conferência.
      const composto = semMarcas(`${out.match(/[^\s]*$/)[0]}${l.match(/^[^\s]*/)[0]}`);
      JUNCOES.add(composto);
      out = HIFENS.has(composto) ? out + l : out.replace(/-([\uE000-\uE003]*)$/, '$1') + l;
    }
    else out += ' ' + l;
  }
  return out
    .replace(/([A-Za-zÀ-ú]*f[il]) (?=[a-zà-ú]+)/g, (m, a, i, tudo) => {
      if (!LIGADURA) return m;
      LIGADURAS.add(a + tudo.slice(i + m.length).match(/^[a-zà-ú]*/)[0]);
      return a;
    })
    .trim();
}
let LIGADURA = false;
/** Toda palavra que foi quebrada por hífen no fim de uma linha (com o hífen). */
export const JUNCOES = new Set();
export const LIGADURAS = new Set();
const HIFENS = new Set(JSON.parse(readFileSync(new URL('./hifens.json', import.meta.url), 'utf8')));

/** Começo de referência: daqui até o próximo rótulo, tudo é fonte. */
const FONTE_INI = /^(Dispon[íi]vel em|Fonte:|Foto:|Acesso em|[A-ZÀ-Ú][A-ZÀ-Ú'’\-]+(?: [A-ZÀ-Ú]{2,})*,\s+(?:[A-Z]\.|[A-Z][a-zà-ú]+ ))/;
const CABECALHO = (t) => PROPOSTA.test(t) || INSTRUCOES.test(t) || TEXTOS_MOTIVADORES.test(t);

/**
 * Ordem de leitura da página: o que ocupa a largura toda antes do primeiro
 * "TEXTO I", depois a coluna esquerda, a direita e, por fim, o que ocupa a
 * largura toda no pé (em geral a proposta).
 */
function ordenar(itens) {
  const rot = itens.filter((l) => !l.fig && ROTULO.test(l.t.trim()));
  const yRot = rot.length ? Math.min(...rot.map((l) => l.y)) : Infinity;
  const faixa = (l) => (l.larga ? (l.y < yRot ? 0 : 3) : l.col + 1);
  return itens.sort((a, b) => faixa(a) - faixa(b) || a.y - b.y || a.x - b.x);
}

function itensDaPagina(blocos, pag, figuras, ignorar) {
  const p = pag.p;
  const W = pag.box[2];
  const itens = [];
  for (const b of blocos.filter((x) => x.p === p && x.tipo === 'txt' && !ignorar.has(x.i))) {
    const blocoLargo = b.box[2] - b.box[0] > W * 0.6;
    const alt = (b.box[3] - b.box[1]) / b.linhas.length;
    const cx = (b.box[0] + b.box[2]) / 2;
    b.linhas.forEach((l, k) => {
      if (!l.t.trim() || lixo(l.t)) return;
      if (figuras.some((f) => f.p === p && dentro(f.box, Math.max(l.x, b.box[0]) + 2, l.y + alt / 2))) return;
      const larga = blocoLargo || CABECALHO(l.t.trim());
      itens.push({ ...l, b: b.i, k, larga, col: cx < W / 2 ? 0 : 1, x0: b.box[0], alt });
    });
  }
  for (const f of figuras.filter((x) => x.p === p)) {
    itens.push({ fig: f, y: f.box[1], x: f.box[0], larga: f.box[2] - f.box[0] > W * 0.6, col: (f.box[0] + f.box[2]) / 2 < W / 2 ? 0 : 1 });
  }
  return ordenar(itens);
}

function montarAuto(id, blocos, spec) {
  const figuras = (spec.figuras || []).map((f) => resolverFigura(f, blocos));
  const ignorar = new Set(spec.ignorar || []);
  const paginas = blocos.filter((b) => b.tipo === 'pagina');
  // Imagens embutidas viram figura sozinhas, a não ser que o roteiro já cubra.
  for (const b of blocos.filter((x) => x.tipo === 'img' && !ignorar.has(x.i))) {
    const w = b.box[2] - b.box[0];
    const h = b.box[3] - b.box[1];
    if (w < 45 || h < 45 || spec.semImagens) continue;
    const pag = paginas.find((x) => x.p === b.p);
    if (w > pag.box[2] * 0.9 && h > pag.box[3] * 0.9) continue; // fundo da página
    const cx = (b.box[0] + b.box[2]) / 2;
    const cy = (b.box[1] + b.box[3]) / 2;
    if (figuras.some((f) => f.p === b.p && dentro(f.box, cx, cy))) continue;
    figuras.push({ p: b.p, box: b.box, alt: (spec.alts || {})[b.i] || '', auto: b.i });
  }

  const textos = [];
  let atual = null;
  let modo = 'pre';
  const proposta = [];
  for (const pag of paginas) {
    const itens = itensDaPagina(blocos, pag, figuras, ignorar);
    const corpo = moda(itens.filter((l) => !l.fig && !l.bold).map((l) => l.size)) || 9;
    let ant = null;
    for (const l of itens) {
      if (l.fig) {
        if (atual && modo === 'texto') atual.blocos.push({ t: 'img', fig: l.fig });
        ant = null;
        continue;
      }
      const t = l.t.trim();
      if (ROTULO.test(t)) {
        atual = { rotulo: 'Texto ' + t.match(ROTULO)[1].toUpperCase(), blocos: [], naFonte: false };
        textos.push(atual);
        modo = 'texto';
        ant = null;
        continue;
      }
      if (PROPOSTA.test(t)) { modo = 'proposta'; ant = null; continue; }
      if (INSTRUCOES.test(t)) { modo = 'instrucoes'; ant = null; continue; }
      if (TEXTOS_MOTIVADORES.test(t)) { modo = 'pre'; ant = null; continue; }
      if (modo === 'proposta') { proposta.push(marcada(l)); continue; }
      if (modo !== 'texto' || !atual) continue;

      const num = atual.rotulo.split(' ')[1];
      if (FONTE_INI.test(t) && !(spec.semFonteAuto || []).includes(num)) atual.naFonte = true;
      const jaTemCorpo = atual.blocos.some((x) => x.t === 'p' || x.t === 'verso');
      const forcado = (spec.tipos || {})[`${l.b}:${l.k}`] || (spec.tipos || {})[l.b];
      if (forcado === 'x') continue;
      if (forcado && forcado !== 'fonte') atual.naFonte = false;
      const tipo = forcado
        ? forcado
        : atual.naFonte || l.size <= corpo - 1.6
          ? 'fonte'
          : l.bold && l.size >= corpo && !jaTemCorpo && !(spec.semTitulo || []).includes(num)
            ? 'titulo'
            : (spec.versos || []).includes(num)
              ? 'verso'
              : 'p';
      const ult = atual.blocos[atual.blocos.length - 1];
      const mesmoBloco = ant && ult && ult.t === tipo && ult.linhas;
      const recuo = ant && tipo === 'p' && l.x > l.x0 + 7 && l.x - ant.x > 5 && Math.abs(l.y - ant.y) > 3 && !(spec.semRecuo || []).includes(num);
      const salto = ant && Math.abs(l.y - ant.y) > ant.alt * 1.9;
      if (mesmoBloco && !recuo && !(salto && tipo !== 'fonte')) { ult.linhas.push(marcada(l)); ult.bs.add(l.b); }
      else atual.blocos.push({ t: tipo, linhas: [marcada(l)], bs: new Set([l.b]) });
      ant = l;
    }
  }
  return { textos, proposta: juntar(proposta) };
}

function moda(ns) {
  const c = new Map();
  for (const n of ns) c.set(n, (c.get(n) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Roteiro manual, para a diagramação que a leitura automática não acerta. O
 * texto continua vindo do PDF: o roteiro só aponta os blocos, na ordem.
 *
 *   "textos": [{ "r": "I", "i": [["p", 1], ["fonte", 2], ["img", { "entre": [3, 9], "alt": "…" }]] }]
 *
 * Cada item é [tipo, ...blocos]; "12:3-7" pega só as linhas 3 a 7 do bloco 12.
 * A proposta sai da leitura automática, a não ser que "propostaBlocos" diga onde está.
 */
function montarManual(blocos, spec, auto) {
  const linhasDe = (refs) =>
    refs.flatMap((r) => {
      const [bi, faixa] = String(r).split(':');
      const b = blocos[+bi];
      if (!b || b.tipo !== 'txt') throw new Error(`bloco ${r} não é texto`);
      const alt = (b.box[3] - b.box[1]) / b.linhas.length;
      let ls = b.linhas.map((l, k) => {
        const lida = (spec.corrigir || {})[`${bi}:${k}`];
        return { ...l, t: lida ?? l.t, m: lida ?? marcada(l), x0: b.box[0], alt };
      });
      if (faixa) {
        const [a, z = a] = faixa.split('-').map(Number);
        ls = ls.slice(a, z + 1);
      }
      return ls.filter((l) => l.t.trim() && !lixo(l.t) && !ROTULO.test(l.t.trim()) && !CABECALHO(l.t.trim())).map((l) => ({ ...l, ref: r }));
    });
  const textos = spec.textos.map((tx) => {
    const bl = [];
    for (const [tipo, ...refs] of tx.i) {
      if (tipo === 'img') {
        bl.push({ t: 'img', fig: resolverFigura(refs[0], blocos) });
        continue;
      }
      if (tipo === 'lit') {
        bl.push({ t: refs[0], linhas: [refs[1]], bs: new Set(['lit']) });
        continue;
      }
      const capitular = tipo === 'cap' ? refs.shift() : null;
      const ls = linhasDe(refs);
      if (capitular && ls.length) ls[0] = { ...ls[0], t: capitular + ls[0].t.trimStart(), m: capitular + ls[0].m.trimStart() };
      if (tipo !== 'p' && tipo !== 'pj' && tipo !== 'cap') {
        bl.push({ t: tipo, linhas: ls.map((l) => l.m), bs: new Set(refs) });
        continue;
      }
      // Parágrafos: recuo de primeira linha ou salto vertical.
      let ant = null;
      for (const l of ls) {
        const recuo = tipo !== 'pj' && ant && l.x > l.x0 + 7 && l.x - ant.x > 5 && Math.abs(l.y - ant.y) > 3;
        const salto = tipo !== 'pj' && ant && Math.abs(l.y - ant.y) > ant.alt * 1.9 && l.y > ant.y;
        const outro = ant && tipo !== 'pj' && l.ref !== ant.ref;
        if (!ant || recuo || salto || outro) bl.push({ t: 'p', linhas: [l.m], bs: new Set(refs) });
        else bl[bl.length - 1].linhas.push(l.m);
        ant = l;
      }
    }
    return { rotulo: /^[IVX\d]+$/.test(tx.r) ? `Texto ${tx.r}` : tx.r, blocos: bl };
  });
  const proposta = spec.propostaBlocos ? juntar(linhasDe(spec.propostaBlocos).map((l) => l.m)) : auto.proposta;
  return { textos, proposta };
}

function temaDe(proposta) {
  const m = proposta.match(/sobre o tema[:\s]*[“"]?(.+?)[”"]?\s*[,.]?\s*(apresentando|Selecione|$)/i);
  return m ? m[1].replace(/[”"“]/g, '').replace(/\s+/g, ' ').trim() : '';
}

const ROTULOS = {
  regular: 'Aplicação regular',
  ppl: 'PPL / reaplicação',
  digital: 'ENEM Digital',
  segunda: '2ª aplicação',
  terceira: '3ª aplicação',
  belem: 'Aplicação em Belém, Ananindeua e Marituba',
};

const saidaImg = join(raiz, 'openem_frontend', 'public', 'redacoes');
const docs = new Map();
const pixs = new Map();
async function recortar(id, n, fig) {
  if (!docs.has(id)) docs.set(id, mupdf.Document.openDocument(readFileSync(join(aqui, 'pdfs', `${id}.pdf`)), 'application/pdf'));
  if (!pixs.has(`${id}.${fig.p}`)) pixs.clear();
  const page = docs.get(id).loadPage(fig.p - 1);
  const S = 2.6;
  const pix = page.toPixmap(mupdf.Matrix.scale(S, S), mupdf.ColorSpace.DeviceRGB, false, true);
  const img = await loadImage(Buffer.from(pix.asPNG()));
  const pad = 0;
  const x = Math.max(0, (fig.box[0] - pad) * S);
  const y = Math.max(0, (fig.box[1] - pad) * S);
  const w = Math.min(img.width - x, (fig.box[2] - fig.box[0] + 2 * pad) * S);
  const h = Math.min(img.height - y, (fig.box[3] - fig.box[1] + 2 * pad) * S);
  // Apara a margem branca: a caixa do roteiro pode ser folgada.
  const bruto = createCanvas(Math.round(w), Math.round(h));
  const bctx = bruto.getContext('2d');
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, bruto.width, bruto.height);
  bctx.drawImage(img, x, y, w, h, 0, 0, bruto.width, bruto.height);
  const px = bctx.getImageData(0, 0, bruto.width, bruto.height).data;
  let ax = bruto.width, ay = bruto.height, bx = 0, by = 0;
  for (let j = 0; j < bruto.height; j++)
    for (let i = 0; i < bruto.width; i++) {
      const o = (j * bruto.width + i) * 4;
      if (px[o] < 242 || px[o + 1] < 242 || px[o + 2] < 242) {
        if (i < ax) ax = i;
        if (i > bx) bx = i;
        if (j < ay) ay = j;
        if (j > by) by = j;
      }
    }
  if (bx <= ax || by <= ay) { ax = 0; ay = 0; bx = bruto.width - 1; by = bruto.height - 1; }
  const m = 8;
  const c = createCanvas(bx - ax + 1 + 2 * m, by - ay + 1 + 2 * m);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bruto, ax, ay, bx - ax + 1, by - ay + 1, m, m, bx - ax + 1, by - ay + 1);
  const nome = `${id}-${n}.webp`;
  writeFileSync(join(saidaImg, nome), c.toBuffer('image/webp', 82));
  return { src: `/redacoes/${nome}`, w: c.width, h: c.height };
}

/**
 * Fac-símile: a página da proposta inteira, como está no caderno (instruções,
 * diagramação, tudo). É a referência; o texto estruturado é a transcrição.
 */
async function facsimile(id, paginas) {
  if (!docs.has(id)) docs.set(id, mupdf.Document.openDocument(readFileSync(join(aqui, 'pdfs', `${id}.pdf`)), 'application/pdf'));
  const out = [];
  for (const p of paginas) {
    const pix = docs.get(id).loadPage(p - 1).toPixmap(mupdf.Matrix.scale(1.7, 1.7), mupdf.ColorSpace.DeviceRGB, false, true);
    const img = await loadImage(Buffer.from(pix.asPNG()));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const nome = `${id}-pagina${paginas.length > 1 ? '-' + p : ''}.webp`;
    writeFileSync(join(saidaImg, nome), c.toBuffer('image/webp', 60));
    out.push({ src: `/redacoes/${nome}`, w: c.width, h: c.height });
  }
  return out;
}

const catalogo = [];
const pendencias = [];
if (!ver) {
  rmSync(saidaImg, { recursive: true, force: true });
  mkdirSync(saidaImg, { recursive: true });
}
for (const f of fontes) {
  if (ver && f.id !== ver) continue;
  const spec = roteiro[f.id] || {};
  if (spec.pular) continue;
  const arq = join(aqui, 'paginas', `${f.id}.json`);
  if (!existsSync(arq)) { pendencias.push(`${f.id}: sem despejo`); continue; }
  const blocos = JSON.parse(readFileSync(arq, 'utf8'));
  LIGADURA = existsSync(join(aqui, 'pdfs', `${f.id}.fix.pdf`));
  const auto = montarAuto(f.id, blocos, spec);
  const montado = spec.textos ? montarManual(blocos, spec, auto) : auto;
  const { textos } = montado;
  // Trecho que a página imprime em maiúsculas (fonte versalete), mas que o PDF
  // guarda em minúsculas: volta a ser como está impresso. Vale para o comando
  // e para os blocos; cada trecho do roteiro tem de ser achado ao menos uma vez.
  const achados = new Set();
  const emMaiusculas = (texto) => {
    let out = texto;
    for (const trecho of spec.maiusculas || []) {
      const re = new RegExp(trecho.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\uE000-\\uE003]+'));
      out = out.replace(re, (m) => { achados.add(trecho); return m.toUpperCase(); });
    }
    return out;
  };
  const propostaMarcada = emMaiusculas(montado.proposta);
  const proposta = semMarcas(propostaMarcada);
  const tema = spec.tema ?? temaDe(proposta);
  let n = 0;
  const saida = [];
  for (const tx of textos) {
    const bl = [];
    for (const b of tx.blocos) {
      if (b.t === 'img') {
        if (!b.fig.alt) pendencias.push(`${f.id}: figura sem descrição em ${tx.rotulo} ${JSON.stringify(b.fig.box)}${b.fig.auto != null ? ' (bloco ' + b.fig.auto + ')' : ''}`);
        bl.push(ver ? { t: 'img', box: b.fig.box, alt: b.fig.alt } : { t: 'img', alt: b.fig.alt, ...(await recortar(f.id, ++n, b.fig)) });
      } else if (b.t === 'verso') {
        const marcado = b.linhas.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
        const texto = semMarcas(marcado);
        const partes = partesDe(marcado);
        bl.push(ver ? { t: 'verso', texto: texto.replace(/\n/g, ' / '), bs: [...(b.bs || [])] } : { t: 'verso', texto, ...(partes ? { partes } : {}) });
      } else {
        const marcado = emMaiusculas(juntar(b.linhas));
        const texto = semMarcas(marcado);
        const partes = partesDe(marcado);
        if (texto) bl.push(ver ? { t: b.t, texto, bs: [...(b.bs || [])] } : { t: b.t, texto, ...(partes ? { partes } : {}) });
      }
    }
    if (bl.length) saida.push({ rotulo: f.ano <= 2013 ? '' : tx.rotulo, blocos: bl });
  }
  for (const trecho of spec.maiusculas || []) if (!achados.has(trecho)) pendencias.push(`${f.id}: "maiusculas" não achou «${trecho}»`);
  if (!tema && !spec.semTema) pendencias.push(`${f.id}: sem tema`);
  if (!saida.length) pendencias.push(`${f.id}: sem textos`);
  catalogo.push({
    id: f.id,
    ano: f.ano,
    aplicacao: f.tipo,
    aplicacaoRotulo: spec.aplicacaoRotulo || ROTULOS[f.tipo],
    tema,
    proposta: spec.proposta || proposta,
    ...(!spec.proposta && partesDe(propostaMarcada) ? { propostaPartes: partesDe(propostaMarcada) } : {}),
    paginas: ver ? [] : await facsimile(f.id, blocos.filter((b) => b.tipo === 'pagina').map((b) => b.p)),
    ...(spec.semTema ? { semTema: true } : {}),
    ...(spec.transcrito ? { transcrito: true } : {}),
    textos: saida,
    fonteUrl: f.url,
  });
}

if (ver) {
  for (const c of catalogo) {
    console.log(`TEMA: ${c.tema}\nPROPOSTA: ${c.proposta.slice(0, 160)}…`);

    for (const t of c.textos) {
      console.log(`\n== ${t.rotulo}`);
      for (const b of t.blocos) console.log(b.t === 'img' ? `  [img ${JSON.stringify(b.box)} alt=${b.alt}]` : `  ${b.t}#${(b.bs || []).join(',')}: ${b.texto.length > 150 ? b.texto.slice(0, 85) + ' […] ' + b.texto.slice(-55) : b.texto}`);
    }
  }
} else {
  catalogo.sort((a, b) => b.ano - a.ano || fontes.findIndex((x) => x.id === a.id) - fontes.findIndex((x) => x.id === b.id));
  const destino = join(raiz, 'openem_frontend', 'src', 'data');
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'redacoes.json'), JSON.stringify(catalogo, null, 1) + '\n');
  console.log(`${catalogo.length} temas gravados`);
}
if (process.argv.includes('--hifens')) console.log('HÍFENS: ' + [...JUNCOES].sort().join(' ') + '\nLIGADURAS: ' + [...LIGADURAS].sort().join(' '));
if (pendencias.length) console.log('\nPENDÊNCIAS:\n' + pendencias.join('\n'));
