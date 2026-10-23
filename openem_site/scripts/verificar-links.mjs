// Confere os links internos do site já construído (dist/): todo href/src que
// aponta para o próprio site precisa de um arquivo no build. Roda no CI depois
// do build, para uma página renomeada não deixar link quebrado na landing ou
// na documentação.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// Servidos por outros serviços atrás do mesmo nginx, não pelo site.
const DE_FORA = ['/app/', '/api/', '/media/', '/health'];

function htmls(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return htmls(caminho);
    return nome.endsWith('.html') ? [caminho] : [];
  });
}

function existe(url) {
  const caminho = decodeURIComponent(url.split(/[?#]/)[0]);
  if (DE_FORA.some((p) => caminho === p.replace(/\/$/, '') || caminho.startsWith(p))) return true;
  const alvo = join(dist, caminho);
  return caminho.endsWith('/') ? existsSync(join(alvo, 'index.html')) : existsSync(alvo);
}

const quebrados = [];
let total = 0;
for (const arquivo of htmls(dist)) {
  const html = readFileSync(arquivo, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
    total += 1;
    if (!existe(url)) quebrados.push(`${relative(dist, arquivo)}: ${url}`);
  }
}

if (quebrados.length) {
  console.error(`${quebrados.length} link(s) interno(s) quebrado(s):\n${quebrados.join('\n')}`);
  process.exit(1);
}
console.log(`links internos ok (${total})`);
