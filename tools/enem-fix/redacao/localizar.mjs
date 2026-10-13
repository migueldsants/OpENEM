// Acha, em cada caderno, a(s) página(s) da proposta de redação.
import * as mupdf from 'mupdf';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const fontes = JSON.parse(readFileSync(join(aqui, 'fontes.json'), 'utf8'));
const out = {};
for (const f of fontes) {
  const doc = mupdf.Document.openDocument(readFileSync(join(aqui, 'pdfs', `${f.id}.pdf`)), 'application/pdf');
  const n = doc.countPages();
  const achadas = [];
  for (let i = 0; i < n; i++) {
    const t = doc.loadPage(i).toStructuredText().asText();
    const s = t.replace(/\s+/g, ' ');
    const pontos =
      (/PROPOSTA DE REDA/i.test(s) ? 3 : 0) +
      (/texto dissertativo/i.test(s) ? 2 : 0) +
      (/TEXTOS? MOTIVADOR/i.test(s) ? 2 : 0) +
      (/^\s*REDA[ÇC][ÃA]O/i.test(s) || /\bREDAÇÃO\b/.test(s) ? 1 : 0) +
      (/INSTRUÇÕES( PARA A REDAÇÃO)?:?/i.test(s) && /rascunho/i.test(s) ? 1 : 0);
    if (pontos >= 3) achadas.push({ p: i + 1, pontos, chars: s.length, ini: s.slice(0, 90) });
  }
  out[f.id] = { paginas: n, achadas };
  console.log(f.id, n, achadas.map((a) => `${a.p}(${a.pontos},${a.chars})`).join(' '));
}
writeFileSync(join(aqui, 'paginas.json'), JSON.stringify(out, null, 1));
