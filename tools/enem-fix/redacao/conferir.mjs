// Monta folhas de contato com as figuras recortadas (paginas/folha-N.png),
// para conferir de uma vez se algum recorte cortou a figura ou levou um
// pedaço do texto vizinho.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = fileURLToPath(new URL('.', import.meta.url));
const pasta = join(aqui, '..', '..', '..', 'openem_frontend', 'public', 'redacoes');
const arquivos = readdirSync(pasta).filter((a) => a.endsWith('.webp') && !a.includes('-pagina')).sort();
const COLS = 4, LINS = 3, W = 330, H = 300, ROT = 16;
for (let f = 0; f * COLS * LINS < arquivos.length; f++) {
  const folha = createCanvas(COLS * W, LINS * H);
  const ctx = folha.getContext('2d');
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, folha.width, folha.height);
  const lote = arquivos.slice(f * COLS * LINS, (f + 1) * COLS * LINS);
  for (const [i, nome] of lote.entries()) {
    const img = await loadImage(join(pasta, nome));
    const x = (i % COLS) * W, y = Math.floor(i / COLS) * H;
    const e = Math.min((W - 8) / img.width, (H - ROT - 8) / img.height);
    ctx.drawImage(img, x + 4, y + ROT + 4, img.width * e, img.height * e);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(nome.replace('.webp', ''), x + 4, y + 13);
  }
  writeFileSync(join(aqui, 'paginas', `folha-${f + 1}.png`), folha.toBuffer('image/png'));
}
console.log(arquivos.length, 'figuras');
