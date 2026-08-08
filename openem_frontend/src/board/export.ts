// Export do Quadro de Estudos (issue #32): SVG, PNG (alta res), PDF (A4 print),
// e import `.openem`. O SVG é montado como string standalone com KaTeX HTML em
// `<foreignObject>` + CSS do KaTeX inline. v1: as fontes KaTeX podem cair para
// fallback no raster (limitação documentada); o `.openem` é lossless.

import type { Board, BoardElement } from './types';
import { boardsBBox, elementCenter } from './transform';
import { parseOpenEm } from './serialize';

// CSS do KaTeX embutido como string (vai pro <style> do SVG de export).
import katexCssText from 'katex/dist/katex.min.css?inline';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ARROW_ID = 'board-arrowhead';

/** Renderiza um elemento como string SVG (espelha render.tsx para export). */
function elementToSvg(el: BoardElement, katexHtml: (latex: string) => string): string {
  const stroke = el.color ?? 'currentColor';
  const sw = el.strokeWidth ?? 2;
  const rot = el.rotation ?? 0;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const transform = rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : '';
  const open = (extra = '') => `<g data-id="${escapeXml(el.id)}"${transform}${extra}>`;
  const close = '</g>';

  switch (el.kind) {
    case 'rect':
      return `${open()}<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="4" fill="${el.fill ?? 'none'}" stroke="${stroke}" stroke-width="${sw}"/>${close}`;
    case 'ellipse':
      return `${open()}<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${el.fill ?? 'none'}" stroke="${stroke}" stroke-width="${sw}"/>${close}`;
    case 'line':
      return `${open()}<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>${close}`;
    case 'arrow':
      return `${open()}<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#${ARROW_ID})"/>${close}`;
    case 'stroke': {
      const pts = (el.points ?? []).map((p) => `${p.x},${p.y}`).join(' ');
      return `${open()}<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${el.highlight ? sw + 6 : sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${el.highlight ? 0.35 : 1}"/>${close}`;
    }
    case 'text': {
      const fs = el.fontSize ?? 18;
      const lines = (el.text ?? '').split('\n');
      const tspans = lines
        .map(
          (ln, i) =>
            `<tspan x="${el.x}" dy="${i === 0 ? 0 : fs * 1.2}">${escapeXml(ln)}</tspan>`,
        )
        .join('');
      return `${open()}<text x="${el.x}" y="${el.y}" fill="${stroke}" font-size="${fs}" font-family="ui-sans-serif, system-ui, sans-serif">${tspans}${close}</text>`;
    }
    case 'sticky':
      return `${open()}<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="6" fill="${el.fill ?? '#fff7cc'}" stroke="${stroke}" stroke-width="1"/><foreignObject x="${el.x + 6}" y="${el.y + 6}" width="${el.w - 12}" height="${el.h - 12}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:${el.fontSize ?? 14}px;color:#5a4a1a;white-space:pre-wrap;word-break:break-word">${escapeHtml(el.text ?? '')}</div></foreignObject>${close}`;
    case 'mindnode':
      return `${open()}<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.h / 2}" fill="${el.fill ?? '#e0234e'}" stroke="${stroke ?? 'transparent'}" stroke-width="1"/><foreignObject x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:ui-sans-serif,system-ui,sans-serif;font-size:${el.fontSize ?? 14}px;font-weight:600;color:#fff;text-align:center;padding:0 10px">${escapeHtml(el.text ?? '')}</div></foreignObject>${close}`;
    case 'image':
      return el.src
        ? `${open()}<image href="${el.src}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="xMidYMid meet"/>${close}`
        : '';
    case 'formula': {
      const html = katexHtml(el.latex ?? '');
      return `${open()}<foreignObject x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}">${html}</foreignObject>${close}`;
    }
    default:
      return '';
  }
}

function mindLinksSvg(board: Board): string {
  return board.elements
    .filter((e) => e.kind === 'mindnode' && e.linkTo)
    .map((n) => {
      const target = board.elements.find((e) => e.id === n.linkTo);
      if (!target) return '';
      const a = elementCenter(n);
      const b = elementCenter(target);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#6b6473" stroke-width="2" marker-end="url(#${ARROW_ID})"/>`;
    })
    .join('');
}

function defsSvg(board: Board): string {
  const bg = board.background ?? 'grid';
  const bgRect =
    bg === 'blank'
      ? ''
      : `<pattern id="bg" width="${bg === 'dots' ? 24 : 32}" height="${bg === 'dots' ? 24 : 32}" patternUnits="userSpaceOnUse">${
          bg === 'dots'
            ? '<circle cx="2" cy="2" r="1.5" fill="#ece5ee"/>'
            : '<path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ece5ee" stroke-width="1"/>'
        }</pattern><rect width="100%" height="100%" fill="url(#bg)"/>`;
  return `<defs><marker id="${ARROW_ID}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6b6473"/></marker></defs>${bgRect}`;
}

/** Constrói a string SVG standalone do quadro (com KaTeX renderizado). */
export async function toSVG(board: Board): Promise<string> {
  let renderLatex = (latex: string) =>
    `<span style="font-family:monospace">${escapeHtml(latex)}</span>`;
  try {
    const katex = (await import('katex')).default;
    renderLatex = (latex: string) =>
      katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    /* sem katex — fallback texto */
  }

  const bbox = boardsBBox(board.elements);
  const inner = [
    defsSvg(board),
    mindLinksSvg(board),
    ...board.elements.map((el) => elementToSvg(el, renderLatex)),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}" width="${bbox.w}" height="${bbox.h}"><style>${katexCssText}</style>${inner}</svg>`;
}

/** Gera um dataURL PNG de alta resolução (scale). */
export async function toPNGDataUrl(board: Board, scale = 2): Promise<string> {
  const svg = await toSVG(board);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const bbox = boardsBBox(board.elements);
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bbox.w * scale));
    canvas.height = Math.max(1, Math.round(bbox.h * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao renderizar imagem do SVG.'));
    img.src = src;
  });
}

/** Abre uma janela A4 print-ready com o quadro (PNG) e dispara a impressão. */
export async function printPDF(board: Board): Promise<void> {
  const png = await toPNGDataUrl(board, 2);
  const w = window.open('', '_blank');
  if (!w) throw new Error('Pop-up bloqueado. Permita pop-ups para exportar PDF.');
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(board.title)} — PDF</title><style>@page{size:A4;margin:12mm}html,body{margin:0}img{max-width:100%;max-height:100%;display:block;margin:auto}</style></head><body><img src="${png}"/></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// --- Download helpers ---

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(text: string, filename: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  downloadDataUrl(URL.createObjectURL(blob), filename);
}

export function downloadSvg(svg: string, filename: string) {
  downloadText(svg, filename, 'image/svg+xml');
}

/** Lê um arquivo .openem e devolve um Board válido (ou lança erro amigável). */
export async function importOpenEmFile(file: File) {
  const text = await file.text();
  return parseOpenEm(text);
}