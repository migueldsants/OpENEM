// Helpers de geometria puros para o Quadro de Estudos (issue #32). Testáveis,
// sem React/DOM. Usados pelo editor (seleção/resize/giro), export (bbox) e snap.

import type { BoardElement, Point } from './types';

export const HANDLE_SIZE = 9;

/** BBox retangular normalizado (w,h >= 0). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sobreposição AABB (eixos alinhados). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  const ax = a.x + a.w;
  const ay = a.y + a.h;
  const bx = b.x + b.w;
  const by = b.y + b.h;
  return a.x < bx && b.x < ax && a.y < by && b.y < ay;
}

/** BBox de um conjunto de elementos (sem padding). Empty → {0,0,0,0}. */
export function groupBBox(els: BoardElement[]): Rect {
  if (els.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    const b = elementBBox(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** BBox de um único elemento (stroke usa os pontos; demais o x/y/w/h). */
export function elementBBox(el: BoardElement): Rect {
  if (el.kind === 'stroke' && el.points && el.points.length) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: el.x, y: el.y, w: el.w, h: el.h };
}

/** Ids cujo bbox intersecta o retângulo de marquee (normaliza w/h). */
export function marqueeSelect(
  elements: BoardElement[],
  rect: Rect,
): string[] {
  const norm: Rect =
    rect.w < 0 || rect.h < 0
      ? {
          x: rect.w < 0 ? rect.x + rect.w : rect.x,
          y: rect.h < 0 ? rect.y + rect.h : rect.y,
          w: Math.abs(rect.w),
          h: Math.abs(rect.h),
        }
      : rect;
  return elements.filter((el) => rectsIntersect(elementBBox(el), norm)).map((el) => el.id);
}

/** 4 vértices do losango (pontos médios das bordas do bbox). */
export function diamondPoints(el: BoardElement): [Point, Point, Point, Point] {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return [
    { x: cx, y: el.y },
    { x: el.x + el.w, y: cy },
    { x: cx, y: el.y + el.h },
    { x: el.x, y: cy },
  ];
}

/** Ponto dentro de um polígono (ray-casting). */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

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
  if (el.kind === 'diamond') {
    // Aplica rotação inversa antes do teste de polígono.
    let q = p;
    const rot = el.rotation ?? 0;
    if (rot) q = rotateAround(p, elementCenter(el), -rot);
    return pointInPolygon(q, diamondPoints(el));
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
export function boardsBBox(
  elements: BoardElement[],
  pad = 24,
): {
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

/** Move um conjunto de elementos (generaliza moveElement p/ seleção múltipla). */
export function moveElements(
  els: BoardElement[],
  ids: Set<string>,
  dx: number,
  dy: number,
): BoardElement[] {
  return els.map((el) => (ids.has(el.id) ? moveElement(el, dx, dy) : el));
}

/**
 * Corta uma polilinha de traço onde os segmentos cruzam o círculo da borracha
 * (centro + raio). Devolve as sub-polilinhas remanescentes (cada uma vira um
 * novo traço). Descarta sub-polilinhas de ≤1 ponto. Pura e testável (sem DOM).
 */
export function splitStrokeAtEraser(
  points: Point[],
  eraser: { center: Point; r: number },
): Point[][] {
  if (points.length <= 1) return [];
  const { center, r } = eraser;
  const inside = (p: Point) => Math.hypot(p.x - center.x, p.y - center.y) <= r;

  const subs: Point[][] = [];
  // Não começa sub dentro da região apagada.
  let current: Point[] = inside(points[0]) ? [] : [points[0]];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const aIn = inside(a);
    const bIn = inside(b);
    const segDist = distToSegment(center, a, b);

    if (segDist > r) {
      // Segmento totalmente fora do círculo.
      if (current.length === 0) current = [a];
      current.push(b);
    } else if (aIn && bIn) {
      // Segmento totalmente apagado: fecha a sub atual.
      if (current.length > 1) subs.push(current);
      current = [];
    } else if (!aIn && bIn) {
      // Entra na região apagada: corta na entrada e fecha a sub.
      const cuts = segmentCircleIntersections(a, b, center, r);
      const entry = cuts[0];
      if (current.length === 0) current = [a];
      if (entry) current.push(entry);
      if (current.length > 1) subs.push(current);
      current = [];
    } else if (aIn && !bIn) {
      // Sai da região apagada: corta na saída e inicia nova sub.
      const cuts = segmentCircleIntersections(a, b, center, r);
      const exit = cuts[cuts.length - 1];
      current = exit ? [exit, b] : [b];
    } else {
      // Ambos fora, mas o segmento cruza o círculo (corda): dois cortes.
      const cuts = segmentCircleIntersections(a, b, center, r);
      if (cuts.length === 2) {
        if (current.length === 0) current = [a];
        current.push(cuts[0]);
        if (current.length > 1) subs.push(current);
        current = [cuts[1], b];
      } else {
        // Tangente: mantém o segmento.
        if (current.length === 0) current = [a];
        current.push(b);
      }
    }
  }
  if (current.length > 1) subs.push(current);
  return subs;
}

/** Interseções de um segmento [a,b] com um círculo (centro c, raio r). */
function segmentCircleIntersections(
  a: Point,
  b: Point,
  c: Point,
  r: number,
): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - c.x;
  const fy = a.y - c.y;
  const A = dx * dx + dy * dy || 1e-12;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const sqrt = Math.sqrt(disc);
  const t1 = (-B - sqrt) / (2 * A);
  const t2 = (-B + sqrt) / (2 * A);
  const out: Point[] = [];
  if (t1 >= 0 && t1 <= 1) out.push({ x: a.x + t1 * dx, y: a.y + t1 * dy });
  if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 1e-9)
    out.push({ x: a.x + t2 * dx, y: a.y + t2 * dy });
  return out;
}