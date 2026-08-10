// Helpers de traço compartilhados por render.tsx (JSX) e export.ts (string),
// para evitar divergência entre as duas representações. Puros, sem React/DOM.

import { getStroke } from 'perfect-freehand';
import type { BoardElement } from './types';

/** Opções do perfect-freehand conforme o elemento (caneta vs marca-texto). */
export function strokeOptions(el: BoardElement) {
  const sw = el.strokeWidth ?? 2;
  const hasPressure = (el.points ?? []).some((p) => typeof p.p === 'number');
  if (el.highlight) {
    return {
      size: sw + 10,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.4,
      simulatePressure: false,
      last: true,
    } as const;
  }
  return {
    size: sw * 2.2 + 2,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !hasPressure,
    last: true,
  } as const;
}

/** Constrói o contorno do traço (perfect-freehand) e devolve o `d` do path. */
export function strokeOutlineD(el: BoardElement): string {
  const points = (el.points ?? []).map((p) =>
    typeof p.p === 'number'
      ? { x: p.x, y: p.y, pressure: p.p }
      : { x: p.x, y: p.y },
  );
  const outline = getStroke(points, strokeOptions(el));
  if (outline.length === 0) return '';
  return (
    outline
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]} ${pt[1]}`)
      .join(' ') + ' Z'
  );
}

/** Path do losango (4 vértices meio-borda). */
export function diamondPathD(el: BoardElement): string {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return `M ${cx} ${el.y} L ${el.x + el.w} ${cy} L ${cx} ${el.y + el.h} L ${el.x} ${cy} Z`;
}