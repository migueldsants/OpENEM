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
const ANO_SOLTO = /^(19|20)\d\d$/;
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
// Byte de cada caractere do MacRoman: o pdfjs lê como MacRoman fontes que
// são, na verdade, WinAnsi (ENEM 2002): "gr·fico", "composiÁ„o".
const MAC = new Map([...new TextDecoder('macintosh').decode(Uint8Array.from({ length: 256 }, (_, i) => i))].map((c, i) => [c, i]));
const WIN = new TextDecoder('windows-1252');

/**
 * Desfaz a leitura em MacRoman de um texto WinAnsi: "As ·reas" → "As áreas".
 * Caractere que não existe no MacRoman deixa o texto como está.
 */
export function deMacRoman(t) {
  const bytes = [...t].map((c) => MAC.get(c));
  return bytes.some((b) => b === undefined) ? t : WIN.decode(Uint8Array.from(bytes));
}

export function juntaLigadura(t) {
  return t.replace(/(^|[\s(«“"'a-zà-ÿ])(fi|fl) (?=[a-zà-ÿ])/g, '$1$2');
}

// ENEM antigo (1998–2008): cada ano tem um cabeçalho de questão — "03 O texto
// retrata..." (1998/1999, número colado ao enunciado), o número solto numa
// linha (2000–2003, 2005), "1." (2004) e "Questão 1" (2006–2008). O número é
// sempre um item à parte, e o que separa cabeçalho de texto comum é ele ser o
// próximo da sequência.
const RE_Q_ANTIGO = /^(?:QUEST[ÃA]O\s*)?0*(\d{1,2})\s*\.?$/i;
// Linhas de serviço do caderno antigo, repetidas no alto das páginas.
const SERVICO_ANTIGO = /^(QUEST[ÕO]ES OBJETIVAS|PARTE OBJETIVA|ANTES DE MARCAR|CASO CONTR[ÁA]RIO|A COR DE SEU CADERNO|CADERNO DE QUEST[ÕO]ES\. CASO|ENEM\s*(19|20)?\d\d\b.*$|PROVA \d\b|AMARELA\b)|PROVA\s*\S{0,2}\s*[-–—₋]?\s*AMARELA|AMARELA\s*[-–—]\s*PROVA|^\S{1,3}\s+AMARELA$/i;

/**
 * Marca d'água "ENEM 2007" do rodapé (2006–2008), que vem espaçada
 * ("E N E M 2 0 0 7") ou com as letras dobradas ("EE NENN EEE MM 22 0200").
 */
export function marcaDagua(texto) {
  const t = texto.replace(/\s+/g, '');
  return t.length <= 60 && /E{1,2}N{1,2}E{0,2}N{0,2}E{1,3}M{1,2}2{1,2}0{1,4}[0-9]{1,2}/.test(t) && !/[a-z]{3}/.test(t.replace(/PÁGINA|GINA|PROVA|AMARELA/gi, ''));
}

/**
 * Linha que pode ser cabeçalho de questão no caderno antigo: o primeiro item é
 * só o número ("03", "1.", "Questão 7"). Devolve o número, o resto da linha (o
 * começo do enunciado em 1998/1999) e quantos itens o cabeçalho ocupa; null
 * quando a linha não tem cara de cabeçalho.
 */
export function cabecalhoAntigo(itens) {
  const limpos = itens.map((s) => s.trim()).filter(Boolean);
  let [primeiro = '', ...resto] = limpos;
  let consumidos = 1;
  // "Questão" e o número podem vir em itens separados, e a própria palavra
  // vem picada às vezes ("Quest" + "ã" + "o", em 2006)
  let palavra = primeiro;
  for (let k = 0; k < resto.length && /^QUEST/i.test(palavra) && !/^QUEST[ÃA]O$/i.test(palavra); k++) {
    if (/\d/.test(resto[k])) break;
    palavra += resto[k];
    if (/^QUEST[ÃA]O$/i.test(palavra)) {
      resto.splice(0, k + 1);
      consumidos += k + 1;
      primeiro = palavra;
      break;
    }
  }
  if (/^QUEST[ÃA]O$/i.test(primeiro) && resto.length) {
    primeiro += ' ' + resto.shift();
    consumidos++;
  }
  const m = RE_Q_ANTIGO.exec(primeiro);
  if (!m || +m[1] < 1 || +m[1] > 99) return null;
  return { n: +m[1], resto: resto.join(' ').trim(), consumidos };
}

/**
 * Entre os candidatos a cabeçalho (em ordem de leitura), a sequência 1, 2, 3...
 * que numera as questões. Número solto também aparece na capa (as instruções
 * vão de 1 a 12), em rótulo de figura e em tabela; o que separa o cabeçalho é
 * ele continuar a sequência. A sequência tolera saltar até dois números (um
 * cabeçalho que o parser não achou vira pendência, não derruba o resto) e,
 * entre as de mesmo tamanho, fica a que começa depois — a capa vem antes da
 * prova. Depois refaz só com os candidatos da altura predominante dos
 * escolhidos: o número do cabeçalho é maior que o da capa e o da tabela.
 * `cands`: [{ n, alt }]. Devolve os índices escolhidos.
 */
export function sequenciaDeCabecalhos(cands) {
  const cadeia = (lista) => {
    const melhor = lista.map(() => null); // { tam, ini, ant }
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].n <= 2) melhor[i] = { tam: 1, ini: i, ant: -1 };
      for (let j = 0; j < i; j++) {
        const d = lista[i].n - lista[j].n;
        if (!melhor[j] || d < 1 || d > 3) continue;
        const c = { tam: melhor[j].tam + 1, ini: melhor[j].ini, ant: j };
        const m = melhor[i];
        if (!m || c.tam > m.tam || (c.tam === m.tam && c.ini > m.ini)) melhor[i] = c;
      }
    }
    let fim = -1;
    for (let i = 0; i < lista.length; i++) {
      const m = melhor[i], f = fim >= 0 ? melhor[fim] : null;
      if (m && (!f || m.tam > f.tam || (m.tam === f.tam && m.ini > f.ini))) fim = i;
    }
    const idx = [];
    for (let i = fim; i >= 0; i = melhor[i].ant) idx.unshift(i);
    return idx;
  };
  const idx = cadeia(cands);
  const conta = new Map();
  for (const i of idx) conta.set(cands[i].alt, (conta.get(cands[i].alt) ?? 0) + 1);
  const [alt, n] = [...conta].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!n || n < idx.length * 0.6) return idx;
  const mesmos = cands.map((c, i) => ({ ...c, i })).filter((c) => Math.abs(c.alt - alt) <= Math.max(1.5, alt * 0.15));
  const idx2 = cadeia(mesmos).map((k) => mesmos[k].i);
  return idx2.length >= n ? idx2 : idx;
}

/**
 * Trechos "(X) texto" de uma linha com várias alternativas: "(A) 20. (B) 30."
 * Linha que não começa com "(A)".."(E)" não é de alternativas: devolve [].
 */
export function trechosDeAlternativas(texto) {
  if (!/^\([A-E]\)/.test(texto.trim())) return [];
  return texto
    .trim()
    .split(/\s*(?=\([A-E]\))/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ letra: t[1], texto: t }));
}

/**
 * Alternativas em grade, várias por linha ("(A) 365 anos.  (D) 10 000 anos."
 * em cima de "(B) 460 anos.  (E) ..."): cada uma vira uma linha própria, na
 * ordem das letras, para o resto do parser vê-las uma embaixo da outra.
 */
function separaGrade(els) {
  const out = [];
  // "(A) 20. (B) 30." pelo texto; "A 20.  B 30." (2006–2008, letra num item
  // à parte) pelos itens: letra solta, na fonte da letra A, depois de um vão.
  const trechos = (l) => {
    if (l.kind !== 'line') return [];
    const t = trechosDeAlternativas(l.text);
    if (t.length) return t.map((x) => ({ ...x, items: [{ ...l.items[0], str: x.texto }] }));
    const its = l.items;
    if (!/^[A-E]$/.test(its[0].str.trim())) return [];
    const ks = [0];
    for (let k = 1; k < its.length; k++) {
      const letra = its[k].str.trim();
      const ant = its[ks[ks.length - 1]].str.trim();
      const vao = its[k].x - (its[k - 1].x + its[k - 1].w);
      if (/^[A-E]$/.test(letra) && letra > ant && its[k].f === its[0].f && vao > 6) ks.push(k);
    }
    return ks.map((k, j) => {
      const items = its.slice(k, ks[j + 1] ?? its.length);
      return { letra: its[k].str.trim(), texto: items.map((i) => i.str).join(' '), items };
    });
  };
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    if (trechos(e).length < 2) { out.push(e); continue; }
    const linhas = [e];
    while (i + 1 < els.length && els[i + 1].p === e.p && els[i + 1].c === e.c && trechos(els[i + 1]).length) linhas.push(els[++i]);
    const todos = linhas.flatMap((l) => trechos(l).map((t) => ({ ...t, l })));
    todos.sort((a, b) => a.letra.localeCompare(b.letra));
    todos.forEach((t, k) => {
      const x1 = Math.max(...t.items.map((i) => i.x + i.w));
      out.push({ ...t.l, items: t.items, text: t.texto, x0: t.items[0].x, x1, y: e.y - k * 0.01, grade: true });
    });
  }
  return out;
}

/** Letra de alternativa no formato "(A)" do caderno antigo; null se não for. */
export function letraAntiga(texto) {
  const m = /^\(([A-E])\)/.exec(texto.trim());
  return m ? m[1] : null;
}

export async function parsePdf(file, { antigo = false } = {}) {
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
      if (f.gid) return decodificaGid(it.str, f.tab);
      // Caderno antigo: fonte WinAnsi lida como MacRoman. Decide por fonte:
      // "·", "„", "Á" colados numa minúscula ("gr·fico", "composiÁ„o") não
      // existem em português, e somem depois da conversão.
      if (antigo && f.mac === undefined) {
        const estranhos = (t) => (t.match(/[a-zà-ÿ][·„ı‡ÁÈÍÛ]|[·„ı][a-zà-ÿ]/g) ?? []).length;
        const n = estranhos(f.txt);
        f.mac = n >= 3 && estranhos(deMacRoman(f.txt)) < n / 4;
      }
      return f.mac ? deMacRoman(it.str) : it.str;
    };
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const x = it.transform[4] - vx0, y = it.transform[5] - vy0;
      if (y < 12 || y > h - 12) continue;
      itens.push({ x, y, str: fixSymbol(decod(it)), hgt: it.height || Math.abs(it.transform[3]), w: it.width, f: it.fontName, c: x < meio - 5 ? 0 : 1 });
    }
    // Caderno antigo em página mista: uma tabela ou figura larga faz a página
    // parecer de coluna única, mas há cabeçalho de questão começando na metade
    // direita (2002: a 4 e a 5 lado a lado embaixo da 3, que ocupa a largura
    // toda). Da altura desse cabeçalho para baixo, o que começa na coluna da
    // direita é a coluna 1. As colunas nem sempre são iguais (em 2006 a da
    // esquerda é mais larga): a da direita começa onde está o cabeçalho dela,
    // menos o recuo que o cabeçalho da esquerda tem em relação à margem.
    let corteDir = null;
    let xDir = null;
    if (antigo && umaColuna) {
      const hs = itens.map((i) => i.hgt).sort((a, b) => a - b);
      const mediana = hs[Math.floor(hs.length / 2)] || 9;
      const ehCab = (i) => i.y > 45 && (/^Quest/i.test(i.str.trim()) || (RE_Q_ANTIGO.test(i.str.trim()) && i.hgt >= mediana * 1.15));
      const dir = itens.filter((i) => i.x > w / 2 - 30 && ehCab(i));
      if (dir.length) {
        const esq = itens.filter((i) => i.x <= w / 2 - 30 && ehCab(i));
        const xs = itens.map((i) => i.x).sort((a, b) => a - b);
        const margemEsq = xs[Math.floor(xs.length * 0.05)];
        const recuo = esq.length ? Math.max(0, Math.min(...esq.map((i) => i.x)) - margemEsq) : 0;
        xDir = Math.min(...dir.map((i) => i.x)) - recuo - 5;
        corteDir = Math.max(...dir.map((i) => i.y)) + 10;
        for (const i of itens) if (i.y <= corteDir && i.x >= xDir) i.c = 1;
      }
    }
    const colunaDe = (b) => (corteDir !== null ? (b.y1 <= corteDir && b.x0 >= xDir ? 1 : 0) : (b.x0 + b.x1) / 2 < meio ? 0 : 1);
    // Caderno antigo: palavra sublinhada ("inadequada", em 1998). O traço fica
    // logo abaixo da linha de base e dentro da largura do texto — não é barra
    // de fração, que fica entre duas linhas.
    const sublinhado = (b) => antigo && b.y1 - b.y0 < 2 && itens.some((i) => b.y1 <= i.y + 0.5 && b.y1 >= i.y - 4 && b.x0 >= i.x - 2 && b.x1 <= i.x + i.w + 2);
    marcasPag.push(...g0.marcas.map(desloca).filter((b) => !sublinhado(b)).map((b) => ({ ...b, p })));
    barrasPag.push(...g0.barras.map(desloca).filter((b) => !sublinhado(b)).map((b) => ({ ...b, p, c: colunaDe(b) })));
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
    figurasPag.push(gr.map((g) => ({ ...g, p, c: colunaDe(g), w, h })));
  }
  for (const l of linhas) {
    l.items.sort((a, b) => a.x - b.x);
    l.items = l.items.filter((it, i, arr) => !arr.slice(0, i).some((o) => o.str === it.str && Math.abs(o.x - it.x) < 1 && Math.abs(o.y - it.y) < 1));
    l.x0 = l.items[0].x;
    l.x1 = Math.max(...l.items.map((i) => i.x + i.w));
    // Negrito falso (2007): o título é desenhado duas vezes, deslocado, e o
    // pdfjs devolve itens sobrepostos ("O c", "ca", "an"...). Não dá para
    // separar as cópias com segurança: o parágrafo sai como imagem.
    l.dobrada = antigo && l.items.filter((it, k) => k > 0 && it.x < l.items[k - 1].x + l.items[k - 1].w - 1.5).length >= 3;
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

  // Caderno antigo: os cabeçalhos de questão são escolhidos antes das figuras,
  // para a caixinha em volta do número não virar figura nem engolir a linha.
  if (antigo) {
    const ord = [...linhas].sort((a, b) => a.p - b.p || a.c - b.c || b.y - a.y);
    // número de página fica no rodapé; o cabeçalho, nunca
    const cands = ord
      .filter((l) => l.y > 45 && !SERVICO_ANTIGO.test(l.text))
      .map((l) => ({ l, cab: cabecalhoAntigo(l.items.map((i) => i.str)) }))
      .filter((c) => c.cab)
      .map((c) => ({ ...c, n: c.cab.n, alt: Math.round(c.l.items[c.cab.consumidos - 1].hgt * 2) / 2 }));
    if (process.env.DEBUG_CAB) console.log(cands.map((c) => `${c.n}@p${c.l.p}c${c.l.c}:${c.alt}`).join(' '));
    for (const i of sequenciaDeCabecalhos(cands)) cands[i].l.cabecalho = cands[i].cab;
    // Fio decorativo sob o número da questão (2004): não é barra de fração.
    const cabs = linhas.filter((l) => l.cabecalho);
    for (let k = barrasPag.length - 1; k >= 0; k--) {
      const b = barrasPag[k];
      if (cabs.some((l) => l.p === b.p && Math.abs(b.y1 - l.y) < 15 && b.x0 <= l.items[0].x + 20 && b.x1 >= l.items[0].x)) barrasPag.splice(k, 1);
    }
  }

  // Figuras: agrupa caixas próximas (mesma página/coluna) numa figura só.
  const figuras = [];
  // Linha que é só a letra de uma alternativa (o círculo dela é um desenho).
  const soLetra = (l) => /^[A-E]$/.test(l.items[0].str.trim()) || (antigo && !!letraAntiga(l.items[0].str));
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
      // Caderno antigo: moldura ou fundo do número da questão.
      const numero = antigo && linhas.some((l) => l.p === g.p && l.cabecalho && g.y0 <= l.y + 12 && g.y1 >= l.y - 6 && g.x0 <= l.items[0].x + 4 && g.x1 >= l.items[0].x);
      if (numero && g.y1 - g.y0 < 40 && g.x1 - g.x0 < 80) continue;
      // Fio que separa as questões (em 1998, centenas de imagens minúsculas
      // enfileiradas): largo e baixo demais para ser figura.
      if (antigo && g.y1 - g.y0 < 20 && g.x1 - g.x0 > g.w * 0.6) continue;
      // Rótulos de eixo/legenda encostados no desenho fazem parte da figura.
      // Uma passada só, contra a caixa original: iterar cresceria em cadeia.
      const orig = { ...g };
      for (const l of linhas) {
        if (l.p !== g.p || soLetra(l) || RE_Q.test(l.text) || l.absorvida || l.cabecalho) continue;
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
  // Caderno antigo: o texto antes da 1ª questão, na mesma página, é dela.
  const antes = [];
  // Cabeçalho e rodapé de página: o mesmo texto (fora os números), na mesma
  // altura, em três páginas ou mais. No caderno antigo eles não seguem um
  // padrão ("ENEM 98" numa fonte simbólica, "È amarela").
  const chaveRepetida = (e) => `${Math.round(e.y)}|${e.text.replace(/\d+/g, '#')}`;
  const repetidas = new Set();
  if (antigo) {
    const paginas = new Map();
    for (const e of seq) {
      if (e.kind !== 'line' || (e.y > 60 && e.y < e.h - 60)) continue;
      const k = chaveRepetida(e);
      if (!paginas.has(k)) paginas.set(k, new Set());
      paginas.get(k).add(e.p);
    }
    for (const [k, ps] of paginas) if (ps.size >= 3) repetidas.add(k);
  }
  for (const e of seq) {
    if (antigo && e.kind === 'line') {
      if (!e.cabecalho && (SERVICO_ANTIGO.test(e.text) || marcaDagua(e.text) || repetidas.has(chaveRepetida(e)))) {
        // A parte objetiva começa aqui: o que veio antes na página (a redação,
        // em 1998) não é texto de apoio da questão 1.
        if (/QUEST[ÕO]ES OBJETIVAS|PARTE OBJETIVA/i.test(e.text)) antes.length = 0;
        continue;
      }
      const cab = e.cabecalho;
      if (cab) {
        q = { number: cab.n, elems: questoes.length ? [] : antes.filter((x) => x.p === e.p), page: e.p };
        for (const x of q.elems) x.pre = true;
        questoes.push(q);
        if (cab.resto) {
          const items = e.items.slice(cab.consumidos);
          q.elems.push({ ...e, text: cab.resto, items, x0: items[0].x });
        }
        continue;
      }
      if (RODAPE.test(e.text)) continue;
    }
    if (antigo) {
      if (q) q.elems.push(e);
      else antes.push(e);
      continue;
    }
    if (e.kind === 'line') {
      if (RODAPE.test(e.text)) continue;
      // O ano do logotipo no alto da coluna (PPL 2010): não é texto da questão.
      if (ANO_SOLTO.test(e.text) && e.y > e.h - 90) continue;
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
    // "(A)" é inconfundível e vem recuado da margem em vários anos (1998).
    if (antigo && /^\(/.test(primeiro)) return letraAntiga(primeiro) === letra;
    if (fonteDasLetras && primeiro.length === 1 && !fonteDasLetras.has(it.f)) return false;
    // Alternativa de uma grade já separada: a posição na linha não importa.
    if (e.grade) return primeiro === letra;
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

  // Caderno antigo: o que vem depois da alternativa E é o texto de apoio da
  // questão seguinte (às vezes de um grupo: "As questões 10 e 11 referem-se
  // ao poema abaixo"), que lá aparece ANTES do número.
  let carry = [];
  for (const q of questoes) {
    let els = [...carry.map((e) => ({ ...e, pre: true })), ...q.elems];
    if (antigo) els = separaGrade(els);
    const sobra = [];
    const figs = els.filter((e) => e.kind === 'fig');
    const alts = [];
    const corpo = [];
    let esperado = 0;
    let ultimaLinha = null;
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
        if (ult) {
          if (mesmaColuna(ult.box, e) && Math.abs(e.y0 - ult.box.yLetra) < 12) ult.fracao = true;
          else if (antigo && alts.length === 5) sobra.push(e);
          continue;
        }
        else corpo.push({ barra: e });
        continue;
      }
      if (e.kind === 'fig') {
        // figura antes do A é do enunciado; depois, da alternativa corrente
        if (alts.length) {
          // Só é da alternativa se estiver na mesma coluna, logo abaixo da letra.
          const ult = alts[alts.length - 1];
          if (mesmaColuna(ult.box, e) && e.y1 <= ult.box.yTop + 30 && e.y1 >= ult.box.yBot - 40) ult.figs.push(e);
          else if (antigo && alts.length === 5) sobra.push(e);
        } else corpo.push({ fig: e, pre: !!e.pre });
        continue;
      }
      if (figs.some((f) => dentro(e, f)) && !/^[A-E]$/.test(e.items[0].str.trim()) && !(antigo && letraAntiga(e.items[0].str))) continue;
      const letra = 'ABCDE'[esperado];
      if (ehLetra(e, letra)) {
        const letraItem = e.items[0];
        // "(A)" pode vir num item só com o texto da alternativa
        const tamLetra = antigo && letraAntiga(letraItem.str) ? 3 : 1;
        const txt = e.text.trim().slice(tamLetra).trim();
        const colada = letraItem.str.trim().length > tamLetra;
        const xTexto = colada
          ? letraItem.x + (letraItem.w * (tamLetra + 1)) / letraItem.str.length
          : e.items[1]?.x ?? letraItem.x + letraItem.w + 3;
        const a = { letter: letra, parts: txt ? [txt] : [], figs: [], box: { p: e.p, c: e.c, yLetra: e.y, xLetraFim: colada ? xTexto - 2 : letraItem.x + letraItem.w, yTop: e.y + letraItem.hgt, yBot: e.y - 3, x0: e.x0, xTexto, x1: e.x1, w: e.w, h: e.h } };
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
      // No caderno antigo a fração da alternativa vem na linha ("1/3"): linha
      // recuada logo abaixo da alternativa anterior é continuação dela.
      const ultAlt = alts[alts.length - 1];
      const continua = antigo && ultAlt && mesmaColuna(e, ultAlt.box) && ultAlt.box.yBot + 3 - e.y < 16 && e.x0 > ultAlt.box.x0 + 3;
      if (!continua && alts.length && prox && ehLetra(prox, letra) && mesmaColuna(prox, e) && e.y - prox.y < 11 && e.x0 > prox.x0 + 3) {
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
        if (alts.length === 5) {
          if (antigo) sobra.push(e);
          continue;
        }
      }
      if (!alts.length) {
        const gap = ultimaLinha && mesmaColuna(ultimaLinha, e) ? ultimaLinha.y - e.y : null;
        corpo.push({ text: e.text, gap, x0: e.x0, x1: e.x1, y: e.y, p: e.p, c: e.c, hgt: e.items[0].hgt, pre: !!e.pre, dobrada: e.dobrada });
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
      if (c.fig) { par = null; pars.push({ fig: c.fig, pre: c.pre }); continue; }
      if (c.barra) { pars.push({ barra: c.barra }); continue; }
      // Novo parágrafo: salto vertical, troca do tamanho da fonte (a referência
      // bibliográfica é menor) ou recuo de primeira linha em relação à anterior.
      const ant = par?.linhas[par.linhas.length - 1];
      const trocaFonte = ant && Math.abs(ant.hgt - c.hgt) > 0.8;
      const recuo = ant && !trocaFonte && c.hgt >= ant.hgt - 0.5 && c.x0 > ant.x0 + 8 && ant.x0 <= minX + 3;
      const novo = !par || (c.gap && c.gap > normal * 1.45) || c.gap === null || trocaFonte || recuo || par.pre !== c.pre;
      if (novo) { par = { linhas: [], pre: c.pre }; pars.push(par); }
      par.linhas.push(c);
    }
    // Parágrafo com fórmula (barra de fração) vira imagem: o texto sairia torto.
    const barras = pars.filter((b) => b.barra).map((b) => b.barra);
    const blocos = [];
    for (const b of pars) {
      if (b.barra) continue;
      if (b.fig) { blocos.push({ fig: b.fig, pre: b.pre }); continue; }
      const ls = b.linhas;
      const uma = ls.every((l) => mesmaColuna(l, ls[0]));
      const caixa = { p: ls[0].p, c: ls[0].c, x0: Math.min(...ls.map((l) => l.x0)), x1: Math.max(...ls.map((l) => l.x1)), y0: Math.min(...ls.map((l) => l.y)) - 3, y1: Math.max(...ls.map((l) => l.y + l.hgt)) };
      const temMarca = uma && marcasPag.some((r) => r.p === caixa.p && r.y0 >= caixa.y0 - 2 && r.y1 <= caixa.y1 + 2 && r.x0 >= caixa.x0 + 2 && r.x1 <= caixa.x1 + 2);
      const lixoTxt = /[\u0000-\u0008\u000b-\u001f\ue000-\uf8ff¡]/.test(ls.map((l) => l.text).join(' '));
      // No caderno antigo a barra só é de fração dentro da altura do próprio
      // parágrafo: acima dele é fio de cabeçalho ou de figura.
      const folga = antigo ? 1 : 8;
      const temFracao = (uma && lixoTxt) || temMarca || (uma && ls.some((l) => l.dobrada)) || uma && barras.some((r) => r.p === caixa.p && r.y0 >= caixa.y0 - folga && r.y1 <= caixa.y1 + folga && r.x0 >= caixa.x0 - 4 && r.x1 <= caixa.x1 + 4);
      if (temFracao) {
        const acima = barras.filter((r) => r.p === caixa.p && r.x0 >= caixa.x0 - 4 && r.x1 <= caixa.x1 + 4);
        caixa.y0 = Math.min(caixa.y0, ...acima.filter((r) => r.y0 >= caixa.y0 - 8).map((r) => r.y0 - 9));
        blocos.push({ fig: caixa, formula: true, text: ls.map((l) => l.text).join('\n'), pre: b.pre });
      } else blocos.push({ text: ls.map((l) => l.text).join('\n'), pre: b.pre });
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
    carry = sobra;
  }
  return { questoes, numPages: doc.numPages, doc };
}

if (process.argv[1]?.endsWith('parse.mjs')) {
  const [file] = process.argv.slice(2);
  const r = await parsePdf(file, { antigo: !!process.env.ANTIGO });
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
