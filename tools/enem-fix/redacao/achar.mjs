// Mostra em que páginas de um caderno aparece um termo (para achar a proposta à mão).
import * as mupdf from 'mupdf';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));
const [termo, ...ids] = process.argv.slice(2);
const re = new RegExp(termo, 'i');
for (const id of ids) {
  const doc = mupdf.Document.openDocument(readFileSync(join(aqui, 'pdfs', `${id}.pdf`)), 'application/pdf');
  const out = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const s = doc.loadPage(i).toStructuredText().asText().replace(/\s+/g, ' ');
    const m = s.match(re);
    if (m) out.push(`${i + 1}: …${s.slice(Math.max(0, m.index - 40), m.index + 70)}…`);
  }
  console.log(id, doc.countPages(), '\n  ' + out.join('\n  '));
}
