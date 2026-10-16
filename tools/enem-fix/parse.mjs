// Lê um caderno do ENEM (PDF) e devolve as questões: enunciado em parágrafos,
// comando, alternativas e as figuras (com a caixa de cada uma, para recortar).
import './globals.mjs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '–': '⁻', '—': '⁻', n: 'ⁿ' };
for (const c of '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ') SUP[c] = c; // já vem sobrescrito
SUP.o = 'º'; SUP.a = 'ª'; // "1 ^o" é ordinal; "30 ^o C" vira "30 ºC"
export const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '–': '₋', '—': '₋' };
export const conv = (s, tab, marca) => {
  const t = s.trim();
  if ([...t].every((c) => tab[c])) return [...t].map((c) => tab[c]).join('');
  // conteúdo simples fica sem parêntese ("d_A"), que lê melhor que "d_(A)"
  return /^[A-Za-zÀ-ÿ0-9]{1,6}$/.test(t) ? `${marca}${t}` : `${marca}(${t})`;
};
// Fonte Symbol: glifos na área privada F0xx seguem a codificação Symbol.
import { SYMBOL } from './symbol.mjs';
export function fixSymbol(str) {
  return [...str]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 0xf020 && c <= 0xf0ff) return SYMBOL[c - 0xf000] ?? String.fromCharCode(c - 0xf000);
      return ch;
    })
    .join('');
}

const RODAPE = /(Caderno \d+|Página \d+|^\*[0-9A-Z]+\*$|^\d+ª aplicação$|^(ENEM ?20\d\d[ ]*)+$|^\d{1,2}$)/i;
const RE_Q = /^QUEST[ÃA]O\s*0*(\d{1,3})\b/i;
const mult = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function boxOf(m, x0, y0, x1, y1) {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Caixas (em coordenadas da página) de imagens e desenhos vetoriais. */
async function graficos(page, w, h) {
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  // Cor de preenchimento e de traço: desenho branco não aparece na página.
  // A prova digital põe cada alternativa num retângulo branco (área de
  // clique), que sem isso vira "figura" e engole o texto da alternativa.
  let cor = { fill: null, stroke: null };
  const pilha = [];
  const out = [];
  const branco = (c) => !!c && c.length > 0 && [...c].every((v) => v >= 250);
  // Preenchimento quase branco é fundo (o botão cinza-claro de cada
  // alternativa na prova digital de 2022), não figura. Tabela com borda
  // continua sendo figura pelas bordas.
  const fundo = (c) => !!c && c.length > 0 && [...c].every((v) => v >= 235);
  let caminho = null; // caixa do último constructPath, à espera da pintura
  const PINTA_FILL = new Set([OPS.fill, OPS.eoFill]);
  const PINTA_STROKE = new Set([OPS.stroke, OPS.closeStroke]);
  const PINTA_AMBOS = new Set([OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (caminho && fn !== OPS.constructPath) {
      // Recorte (endPath sem pintar) e desenho todo branco ficam de fora.
      const visivel = PINTA_FILL.has(fn) ? !fundo(cor.fill) : PINTA_STROKE.has(fn) ? !branco(cor.stroke) : PINTA_AMBOS.has(fn) ? !(fundo(cor.fill) && branco(cor.stroke)) : null;
      if (visivel !== null || fn === OPS.endPath) {
        if (visivel) out.push(caminho);
        caminho = null;
      }
    }
    if (fn === OPS.save) pilha.push([ctm, cor]);
    else if (fn === OPS.restore) [ctm, cor] = pilha.pop() ?? [ctm, cor];
    else if (fn === OPS.transform) ctm = mult(ctm, a);
    else if (fn === OPS.setFillRGBColor) cor = { ...cor, fill: a };
    else if (fn === OPS.setStrokeRGBColor) cor = { ...cor, stroke: a };
    else if (fn === OPS.setFillGray) cor = { ...cor, fill: a };
    else if (fn === OPS.setStrokeGray) cor = { ...cor, stroke: a };
    else if (fn === OPS.paintFormXObjectBegin) { pilha.push([ctm, cor]); if (a[0]) ctm = mult(ctm, a[0]); }
    else if (fn === OPS.paintFormXObjectEnd) [ctm, cor] = pilha.pop() ?? [ctm, cor];
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject || fn === OPS.paintImageXObjectRepeat) {
      out.push({ ...boxOf(ctm, 0, 0, 1, 1), tipo: 'img' });
    } else if (fn === OPS.constructPath) {
      if (caminho) out.push(caminho); // dois caminhos seguidos: o anterior conta
      const mm = a[2];
      caminho = mm && isFinite(mm[0]) ? { ...boxOf(ctm, mm[0], mm[1], mm[2], mm[3]), tipo: 'path' } : null;
    }
  }
  if (caminho) out.push(caminho);
  // Traço horizontal curto e fino: barra de fração (ou radical) em fórmula.
  const barras = out.filter((b) => b.y1 - b.y0 < 1.5 && b.x1 - b.x0 >= 4 && b.x1 - b.x0 < 150);
  // Descarta o que é moldura/régua de página: fio longo e fino, fundo da página.
  const figs = out.filter((b) => {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw > w * 0.8 || bh > h * 0.8) return false;
    // Cabeçalho da página (logo, código de barras): não é figura.
    if (b.y0 > h - 75) return false;
    // Rodapé e abas coloridas na margem da página: decoração.
    if (b.y1 < 58) return false;
    if (b.x0 > w - 50 || b.x1 < 32) return false;
    // Retângulo de fundo/moldura de coluna: não é figura.
    if (b.tipo === 'path' && bh > h * 0.45) return false;
    if ((bw < 1.5 && bh > 150) || (bh < 1.5 && bw > 150)) return false;
    if (bw < 0.5 && bh < 0.5) return false;
    return true;
  });
  const marcas = out.filter((b) => b.tipo === 'path' && b.x1 - b.x0 < 60 && b.y1 - b.y0 < 30 && b.x1 - b.x0 + b.y1 - b.y0 > 3);
  return { figs, barras, marcas };
}

import { gidTable } from './gidmap.mjs';

// Fonte cujo código de caractere é o gid do Arial (ENEM 2017 reaplicação):
// "UHVVLJQL¿FDU" = "ressignificar". Decide por fonte, comparando quanto do
// texto vira palavra conhecida antes e depois de decodificar.
const PALAVRAS = new Set('de a o que e do da em um para com não uma os no se na por mais as dos como mas ao das seu sua ou quando muito já também pelo pela até isso entre depois sem mesmo aos seus quem nas esse eles essa nem suas meu às minha numa pelos elas qual nós texto sobre ser foi são tem pode está the and of to is in that it you for el la los las y del una'.split(' '));
const nota = (t) => { const ws = t.toLowerCase().split(/[^a-zà-ú]+/).filter(Boolean); return ws.length ? ws.filter((w) => PALAVRAS.has(w)).length / ws.length : 0; };
export function decodificaGid(str, tabela) {
  // 0x20 é o espaço que o próprio pdfjs insere entre itens, não um gid.
  return [...str].map((ch) => (ch === ' ' ? ' ' : tabela.get(ch.codePointAt(0)) ?? ch)).join('');
}

/**
 * Ligadura "fi"/"fl" que o PDF desenha como glifo à parte e o pdfjs devolve
 * com um espaço depois: "difi cultando", "fl orescer". O par não existe solto
 * em português, então o espaço some quando a próxima letra é minúscula.
 */
export function juntaLigadura(t) {
  return t.replace(/(^|[\s(«“"'a-zà-ÿ])(fi|fl) (?=[a-zà-ÿ])/g, '$1$2');
}

export async function parsePdf(file) {
  const doc = await getDocument({ url: file, verbosity: 0, fontExtraProperties: true }).promise;
  const linhas = [];
  const figurasPag = [];
  const barrasPag = [];
  const amostras = new Map();
  const fontesGid = new Set();
  const paginasTc = new Map();
  const marcasPag = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const [vx0, vy0] = [page.view[0], page.view[1]];
    const w = vp.width, h = vp.height;
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const f = amostras.get(it.fontName) ?? { txt: '', nome: null };
      if (!f.nome) { try { f.nome = page.commonObjs.get(it.fontName)?.name ?? 'ArialMT'; } catch { f.nome = 'ArialMT'; } }
      if (f.txt.length < 3000) f.txt += ' ' + it.str;
      amostras.set(it.fontName, f);
    }
    paginasTc.set(p, tc);
    // Página em coluna única (questão com tabela ou figura na largura toda):
    // nas de duas colunas o vão do meio não tem texto; nessas, as linhas o
    // atravessam. Com uma coluna só, tudo vai para a coluna 0.
    const atravessam = tc.items.filter((it) => {
      if (!it.str.trim()) return false;
      const x = it.transform[4] - vx0;
      const yy = it.transform[5] - vy0;
      return yy > 40 && yy < h - 60 && x < w / 2 - 2 && x + it.width > w / 2 + 2;
    }).length;
    // Também é coluna única a página quase sem texto começando na metade
    // direita (a prova digital: uma questão curta por página).
    const corpo = tc.items.filter((it) => it.str.trim() && it.transform[5] - vy0 > 40 && it.transform[5] - vy0 < h - 60);
    const naDireita = corpo.filter((it) => it.transform[4] - vx0 > w / 2 + 5).length;
    const umaColuna = atravessam >= 6 || (corpo.length >= 8 && naDireita < 3);
    const meio = umaColuna ? w * 4 : w / 2;
    const g0 = await graficos(page, w, h);
    const desloca = (b) => ({ ...b, x0: b.x0 - vx0, x1: b.x1 - vx0, y0: b.y0 - vy0, y1: b.y1 - vy0 });
    const gr = g0.figs.map(desloca);
    marcasPag.push(...g0.marcas.map(desloca).map((b) => ({ ...b, p })));
    barrasPag.push(...g0.barras.map(desloca).map((b) => ({ ...b, p, c: (b.x0 + b.x1) / 2 < meio ? 0 : 1 })));
    const itens = [];
    const decod = (it) => {
      const f = amostras.get(it.fontName);
      if (!f) return it.str;
      if (f.gid === undefined) {
        const tab = gidTable(f.nome) ?? gidTable('ArialMT');
        f.tab = tab;
        // Fonte só de letras soltas (a das alternativas: "A B C D E") não dá
        // para julgar — "a" e "e" são palavras e a decodificação venceria.
        // Basta uma palavra de 3+ letras: fonte codificada pouco usada (um
        // título, uma alternativa) também precisa ser decodificada.
        const longas = f.txt.split(/\s+/).filter((w) => w.length >= 3).length;
        f.gid = longas >= 1 && nota(decodificaGid(f.txt, tab)) > nota(f.txt) + 0.1;
        if (f.gid) fontesGid.add(f.nome);
      }
      return f.gid ? decodificaGid(it.str, f.tab) : it.str;
    };
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const x = it.transform[4] - vx0, y = it.transform[5] - vy0;
      if (y < 12 || y > h - 12) continue;
      itens.push({ x, y, str: fixSymbol(decod(it)), hgt: it.height || Math.abs(it.transform[3]), w: it.width, f: it.fontName, c: x < meio - 5 ? 0 : 1 });
    }
    // altura "normal" do corpo de texto nesta página
    const alturas = itens.map((i) => Math.round(i.hgt * 2) / 2).sort((a, b) => a - b);
    const normal = alturas[Math.floor(alturas.length / 2)] || 9;
    const pequenos = itens.filter((i) => i.hgt < normal * 0.78 && i.str.trim().length <= 4);
    const grandes = itens.filter((i) => !pequenos.includes(i));
    for (let c = 0; c < 2; c++) {
      const col = grandes.filter((i) => i.c === c).sort((a, b) => b.y - a.y || a.x - b.x);
      const ls = [];
      let atual = null;
      for (const it of col) {
        if (atual && Math.abs(atual.y - it.y) <= 2.5) atual.items.push(it);
        else { atual = { p, c, y: it.y, items: [it], w, h }; ls.push(atual); }
      }
      // expoente/índice: item pequeno ancorado na linha mais próxima
      for (const it of pequenos.filter((i) => i.c === c)) {
        let melhor = null, dist = 1e9;
        for (const l of ls) {
          const d = it.y - l.y;
          if (d > -5 && d < 8 && Math.abs(d) < dist) {
            const xs = l.items.map((i) => i.x);
            // Na mesma linha de base, item menor à esquerda (a letra da
            // alternativa na prova digital) também é da linha.
            const esquerda = Math.abs(d) <= 1.5 ? 60 : 5;
            if (it.x >= Math.min(...xs) - esquerda && it.x <= Math.max(...l.items.map((i) => i.x + i.w)) + 20) { melhor = l; dist = Math.abs(d); }
          }
        }
        if (melhor) {
          const d = it.y - melhor.y;
          melhor.items.push({ ...it, str: d > 1.5 ? conv(it.str, SUP, '^') : d < -1 ? conv(it.str, SUB, '_') : it.str, colado: true });
        } else {
          ls.push({ p, c, y: it.y, items: [it], w, h });
        }
      }
      // Mesma altura: a da esquerda primeiro (letra antes do texto).
      ls.sort((a, b) => b.y - a.y || Math.min(...a.items.map((i) => i.x)) - Math.min(...b.items.map((i) => i.x)));
      linhas.push(...ls);
    }
    figurasPag.push(gr.map((g) => ({ ...g, p, c: (g.x0 + g.x1) / 2 < meio ? 0 : 1, w, h })));
  }
  for (const l of linhas) {
    l.items.sort((a, b) => a.x - b.x);
    l.items = l.items.filter((it, i, arr) => !arr.slice(0, i).some((o) => o.str === it.str && Math.abs(o.x - it.x) < 1 && Math.abs(o.y - it.y) < 1));
    l.x0 = l.items[0].x;
    l.x1 = Math.max(...l.items.map((i) => i.x + i.w));
    let t = '';
    let fimAnterior = null;
    for (const i of l.items) {
      if (i.colado) t += i.str;
      else if (fimAnterior !== null && i.x - fimAnterior < 1 && !/\s$/.test(t)) t += i.str;
      else t += (t ? ' ' : '') + i.str;
      fimAnterior = i.x + i.w;
    }
    l.text = juntaLigadura(t.replace(/\s+/g, ' ').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').trim());
  }

  // Figuras: agrupa caixas próximas (mesma página/coluna) numa figura só.
  const figuras = [];
  // Linha que é só a letra de uma alternativa (o círculo dela é um desenho).
  const soLetra = (l) => /^[A-E]$/.test(l.items[0].str.trim());
  // Peça de fundo (antes de agrupar, para não levar junto o que está dentro
  // dela): o cartão em volta da questão na prova digital de 2020 — imagem de
  // sombra ou retângulo que contém o cabeçalho, as alternativas ou vários
  // parágrafos — e a moldura de uma caixa de texto. Rótulo de gráfico ou
  // mapa é curto; parágrafo ocupa a largura. Na tabela, só a borda externa
  // sai: as bordas internas continuam agrupando a tabela como figura.
  const RESIDUO = /[\u0000-\u0008\u000b-\u001f\ue000-\uf8ff¡]|\^\(|_\(/;
  function fundoDeTexto(b) {
    if (b.y1 - b.y0 < 40) return false;
    const dentro = linhas.filter((l) => l.p === b.p && l.y >= b.y0 && l.y <= b.y1 && l.x0 >= b.x0 - 2 && l.x1 <= b.x1 + 2);
    if (dentro.some((l) => RE_Q.test(l.text))) return true;
    if (dentro.filter((l) => /^[A-E]$/.test(l.items[0].str.trim()) && l.items.length > 1).length >= 3) return true;
    // Fórmula com resíduo de fonte dentro: fica figura, senão o texto quebra.
    if (dentro.some((l) => RESIDUO.test(l.text))) return false;
    return dentro.filter((l) => l.x1 - l.x0 > 0.6 * (b.x1 - b.x0)).length >= 3;
  }
  for (const caixas0 of figurasPag) {
    const pag = caixas0[0]?.p;
    const letras = linhas.filter((l) => l.p === pag).flatMap((l) => l.items.filter((i) => /^[A-E]$/.test(i.str.trim())).map((i) => ({ cx: i.x + i.w / 2, cy: i.y + i.hgt / 3 })));
    // Descarta o círculo/quadrado em volta da letra da alternativa.
    const caixas = caixas0.filter((b) => {
      if (b.tipo === 'img' || b.x1 - b.x0 > 18 || b.y1 - b.y0 > 18) return !fundoDeTexto(b);
      return !letras.some((l) => l.cx >= b.x0 - 2 && l.cx <= b.x1 + 2 && l.cy >= b.y0 - 3 && l.cy <= b.y1 + 3);
    });
    const grupos = [];
    for (const b of caixas) {
      let g = grupos.find((g) => g.p === b.p && b.x0 <= g.x1 + 6 && b.x1 >= g.x0 - 6 && b.y0 <= g.y1 + 6 && b.y1 >= g.y0 - 6);
      if (g) { g.x0 = Math.min(g.x0, b.x0); g.y0 = Math.min(g.y0, b.y0); g.x1 = Math.max(g.x1, b.x1); g.y1 = Math.max(g.y1, b.y1); g.n++; if (b.tipo === 'img') g.img = true; }
      else grupos.push({ ...b, n: 1, img: b.tipo === 'img' });
    }
    // funde grupos que se tocam depois da primeira passada
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (let i = 0; i < grupos.length && !mudou; i++)
        for (let j = i + 1; j < grupos.length && !mudou; j++) {
          const a = grupos[i], b = grupos[j];
          if (b.x0 <= a.x1 + 6 && b.x1 >= a.x0 - 6 && b.y0 <= a.y1 + 6 && b.y1 >= a.y0 - 6) {
            Object.assign(a, { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), n: a.n + b.n, img: a.img || b.img });
            grupos.splice(j, 1);
            mudou = true;
          }
        }
    }
    // figura de verdade: tem imagem, ou desenho com área razoável
    for (const g of grupos) {
      const area = (g.x1 - g.x0) * (g.y1 - g.y0);
      if (!(g.img ? area > 150 : area > 900 && g.x1 - g.x0 > 25 && g.y1 - g.y0 > 12)) continue;
      // Barra decorativa ao lado do "Questão NN": não é figura.
      const cabecalho = linhas.some((l) => l.p === g.p && RE_Q.test(l.text) && Math.abs((g.y0 + g.y1) / 2 - (l.y + 3)) < 10);
      if (cabecalho && g.y1 - g.y0 < 14) continue;
      // Rótulos de eixo/legenda encostados no desenho fazem parte da figura.
      // Uma passada só, contra a caixa original: iterar cresceria em cadeia.
      const orig = { ...g };
      for (const l of linhas) {
        if (l.p !== g.p || soLetra(l) || RE_Q.test(l.text) || l.absorvida) continue;
        const lt = l.y + (l.items[0].hgt || 8), lb = l.y - 3;
        const perto = lb <= orig.y1 + 7 && lt >= orig.y0 - 7 && l.x0 >= orig.x0 - 12 && l.x1 <= orig.x1 + 12;
        if (!perto) continue;
        const curta = l.x1 - l.x0 < 0.85 * (orig.x1 - orig.x0);
        const noMeio = lb >= orig.y0 - 2 && lt <= orig.y1 + 2;
        if (!curta && !noMeio) continue;
        l.absorvida = true;
        g.x0 = Math.min(g.x0, l.x0); g.x1 = Math.max(g.x1, l.x1); g.y0 = Math.min(g.y0, lb); g.y1 = Math.max(g.y1, lt);
      }
      figuras.push(g);
    }
  }

  // Sequência em ordem de leitura: linhas e figuras, página → coluna → y.
  const seq = [];
  for (const l of linhas) seq.push({ kind: 'line', ...l });
  for (const f of figuras) seq.push({ kind: 'fig', ...f, y: (f.y0 + f.y1) / 2, c: f.c });
  for (const b of barrasPag) seq.push({ kind: 'barra', ...b, y: b.y1 });
  seq.sort((a, b) => a.p - b.p || a.c - b.c || b.y - a.y);
  // Linha dentro de uma figura é rótulo do desenho: sai do texto.
  const dentro = (l, f) => l.absorvida || (l.p === f.p && l.y >= f.y0 - 1 && l.y <= f.y1 + 1 && l.x0 >= f.x0 - 3 && l.x1 <= f.x1 + 3);

  const questoes = [];
  let q = null;
  for (const e of seq) {
    if (e.kind === 'line') {
      if (RODAPE.test(e.text)) continue;
      const m = e.text.match(RE_Q);
      if (m) {
        q = { number: +m[1], elems: [], page: e.p };
        questoes.push(q);
        // A prova digital põe a área depois do número: "Questão 54 - Ciências
        // Humanas e suas Tecnologias". Isso é cabeçalho, não enunciado.
        const resto = e.text.slice(m[0].length).trim().replace(/^[-–]\s*(Ci[êe]ncias|Linguagens|Matem[áa]tica)\b.*Tecnologias$/i, '').trim();
        if (resto) q.elems.push({ ...e, text: resto });
        continue;
      }
    }
    if (q) q.elems.push(e);
  }

  // Margem esquerda de cada coluna (percentil baixo do início das linhas).
  const margem = new Map();
  for (const l of linhas) {
    const k = l.p + ':' + l.c;
    if (!margem.has(k)) margem.set(k, []);
    margem.get(k).push(l.x0);
  }
  for (const [k, xs] of margem) { xs.sort((a, b) => a - b); margem.set(k, xs[Math.floor(xs.length * 0.05)]); }
  // Fonte das letras das alternativas: nos cadernos recentes elas são um glifo
  // quadrado (letra no círculo) numa fonte só delas. Quando ela existe, linha
  // que começa com o artigo "A" na fonte do texto não é alternativa — o espaço
  // largo depois do artigo vem da justificação, não da diagramação.
  // Na prova digital a letra é um caractere comum dentro de um círculo
  // desenhado, mas também numa fonte só dela. Então a fonte das letras é a
  // que aparece em letra solta no começo da linha e quase nunca em texto.
  const contagem = new Map();
  const emTexto = new Map();
  for (const l of linhas) {
    for (const it of l.items) if (it.str.trim().length > 1) emTexto.set(it.f, (emTexto.get(it.f) ?? 0) + 1);
    const it = l.items[0];
    if (/^[A-E]$/.test(it.str.trim())) contagem.set(it.f, (contagem.get(it.f) ?? 0) + 1);
  }
  // O pdfjs dá nome novo à mesma fonte ao longo do documento (a digital de
  // 2020 troca na metade), então pode haver mais de uma fonte de letras.
  const fontesDasLetras = new Set([...contagem].filter(([f, n]) => n >= 5 && (emTexto.get(f) ?? 0) < n / 2).map(([f]) => f));
  const totalLetras = [...fontesDasLetras].reduce((t, f) => t + contagem.get(f), 0);
  const fonteDasLetras = totalLetras >= 20 ? fontesDasLetras : null;
  const ehLetra = (e, letra) => {
    if (e.kind !== 'line' || !letra) return false;
    const it = e.items[0];
    const primeiro = it.str.trim();
    if (fonteDasLetras && primeiro.length === 1 && !fonteDasLetras.has(it.f)) return false;
    // A letra fica na margem da coluna (rótulo de figura não)...
    if (e.x0 > (margem.get(e.p + ':' + e.c) ?? e.x0) + 14) return false;
    if (primeiro === letra) {
      // ...e o texto da alternativa começa recuado, não a um espaço ("A expressão...").
      const prox = e.items[1];
      // (letra em círculo é um glifo largo, quase quadrado: aceita mesmo colada)
      return !prox || prox.x - (it.x + it.w) > 3.4 || it.w >= 0.9 * (it.hgt || 10);
    }
    return /^[A-E]\s{2,}/.test(it.str) && primeiro[0] === letra;
  };
  const mesmaColuna = (a, b) => a.p === b.p && a.c === b.c;

  for (const q of questoes) {
    const figs = q.elems.filter((e) => e.kind === 'fig');
    const alts = [];
    const corpo = [];
    let esperado = 0;
    let ultimaLinha = null;
    const els = q.elems;
    let pendente = []; // numerador de fração: linha logo acima da letra seguinte
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      if (e.kind === 'barra') {
        const emFig = figs.some((f) => f.p === e.p && e.x0 >= f.x0 - 2 && e.x1 <= f.x1 + 2 && e.y0 >= f.y0 - 2 && e.y1 <= f.y1 + 2);
        if (emFig) continue;
        // barra entre o numerador e a linha da letra seguinte é dessa letra
        const prox = els.slice(i + 1).find((x) => x.kind === 'line');
        if (prox && ehLetra(prox, 'ABCDE'[esperado]) && mesmaColuna(prox, e) && e.y1 - prox.y < 12) { pendente.push({ fracao: true }); continue; }
        // Só é fração da alternativa se estiver na altura da linha da letra.
        const ult = alts[alts.length - 1];
        if (ult) { if (mesmaColuna(ult.box, e) && Math.abs(e.y0 - ult.box.yLetra) < 12) ult.fracao = true; continue; }
        else corpo.push({ barra: e });
        continue;
      }
      if (e.kind === 'fig') {
        // figura antes do A é do enunciado; depois, da alternativa corrente
        if (alts.length) {
          // Só é da alternativa se estiver na mesma coluna, logo abaixo da letra.
          const ult = alts[alts.length - 1];
          if (mesmaColuna(ult.box, e) && e.y1 <= ult.box.yTop + 30 && e.y1 >= ult.box.yBot - 40) ult.figs.push(e);
        } else corpo.push({ fig: e });
        continue;
      }
      if (figs.some((f) => dentro(e, f)) && !/^[A-E]$/.test(e.items[0].str.trim())) continue;
      const letra = 'ABCDE'[esperado];
      if (ehLetra(e, letra)) {
        const txt = e.text.slice(1).trim();
        const letraItem = e.items[0];
        const xTexto = e.items[1]?.x ?? letraItem.x + letraItem.w + 3;
        const a = { letter: letra, parts: txt ? [txt] : [], figs: [], box: { p: e.p, c: e.c, yLetra: e.y, xLetraFim: letraItem.x + letraItem.w, yTop: e.y + letraItem.hgt, yBot: e.y - 3, x0: e.x0, xTexto, x1: e.x1, w: e.w, h: e.h } };
        for (const pd of pendente) {
          if (pd.fracao) { a.fracao = true; continue; }
          a.parts.unshift(pd.text);
          a.box.yTop = Math.max(a.box.yTop, pd.y + pd.hgt);
          a.box.x1 = Math.max(a.box.x1, pd.x1);
          a.box.xTexto = Math.min(a.box.xTexto, pd.x0);
        }
        pendente = [];
        alts.push(a);
        esperado++;
        ultimaLinha = e;
        continue;
      }
      // Linha colada logo acima da próxima letra, recuada: numerador da fração dela.
      const prox = els.slice(i + 1).find((x) => x.kind === 'line');
      if (alts.length && prox && ehLetra(prox, letra) && mesmaColuna(prox, e) && e.y - prox.y < 11 && e.x0 > prox.x0 + 3) {
        pendente.push({ text: e.text, y: e.y, hgt: e.items[0].hgt, x0: e.x0, x1: e.x1 });
        continue;
      }
      if (alts.length) {
        const a = alts[alts.length - 1];
        if (mesmaColuna(e, a.box) && a.box.yBot + 3 - e.y < 16 && e.x0 > a.box.x0 + 3) {
          a.parts.push(e.text);
          a.box.yBot = e.y - 3;
          a.box.x1 = Math.max(a.box.x1, e.x1);
          continue;
        }
        if (alts.length === 5) continue;
      }
      if (!alts.length) {
        const gap = ultimaLinha && mesmaColuna(ultimaLinha, e) ? ultimaLinha.y - e.y : null;
        corpo.push({ text: e.text, gap, x0: e.x0, x1: e.x1, y: e.y, p: e.p, c: e.c, hgt: e.items[0].hgt });
        ultimaLinha = e;
      }
    }
    // Figura ↔ alternativa pela geometria: é da letra que está na altura dela
    // (a letra costuma ficar no topo ou no meio, à esquerda do desenho).
    if (alts.length) {
      const todas = figs; // todas as figuras da questão, inclusive as que a ordem de leitura descartou
      const cobre = (f) => alts.filter((a) => mesmaColuna(a.box, f) && a.box.yLetra >= f.y0 + 3 && a.box.yLetra <= f.y1 + 12 && a.box.x0 <= f.x0 + 10);
      const atribuida = new Map();
      for (const f of todas) {
        const cands = cobre(f);
        if (cands.length === 1) atribuida.set(f, cands[0]);
        else if (cands.length > 1) {
          // Um bloco só com várias alternativas (fórmulas, grade): cada letra
          // fica com a sua faixa, da própria linha até a letra seguinte.
          const ord = cands.sort((x, y) => y.box.yLetra - x.box.yLetra);
          ord.forEach((a, i) => {
            const prox = ord[i + 1];
            a.faixa = { p: f.p, x0: a.box.xTexto - 2, x1: f.x1, y1: Math.min(f.y1, a.box.yTop + (a.fracao ? 12 : 4)), y0: prox ? prox.box.yTop + (prox.fracao ? 12 : 4) : f.y0 };
          });
          atribuida.set(f, null);
        }
      }
      if (atribuida.size) {
        for (const a of alts) a.figs = a.figs.filter((f) => !atribuida.has(f) || atribuida.get(f) === a);
        for (const [f, a] of atribuida) if (a && !a.figs.includes(f)) a.figs.push(f);
        for (let i = corpo.length - 1; i >= 0; i--) if (corpo[i].fig && atribuida.has(corpo[i].fig)) corpo.splice(i, 1);
      }
    }
    // Parágrafos: salto vertical maior que o normal, ou recuo de primeira linha.
    const gaps = corpo.filter((c) => c.gap).map((c) => c.gap).sort((a, b) => a - b);
    const normal = gaps[Math.floor(gaps.length / 3)] || 11;
    const pars = [];
    let par = null;
    const minX = Math.min(...corpo.filter((c) => c.text).map((c) => c.x0));
    for (const c of corpo) {
      if (c.fig) { par = null; pars.push({ fig: c.fig }); continue; }
      if (c.barra) { pars.push({ barra: c.barra }); continue; }
      // Novo parágrafo: salto vertical, troca do tamanho da fonte (a referência
      // bibliográfica é menor) ou recuo de primeira linha em relação à anterior.
      const ant = par?.linhas[par.linhas.length - 1];
      const trocaFonte = ant && Math.abs(ant.hgt - c.hgt) > 0.8;
      const recuo = ant && !trocaFonte && c.hgt >= ant.hgt - 0.5 && c.x0 > ant.x0 + 8 && ant.x0 <= minX + 3;
      const novo = !par || (c.gap && c.gap > normal * 1.45) || c.gap === null || trocaFonte || recuo;
      if (novo) { par = { linhas: [] }; pars.push(par); }
      par.linhas.push(c);
    }
    // Parágrafo com fórmula (barra de fração) vira imagem: o texto sairia torto.
    const barras = pars.filter((b) => b.barra).map((b) => b.barra);
    const blocos = [];
    for (const b of pars) {
      if (b.barra) continue;
      if (b.fig) { blocos.push({ fig: b.fig }); continue; }
      const ls = b.linhas;
      const uma = ls.every((l) => mesmaColuna(l, ls[0]));
      const caixa = { p: ls[0].p, c: ls[0].c, x0: Math.min(...ls.map((l) => l.x0)), x1: Math.max(...ls.map((l) => l.x1)), y0: Math.min(...ls.map((l) => l.y)) - 3, y1: Math.max(...ls.map((l) => l.y + l.hgt)) };
      const temMarca = uma && marcasPag.some((r) => r.p === caixa.p && r.y0 >= caixa.y0 - 2 && r.y1 <= caixa.y1 + 2 && r.x0 >= caixa.x0 + 2 && r.x1 <= caixa.x1 + 2);
      const lixoTxt = /[\u0000-\u0008\u000b-\u001f\ue000-\uf8ff¡]/.test(ls.map((l) => l.text).join(' '));
      const temFracao = (uma && lixoTxt) || temMarca || uma && barras.some((r) => r.p === caixa.p && r.y0 >= caixa.y0 - 8 && r.y1 <= caixa.y1 + 8 && r.x0 >= caixa.x0 - 4 && r.x1 <= caixa.x1 + 4);
      if (temFracao) {
        const acima = barras.filter((r) => r.p === caixa.p && r.x0 >= caixa.x0 - 4 && r.x1 <= caixa.x1 + 4);
        caixa.y0 = Math.min(caixa.y0, ...acima.filter((r) => r.y0 >= caixa.y0 - 8).map((r) => r.y0 - 9));
        blocos.push({ fig: caixa, formula: true, text: ls.map((l) => l.text).join('\n') });
      } else blocos.push({ text: ls.map((l) => l.text).join('\n') });
    }
    q.fracCorpo = blocos.some((b) => b.formula);
    q.blocos = blocos;
    // Texto vindo de fonte de fórmula sem mapa (controle, área privada, "¡" no
    // lugar de ℝ): a alternativa sai como imagem.
    const lixo = /[\u0000-\u0008\u000b-\u001f\ue000-\uf8ff¡]|\^\(|_\(/;
    for (const a of alts) {
      if (lixo.test(a.parts.join(' '))) a.fracao = true;
      const b = a.box;
      if (marcasPag.some((r) => r.p === b.p && r.x0 >= b.xLetraFim + 1 && r.x0 <= b.x1 + 15 && r.y1 >= b.yBot + 2 && r.y0 <= b.yTop - 2)) a.fracao = true;
    }
    q.alternatives = alts.map((a) => ({
      letter: a.letter,
      text: a.parts.join(' ').replace(/\s+/g, ' ').trim(),
      figs: a.figs,
      fracao: !!a.fracao,
      faixa: a.faixa ?? null,
      box: a.box,
    }));
    q.body = blocos.filter((b) => b.text).map((b) => b.text).join('\n\n');
    delete q.elems;
  }
  return { questoes, numPages: doc.numPages, doc };
}

if (process.argv[1]?.endsWith('parse.mjs')) {
  const [file] = process.argv.slice(2);
  const r = await parsePdf(file);
  const ok = r.questoes.filter((q) => q.alternatives.length === 5).length;
  console.log(file, 'questões', r.questoes.length, 'com 5 alternativas', ok);
  console.log('faltando 5 alts:', r.questoes.filter((q) => q.alternatives.length !== 5).map((q) => `${q.number}(${q.alternatives.length})`).join(' '));
  if (process.env.SHOW) {
    for (const q of r.questoes.filter((q) => String(q.number) === process.env.SHOW)) {
      for (const b of q.blocos) console.log(b.fig ? `[FIG p${b.fig.p} ${b.fig.x0.toFixed(0)},${b.fig.y0.toFixed(0)}-${b.fig.x1.toFixed(0)},${b.fig.y1.toFixed(0)}]` : '¶ ' + b.text);
      for (const a of q.alternatives) console.log(a.letter, '|', a.text, a.figs.length ? `[${a.figs.length} fig]` : '');
    }
  }
}
