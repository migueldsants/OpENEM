// Pré-renderiza cada página do site em HTML estático (dist/), para a primeira
// pintura não depender do JavaScript: celular simples em 3G vê o texto antes
// de o React carregar, e buscadores leem a página inteira.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const ssr = join(raiz, 'dist-ssr');

const { paginas, renderizar } = await import(pathToFileURL(join(ssr, 'entry-server.js')).href);

// Lê todos os modelos antes de gravar: /docs/ é gravado em docs/index.html,
// que é o próprio modelo das outras páginas da documentação.
const lista = paginas();
const modelos = new Map(
  [...new Set(lista.map((p) => p.modelo))].map((m) => [m, readFileSync(join(dist, m), 'utf8')]),
);

for (const pagina of lista) {
  const modelo = modelos.get(pagina.modelo);
  if (!modelo.includes('<!--app-html-->')) throw new Error(`modelo sem marcador: ${pagina.modelo}`);
  const { html, head } = await renderizar(pagina.url);
  const saida = modelo
    .replace('<!--app-html-->', html)
    .replace('<!--app-head-->', head ?? '');
  const destino = join(dist, pagina.url, 'index.html');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, saida);
  console.log(`prerender ${pagina.url} -> ${destino.slice(raiz.length + 1)}`);
}

// O bundle de servidor só serve ao build.
rmSync(ssr, { recursive: true, force: true });
