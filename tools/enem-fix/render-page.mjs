// Renderiza UMA página em PNG com o MuPDF (WASM).
import * as mupdf from 'mupdf';
import { readFileSync, writeFileSync } from 'node:fs';
const [file, p, out, scale = '3'] = process.argv.slice(2);
const doc = mupdf.Document.openDocument(readFileSync(file), 'application/pdf');
const page = doc.loadPage(+p - 1);
const pix = page.toPixmap(mupdf.Matrix.scale(+scale, +scale), mupdf.ColorSpace.DeviceRGB, false, true);
writeFileSync(out, pix.asPNG());
