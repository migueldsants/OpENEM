// Pré-renderiza cada página do site em HTML estático (dist/), para a primeira
// pintura não depender do JavaScript: celular simples em 3G vê o texto antes
// de o React carregar, e buscadores leem a página inteira.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const ssr = join(raiz, 'dist-ssr');

const { paginas, renderizar, absolutizar, robotsTxt, siteUrl, sitemapXml } = await import(
  pathToFileURL(join(ssr, 'entry-server.js')).href
);

// Domínio da instalação (ex.: https://openem.exemplo). Sem ele, as URLs ficam
// relativas e o sitemap não é gerado: ele só aceita endereço completo.
const site = siteUrl(process.env.SITE_URL);

// Lê todos os modelos antes de gravar: /docs/ é gravado em docs/index.html,
// que é o próprio modelo das outras páginas da documentação.
const lista = paginas();
const modelos = new Map(
  [...new Set(lista.map((p) => p.modelo))].map((m) => [m, readFileSync(join(dist, m), 'utf8')]),
);

for (const pagina of lista) {
  const modelo = modelos.get(pagina.modelo);
  if (!modelo.includes('<!--app-html-->')) throw new Error(`modelo sem marcador: ${pagina.modelo}`);
  const { html, head, lang } = await renderizar(pagina.url);
  const saida = absolutizar(
    modelo
      .replace('<html lang="pt-BR">', `<html lang="${lang ?? 'pt-BR'}">`)
      .replace('<!--app-html-->', html)
      .replace('<!--app-head-->', head ?? ''),
    site,
    pagina.url,
  );
  const destino = join(dist, pagina.url, 'index.html');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, saida);
  console.log(`prerender ${pagina.url} -> ${destino.slice(raiz.length + 1)}`);
}

// Modelo que não é página (legal/index.html): fora do ar, com a pasta, para
// /legal/ dar 404 em vez de servir uma casca vazia. O JavaScript e o CSS dele
// ficam em assets/.
const gravadas = new Set(lista.map((p) => join(p.url, 'index.html')));
for (const modelo of modelos.keys()) {
  if (!gravadas.has(join('/', modelo))) {
    rmSync(join(dist, modelo));
    const pasta = dirname(join(dist, modelo));
    if (pasta !== dist && readdirSync(pasta).length === 0) rmSync(pasta, { recursive: true });
    console.log(`modelo sem página removido: ${modelo}`);
  }
}

writeFileSync(join(dist, 'robots.txt'), robotsTxt(site));
if (site) {
  writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(site, lista.map((p) => p.url)));
  console.log(`sitemap com ${lista.length} páginas (${site})`);
} else {
  console.log('SITE_URL não definido: sem sitemap.xml, URLs relativas');
}

// O bundle de servidor só serve ao build.
rmSync(ssr, { recursive: true, force: true });
