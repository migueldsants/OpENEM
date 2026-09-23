// Audita o dataset: números de questão ausentes e resíduo de extração.
//
// uso: node auditar.mjs <caminho do dataset/public>
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUA = /[-�]/;
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const MOJIBAKE = /Ã[\u0080-¿]|â€/;
// "10^(–4)" é marcador do próprio extrator: o expoente não virou sobrescrito.
const MARCADOR = /\^\(|_\([0-9+\-−–]{1,4}\)/;

const root = process.argv[2];
if (!root) {
  console.error('uso: node auditar.mjs <dataset/public>');
  process.exit(1);
}

let ausentes = 0;
let sujas = 0;
for (const prova of readdirSync(root).filter((d) => /^\d{4}/.test(d))) {
  const dir = join(root, prova, 'questions');
  const pastas = readdirSync(dir);
  const numeros = new Set(pastas.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)));
  const faltam = [];
  for (let n = 1; n <= 180; n++) {
    if (numeros.has(n) || (n <= 5 && pastas.includes(`${n}-ingles`))) continue;
    faltam.push(n);
  }
  const ruins = [];
  for (const d of pastas) {
    const q = JSON.parse(readFileSync(join(dir, d, 'details.json'), 'utf8'));
    const txt = [q.context, q.alternativesIntroduction, ...q.alternatives.map((a) => a.text)]
      .filter(Boolean)
      .join('\n');
    const semResposta = q.alternatives.some((a) => !(a.text || '').trim() && !a.file);
    if (PUA.test(txt) || CONTROLE.test(txt) || MOJIBAKE.test(txt) || MARCADOR.test(txt) || semResposta) ruins.push(d);
  }
  ausentes += faltam.length;
  sujas += ruins.length;
  if (faltam.length || ruins.length) {
    console.log(
      `${prova.padEnd(20)} ausentes=${String(faltam.length).padStart(3)} com resíduo=${String(ruins.length).padStart(3)}` +
        (faltam.length ? `\n   faltam: ${faltam.join(',')}` : '') +
        (ruins.length ? `\n   resíduo: ${ruins.slice(0, 12).join(' ')}` : ''),
    );
  }
}
console.log(`\ntotal: ${ausentes} questões ausentes, ${sujas} com resíduo de extração`);
