// Lê o gabarito oficial usando as coordenadas do PDF.
//
// O texto linearizado não serve: em vários anos a coluna do número e a da
// letra ficam desalinhadas na vertical, e a letra acaba pareada com o número
// da linha seguinte (2015, 2º dia). Aqui a letra é a que está na mesma altura
// do número, logo à direita dele.
import './globals.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const LETRA = /^(?:([A-E])|(anulad\w*))$/i;

/**
 * `caderno` é o número do caderno do PDF da prova. Alguns gabaritos antigos
 * (2009) trazem quatro cadernos lado a lado, e cada um tem a sua ordem de
 * questões: ler a coluna errada devolve o gabarito de outra prova.
 */
export async function lerGabarito(file, caderno = null) {
  const doc = await getDocument({ url: file, verbosity: 0 }).promise;
  const g = new Map();
  let faixa = null;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    let itens = [];
    for (const it of tc.items) {
      const t = it.str.trim();
      if (!t) continue;
      itens.push({ t, x: it.transform[4], y: it.transform[5], w: it.width });
    }
    // Cabeçalhos "Caderno N": recorta a faixa horizontal do caderno pedido.
    const cabecalhos = itens
      .map((i) => ({ i, m: /^Caderno\s*(\d+)$/i.exec(i.t) }))
      .filter((x) => x.m)
      .map((x) => ({ n: +x.m[1], x: x.i.x }))
      .sort((a, b) => a.x - b.x);
    if (caderno && cabecalhos.length > 1) {
      const idx = cabecalhos.findIndex((c) => c.n === caderno);
      if (idx >= 0) {
        faixa = {
          ini: cabecalhos[idx].x - 25,
          fim: idx + 1 < cabecalhos.length ? cabecalhos[idx + 1].x - 25 : Infinity,
        };
      }
    }
    // O cabeçalho só existe na 1ª página; a faixa vale para o documento todo.
    if (faixa) itens = itens.filter((i) => i.x >= faixa.ini && i.x < faixa.fim);
    const numeros = itens.filter((i) => /^\d{1,3}$/.test(i.t) && +i.t >= 1 && +i.t <= 180);
    const letras = itens
      .map((i) => ({ ...i, m: LETRA.exec(i.t) }))
      .filter((i) => i.m)
      .map((i) => ({ ...i, v: i.m[1] ? i.m[1].toUpperCase() : 'ANULADA' }));
    for (const n of numeros) {
      // letras na mesma altura, à direita, dentro da mesma coluna da tabela
      const linha = letras
        .filter((l) => Math.abs(l.y - n.y) <= 4 && l.x > n.x + n.w - 1 && l.x - n.x < 175)
        .sort((a, b) => a.x - b.x);
      if (!linha.length) continue;
      const num = +n.t;
      if (g.has(num)) continue;
      // 1..5 (e 91..95 em alguns anos) têm duas colunas: inglês e espanhol
      if (linha.length >= 2 && linha[1].x - linha[0].x > 25) g.set(num, { ingles: linha[0].v, espanhol: linha[1].v });
      else g.set(num, linha[0].v);
    }
  }
  return g;
}

if (process.argv[1]?.endsWith('gabarito.mjs')) {
  const g = await lerGabarito(process.argv[2]);
  const linhas = [...g].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}=${typeof v === 'object' ? v.ingles + '/' + v.espanhol : v}`);
  console.log(linhas.join(' '));
}
