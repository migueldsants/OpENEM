// Baixa as fontes primárias para `fontes/` (fora do git) e anota a data de
// cada uma em `fontes/baixado-em.json`. É essa data que a tela mostra como
// "Dados conferidos em".
//
//   node tools/tabela-periodica/baixar.mjs [id…]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FONTES, PASTA_FONTES } from './comum.mjs';

const so = process.argv.slice(2);
mkdirSync(PASTA_FONTES, { recursive: true });
const registro = join(PASTA_FONTES, 'baixado-em.json');
const datas = existsSync(registro) ? JSON.parse(readFileSync(registro, 'utf8')) : {};

for (const [id, f] of Object.entries(FONTES)) {
  if (so.length && !so.includes(id)) continue;
  process.stdout.write(`${id}… `);
  const r = await fetch(f.url, {
    headers: { 'User-Agent': 'OpENEM tabela-periodica (https://github.com/migueldsants/OpENEM)' },
  });
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  const corpo = Buffer.from(await r.arrayBuffer());
  if (corpo.length < 1000) throw new Error(`${id}: resposta curta demais (${corpo.length} bytes)`);
  writeFileSync(join(PASTA_FONTES, f.arquivo), corpo);
  datas[id] = new Date().toISOString().slice(0, 10);
  console.log(`${(corpo.length / 1024).toFixed(0)} KB`);
}

writeFileSync(registro, `${JSON.stringify(datas, null, 2)}\n`);
