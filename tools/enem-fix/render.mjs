import './globals.mjs';
// Recorta uma região de uma página do PDF como PNG. A página é renderizada
// num processo à parte (render-page.mjs) e fica em cache no disco.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = fileURLToPath(new URL('.', import.meta.url));
const CACHE = join(aqui, '..', 'pages');
mkdirSync(CACHE, { recursive: true });
const SCALE = 3;
const mem = new Map();
async function pagina(file, p) {
  const png = join(CACHE, `${basename(file)}.${p}.png`);
  if (!existsSync(png)) execFileSync(process.execPath, [join(aqui, 'render-page.mjs'), file, String(p), png, String(SCALE)], { stdio: 'ignore' });
  if (!mem.has(png)) { if (mem.size > 4) mem.delete(mem.keys().next().value); mem.set(png, await loadImage(png)); }
  return mem.get(png);
}
/** box em coordenadas PDF (origem embaixo à esquerda). `ref` = { file, h }. */
export async function cropPng(ref, p, box, pad = 4) {
  const img = await pagina(ref.file, p);
  const h = img.height / SCALE;
  const x = Math.max(0, (box.x0 - pad) * SCALE);
  const y = Math.max(0, (h - box.y1 - pad) * SCALE);
  const w = Math.min(img.width - x, (box.x1 - box.x0 + 2 * pad) * SCALE);
  const hh = Math.min(img.height - y, (box.y1 - box.y0 + 2 * pad) * SCALE);
  const out = createCanvas(Math.round(w), Math.round(hh));
  out.getContext('2d').drawImage(img, x, y, w, hh, 0, 0, w, hh);
  return out.toBuffer('image/png');
}
