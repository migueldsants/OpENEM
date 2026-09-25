// Reescreve /Differences "gNN" (gid da fonte original) para "uniXXXX",
// consertando o texto das fontes sem ToUnicode (ENEM 2021 reaplicação).
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gidTable } from './gidmap.mjs';

// Glifos que a fonte do Windows não resolve (faixa estendida mudou entre
// versões, fonte Symbol): identificados à mão pela imagem — ver manual.json.
const manualUrl = new URL('./manual.json', import.meta.url);
const MANUAL = existsSync(manualUrl) ? JSON.parse(readFileSync(manualUrl, 'utf8')) : {};

const [src, dst] = process.argv.slice(2);
const pdf = await PDFDocument.load(readFileSync(src), { updateMetadata: false });
const ctx = pdf.context;
let fontes = 0, trocas = 0;
const pua = new Map();
for (const [, obj] of ctx.enumerateIndirectObjects()) {
  if (!(obj instanceof PDFDict)) continue;
  if (obj.get(PDFName.of('Type'))?.toString() !== '/Font') continue;
  const base = obj.get(PDFName.of('BaseFont'))?.toString().slice(1) ?? '';
  const semPrefixo = base.replace(/^[A-Z]{6}\+/, '');
  let enc = obj.get(PDFName.of('Encoding'));
  if (enc instanceof PDFRef) enc = ctx.lookup(enc);
  if (!(enc instanceof PDFDict)) continue;
  const diffs = enc.get(PDFName.of('Differences'));
  const arr = diffs instanceof PDFRef ? ctx.lookup(diffs) : diffs;
  if (!(arr instanceof PDFArray)) continue;
  const tabela = semPrefixo.includes('Symbol') ? null : gidTable(base);
  let mudou = false;
  for (let i = 0; i < arr.size(); i++) {
    const it = arr.get(i);
    if (!(it instanceof PDFName)) continue;
    const m = /^\/g(\d+)$/.exec(it.toString());
    if (!m) continue;
    const chave = `${semPrefixo}/g${m[1]}`;
    let ch = MANUAL[chave] ?? tabela?.get(+m[1]);
    if (!ch) {
      if (!pua.has(chave)) pua.set(chave, String.fromCodePoint(0xe000 + pua.size));
      ch = pua.get(chave);
    }
    const nome = [...ch].map((c) => c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
    arr.set(i, PDFName.of('uni' + nome));
    trocas++;
    mudou = true;
  }
  if (mudou) {
    fontes++;
    // Um ToUnicode incompleto venceria o nome do glifo: remove.
    obj.delete(PDFName.of('ToUnicode'));
  }
}
writeFileSync(dst, await pdf.save({ useObjectStreams: false }));
writeFileSync(dst + '.pua.json', JSON.stringify(Object.fromEntries([...pua].map(([k, v]) => [v.codePointAt(0).toString(16), k])), null, 1));
console.log(src, 'fontes corrigidas', fontes, 'glifos', trocas, 'sem mapa', [...pua.keys()]);
