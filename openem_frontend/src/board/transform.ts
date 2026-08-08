// Helpers de geometria puros para o Quadro de Estudos (issue #32). Testáveis,
// sem React/DOM. Usados pelo editor (seleção/resize/giro), export (bbox) e snap.

import type { BoardElement, Point } from './types';

export const HANDLE_SIZE = 9;

/** Arredonda para a grade (snap). */
export function snap(v: number, grid: number): number {
  if (!grid || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Centro do bbox do elemento. */
export function elementCenter(el: BoardElement): Point {
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}

/** Move todos os pontos de um traço (stroke) por (dx,dy). */
function movePoints(el: BoardElement, dx: number, dy: number): BoardElement {
  if (!el.points) return el;
  return {
    ...el,
    points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

/** Move um elemento. Para stroke, reposiciona o bbox e translada os pontos. */
export function moveElement(
  el: BoardElement,
  dx: number,
  dy: number,
): BoardElement {
  if (el.kind === 'stroke') {
    const moved = movePoints(el, dx, dy);
    const xs = moved.points!.map((p) => p.x);
    const ys = moved.points!.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { ...moved, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

/** Rotaciona um ponto em torno de um centro (graus). */
export function rotateAround(p: Point, center: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export type ResizeHandle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

/**
 * Redimensiona um elemento a partir do arrasto de um handle. O delta
 * (dxScreen, dyScreen) vem em coords do mundo. Trabalha no frame local do
 * elemento (sem rotação) e mantém o centro fixo quando há rotação, para o
 * giro não distorcer o resize.
 */
export function resizeElement(
  el: BoardElement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): BoardElement {
  let { x, y, w, h } = el;
  const left = handle.includes('w');
  const right = handle.includes('e');
  const top = handle.includes('n');
  const bottom = handle.includes('s');
  if (left) {
    x += dx;
    w -= dx;
  }
  if (right) {
    w += dx;
  }
  if (top) {
    y += dy;
    h -= dy;
  }
  if (bottom) {
    h += dy;
  }
  // Evita w/h negativos (flip); mantém mínimo de 4px.
  if (w < 4) {
    if (left) x = el.x + el.w - 4;
    w = 4;
  }
  if (h < 4) {
    if (top) y = el.y + el.h - 4;
    h = 4;
  }
  return { ...el, x, y, w, h };
}

/** Hit-test: um ponto (em coords do mundo) está dentro do bbox do elemento? */
export function hitTest(el: BoardElement, p: Point): boolean {
  if (el.kind === 'stroke' && el.points && el.points.length > 0) {
    // Tolerância para traços: verifica proximidade a qualquer segmento.
    const r = (el.strokeWidth ?? 2) + 6;
    for (let i = 1; i < el.points.length; i++) {
      if (distToSegment(p, el.points[i - 1], el.points[i]) <= r) return true;
    }
    return false;
  }
  if (el.kind === 'line' || el.kind === 'arrow') {
    const a = { x: el.x, y: el.y };
    const b = { x: el.x + el.w, y: el.y + el.h };
    return distToSegment(p, a, b) <= (el.strokeWidth ?? 2) + 6;
  }
  return p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

/** BBox de todos os elementos (para dimensionar o SVG de export). */
export function boardsBBox(elements: BoardElement[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (elements.length === 0) return { x: 0, y: 0, w: 1000, h: 700 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    let x1 = el.x;
    let y1 = el.y;
    let x2 = el.x + el.w;
    let y2 = el.y + el.h;
    if (el.kind === 'stroke' && el.points && el.points.length) {
      x1 = Math.min(...el.points.map((p) => p.x));
      y1 = Math.min(...el.points.map((p) => p.y));
      x2 = Math.max(...el.points.map((p) => p.x));
      y2 = Math.max(...el.points.map((p) => p.y));
    }
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  const pad = 24;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

/** Converte coordenada de tela → mundo dado pan/zoom. */
export function screenToWorld(
  screen: Point,
  pan: Point,
  zoom: number,
): Point {
  return { x: (screen.x - pan.x) / zoom, y: (screen.y - pan.y) / zoom };
}