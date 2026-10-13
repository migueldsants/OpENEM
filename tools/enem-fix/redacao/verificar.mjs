import '../globals.mjs';
// Confere o catálogo contra o caderno, caractere a caractere, usando um
// SEGUNDO extrator (pdf.js; o catálogo é montado com o MuPDF). Dois programas
// independentes lendo o mesmo PDF e chegando ao mesmo texto é o que garante
// que nada foi trocado, pulado ou reordenado.
//
//   1. Cada bloco de texto do catálogo precisa existir na página com a mesma
//      sequência de caracteres (só espaço e hífen de quebra são ignorados).
//      Bloco que junta pedaços separados na página (linhas de fonte,
//      capitular) é conferido pedaço a pedaço, sem sobrar caractere.
//   2. O tema tem de aparecer no comando com a mesma grafia.
//   3. Com --sobras, lista o que a página tem e o catálogo não: deve ser só
//      instruções, cabeçalho, rodapé, rótulos e texto de dentro das figuras.
//
//   node redacao/verificar.mjs [id…] [--sobras]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const catalogo = JSON.parse(readFileSync(join(aqui, '..', '..', '..', 'openem_frontend', 'src', 'data', 'redacoes.json'), 'utf8'));
const args = process.argv.slice(2);
const so = args.filter((a) => !a.startsWith('--'));
const mostrarSobras = args.includes('--sobras');

/**
 * Cadernos em que o pdf.js decodifica mal as letras acentuadas (devolve "Í"
 * no lugar de "ê"). Neles a comparação vale só para os caracteres ASCII; os
 * acentos são conferidos à parte, contra a imagem da página.
 */
const SO_ASCII = new Set(['2002-regular']);

/**
 * Blocos que os dois extratores não conseguem confirmar e que foram conferidos
 * a olho contra a imagem da página. Cada um tem o motivo; qualquer divergência
 * fora desta lista derruba a verificação.
 */
const CONFERIDOS_NA_IMAGEM = {
  '2015-regular': { 'Texto IV/titulo': 'título em versalete: o PDF guarda outra caixa' },
  '2011-regular': { comando: 'tema em versalete: o PDF guarda outra caixa' },
  '2007-regular': { comando: 'tema em fonte de destaque: os extratores divergem na caixa' },
  '2006-regular': { comando: 'tema em fonte de destaque: os extratores divergem na caixa' },
  '2014-terceira': { 'Texto III/p': 'última linha ilegível no PDF, relida da página' },
  '2002-regular': { 'texto 5/p': 'pdf.js decodifica mal os acentos deste caderno', 'texto 4/p': 'pdf.js decodifica mal os acentos deste caderno' },
  '2009-regular': { '*': 'página inteira em imagem: só referência e comando foram lidos da página' },
  '2008-regular': { 'texto 1/fonte': 'texto em imagem: a referência foi lida da página' },
};

/** Só o que conta para a comparação: sem espaço e sem hífen, aspas igualadas. */
const chave = (s, ascii) => {
  const k = s
    .normalize('NFC')
    .replace(/[\s­\-‐‑]/g, '')
    .replace(/[“”„"]/g, '"')
    .replace(/[‘’']/g, "'");
  return ascii ? k.replace(/[^\x21-\x7e]/g, '') : k;
};

let falhas = 0;
let conferidos = 0;
for (const p of catalogo) {
  if (so.length && !so.includes(p.id)) continue;
  const ascii = SO_ASCII.has(p.id);
  const consertado = join(aqui, 'pdfs', `${p.id}.fix.pdf`);
  const arquivo = existsSync(consertado) ? consertado : join(aqui, 'pdfs', `${p.id}.pdf`);
  const paginas = JSON.parse(readFileSync(join(aqui, 'paginas', `${p.id}.json`), 'utf8')).filter((b) => b.tipo === 'pagina').map((b) => b.p);
  const doc = await getDocument({ url: arquivo, verbosity: 0 }).promise;
  let pagina = '';
  for (const n of paginas) {
    const tc = await (await doc.getPage(n)).getTextContent();
    pagina += tc.items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('');
  }
  const tudo = chave(pagina, ascii);
  let resto = tudo;
  const blocos = [{ onde: 'comando', texto: p.proposta }];
  for (const [n, t] of p.textos.entries()) {
    for (const b of t.blocos) if (b.texto) blocos.push({ onde: `${t.rotulo || `texto ${n + 1}`}/${b.t}`, texto: b.texto });
  }
  const problemas = [];
  const emPedacos = [];
  const naImagem = [];
  const vistos = CONFERIDOS_NA_IMAGEM[p.id] || {};
  // Os mais longos primeiro: um trecho curto não "rouba" um pedaço de outro.
  for (const b of [...blocos].sort((x, y) => y.texto.length - x.texto.length)) {
    const k = chave(b.texto, ascii);
    if (!k) continue;
    const i = resto.indexOf(k);
    if (i >= 0) {
      resto = resto.slice(0, i) + '\u0001' + resto.slice(i + k.length);
      conferidos++;
      continue;
    }
    let pos = 0;
    let pedacos = 0;
    let ruim = null;
    while (pos < k.length) {
      let n = 0;
      while (pos + n < k.length && tudo.includes(k.slice(pos, pos + n + 1))) n++;
      // Pedaço curto demais é coincidência, não trecho — fora a capitular.
      if (n < Math.min(12, k.length - pos) && !(pos === 0 && n === 1)) { ruim = pos + n; break; }
      const j = resto.indexOf(k.slice(pos, pos + n));
      if (j >= 0) resto = resto.slice(0, j) + '\u0001' + resto.slice(j + n);
      pos += n;
      pedacos++;
    }
    if (ruim == null && pedacos <= 6) {
      conferidos++;
      emPedacos.push(`${b.onde} em ${pedacos}`);
      continue;
    }
    const motivo = vistos[b.onde] || vistos['*'];
    if (motivo) { naImagem.push(`${b.onde}: ${motivo}`); continue; }
    const at = ruim ?? pos;
    problemas.push(`  ${b.onde}: diverge depois de «${k.slice(Math.max(0, at - 40), at)}» → catálogo segue «${k.slice(at, at + 30)}»`);
  }
  if (p.tema && !chave(p.proposta).includes(chave(p.tema))) problemas.push(`  tema «${p.tema}» não aparece assim no comando`);
  falhas += problemas.length;
  const nota = [ascii ? 'só ASCII' : '', emPedacos.length ? `em pedaços: ${emPedacos.length}` : '', ...naImagem.map((x) => `conferido na imagem — ${x}`)].filter(Boolean).join(' · ');
  console.log(`${p.id}: ${blocos.length - naImagem.length - problemas.filter((x) => !x.includes('tema «')).length}/${blocos.length} blocos idênticos${nota ? ` (${nota})` : ''}${problemas.length ? '\n' + problemas.join('\n') : ''}`);
  if (mostrarSobras) {
    for (const s of resto.split('\u0001').filter((x) => x.length > 3)) console.log(`    sobra: ${s.slice(0, 150)}${s.length > 150 ? `… (+${s.length - 150})` : ''}`);
  }
}
console.log(`\n${conferidos} blocos conferidos, ${falhas} divergência(s)`);
process.exitCode = falhas ? 1 : 0;
