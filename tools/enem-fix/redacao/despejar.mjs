// Despeja, para cada caderno, os blocos de texto e de imagem da(s) página(s)
// da proposta de redação (paginas/<id>.json) e uma prévia em PNG. É a matéria
// bruta que o montar.mjs organiza em textos motivadores.
import * as mupdf from 'mupdf';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const fontes = JSON.parse(readFileSync(join(aqui, 'fontes.json'), 'utf8'));
const achadas = JSON.parse(readFileSync(join(aqui, 'paginas.json'), 'utf8'));
const so = process.argv.slice(2);
mkdirSync(join(aqui, 'paginas'), { recursive: true });

/** Página(s) da proposta. Fixas onde a pontuação automática não basta. */
const FIXAS = {
  '2000-regular': [2],
  '2001-regular': [2],
  '2002-regular': [2],
  '2003-regular': [2],
  '2004-regular': [2],
  '2005-regular': [2],
  '2006-regular': [2],
  '2007-regular': [2],
  '2008-regular': [2],
  '2009-regular': [2],
  '2020-digital': [52, 53],
  '2021-digital': [52, 53],
  '2022-digital': [57, 58],
  '2021-regular': [21],
  '2021-ppl': [20],
  '2025-regular': [20],
  '2025-belem': [20],
  '2025-ppl': [20],
};
export function paginasDe(id) {
  if (FIXAS[id]) return FIXAS[id];
  const fortes = achadas[id].achadas.filter((a) => a.pontos >= 8);
  return fortes.length ? [fortes[0].p] : [1];
}

const r1 = (n) => Math.round(n * 10) / 10;
for (const f of fontes) {
  if (so.length && !so.includes(f.id)) continue;
  // Caderno com fonte sem mapeamento Unicode: o texto vem da cópia consertada
  // pelo fixfonts.mjs (<id>.fix.pdf), quando ela existe.
  const consertado = join(aqui, 'pdfs', `${f.id}.fix.pdf`);
  const doc = mupdf.Document.openDocument(readFileSync(existsSync(consertado) ? consertado : join(aqui, 'pdfs', `${f.id}.pdf`)), 'application/pdf');
  const blocos = [];
  for (const p of paginasDe(f.id)) {
    const page = doc.loadPage(p - 1);
    const [, , w, h] = page.getBounds();
    const stext = page.toStructuredText('preserve-images');
    const st = JSON.parse(stext.asJSON());
    // Negrito e itálico, trecho a trecho: o JSON só traz a fonte da linha
    // inteira, então as linhas são percorridas de novo, caractere a caractere.
    // k = 1 negrito, 2 itálico, 3 os dois.
    const trechos = [];
    let cur = null;
    stext.walk({
      beginLine() { cur = []; },
      onChar(c, origem, font) {
        const nome = font.getName();
        const b = font.isBold() || /Bold|Black|Heavy|,B|-B[DI]?$/i.test(nome);
        const i = font.isItalic() || /Ital|Obli|,I|-I$|BI$/i.test(nome);
        const k = (b ? 1 : 0) + (i ? 2 : 0);
        if (cur.length && cur[cur.length - 1][1] === k) cur[cur.length - 1][0] += c;
        else cur.push([c, k]);
      },
      endLine() { trechos.push(cur); },
    });
    let nLinha = 0;
    for (const b of st.blocks) {
      const box = [r1(b.bbox.x), r1(b.bbox.y), r1(b.bbox.x + b.bbox.w), r1(b.bbox.y + b.bbox.h)];
      if (b.type === 'image') {
        blocos.push({ i: blocos.length, p, tipo: 'img', box });
        continue;
      }
      const linhas = (b.lines || []).map((l) => {
        const r = trechos[nLinha++] || [];
        const misto = r.some((x) => x[1]) && r.map((x) => x[0]).join('') === l.text;
        return { t: l.text, size: r1(l.font.size), bold: l.font.weight === 'bold', italic: l.font.style === 'italic', y: r1(l.bbox.y), x: r1(l.bbox.x), ...(misto ? { r } : {}) };
      });
      if (!linhas.some((l) => l.t.trim())) continue;
      blocos.push({ i: blocos.length, p, tipo: 'txt', box, linhas });
    }
    const pix = page.toPixmap(mupdf.Matrix.scale(1.25, 1.25), mupdf.ColorSpace.DeviceRGB, false, true);
    writeFileSync(join(aqui, 'paginas', `${f.id}.${p}.png`), pix.asPNG());
    blocos.push({ i: blocos.length, p, tipo: 'pagina', box: [0, 0, r1(w), r1(h)] });
  }
  writeFileSync(join(aqui, 'paginas', `${f.id}.json`), JSON.stringify(blocos));
  console.log(f.id, paginasDe(f.id).join(','), blocos.length);
}
