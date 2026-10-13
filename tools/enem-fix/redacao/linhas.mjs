// Mostra as linhas de blocos específicos: node linhas.mjs <id> <bloco> [bloco…]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));
const [id, ...bs] = process.argv.slice(2);
const blocos = JSON.parse(readFileSync(join(aqui, 'paginas', `${id}.json`), 'utf8'));
for (const i of bs) {
  console.log(`-- ${id} #${i} ${JSON.stringify(blocos[i].box?.map(Math.round))}`);
  (blocos[i].linhas || []).forEach((l, k) => l.t.trim() && console.log(`  ${k}: ${l.t.trim().slice(0, 80)}`));
}
