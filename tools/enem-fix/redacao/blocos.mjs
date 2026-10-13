// Lista os blocos despejados de um caderno, para escrever o roteiro.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));
for (const id of process.argv.slice(2)) {
  console.log('#### ' + id);
  for (const b of JSON.parse(readFileSync(join(aqui, 'paginas', `${id}.json`), 'utf8'))) {
    if (b.tipo !== 'txt') { console.log(`#${b.i} p${b.p} ${b.tipo} ${JSON.stringify(b.box.map(Math.round))}`); continue; }
    const t = b.linhas.map((l) => l.t.trim()).join(' / ');
    if (/^\*\w+\*$/.test(t)) continue;
    console.log(`#${b.i} p${b.p} ${JSON.stringify(b.box.map(Math.round))} ${b.linhas.length}L ${b.linhas[0].size}${b.linhas[0].bold ? 'b' : ''} | ${t.length > 120 ? t.slice(0, 75) + ' […] ' + t.slice(-40) : t}`);
  }
}
