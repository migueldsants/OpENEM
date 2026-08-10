import { describe, it, expect } from 'vitest';
import {
  snap,
  moveElement,
  resizeElement,
  hitTest,
  boardsBBox,
  rotateAround,
  screenToWorld,
  groupBBox,
  rectsIntersect,
  marqueeSelect,
  diamondPoints,
  pointInPolygon,
  splitStrokeAtEraser,
  moveElements,
} from './transform';
import type { BoardElement } from './types';

const rect = (over: Partial<BoardElement> = {}): BoardElement => ({
  id: 'r',
  kind: 'rect',
  x: 100,
  y: 100,
  w: 80,
  h: 50,
  ...over,
});

describe('transform helpers', () => {
  it('snap arredonda para a grade', () => {
    expect(snap(13, 8)).toBe(16);
    expect(snap(13, 0)).toBe(13);
  });

  it('moveElement translata bbox e pontos do traço', () => {
    const r = moveElement(rect(), 10, 20);
    expect(r.x).toBe(110);
    expect(r.y).toBe(120);
    const s: BoardElement = {
      id: 's',
      kind: 'stroke',
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
    };
    const moved = moveElement(s, 10, 10);
    expect(moved.points).toEqual([
      { x: 11, y: 12 },
      { x: 13, y: 14 },
    ]);
    expect(moved.x).toBe(11);
    expect(moved.w).toBe(2);
  });

  it('resizeElement nw diminui w/h', () => {
    const r = resizeElement(rect(), 'nw', 10, 10);
    expect(r.x).toBe(110);
    expect(r.y).toBe(110);
    expect(r.w).toBe(70);
    expect(r.h).toBe(40);
  });

  it('resizeElement se aumenta w/h', () => {
    const r = resizeElement(rect(), 'se', 10, 10);
    expect(r.x).toBe(100);
    expect(r.w).toBe(90);
    expect(r.h).toBe(60);
  });

  it('resizeElement não permite w/h negativos (flip)', () => {
    const r = resizeElement(rect(), 'se', -200, 0);
    expect(r.w).toBeGreaterThanOrEqual(4);
  });

  it('hitTest acerta dentro do bbox', () => {
    expect(hitTest(rect(), { x: 120, y: 120 })).toBe(true);
    expect(hitTest(rect(), { x: 50, y: 50 })).toBe(false);
  });

  it('hitTest acerta traço por proximidade', () => {
    const s: BoardElement = {
      id: 's',
      kind: 'stroke',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      strokeWidth: 2,
    };
    expect(hitTest(s, { x: 50, y: 0 })).toBe(true);
    expect(hitTest(s, { x: 50, y: 50 })).toBe(false);
  });

  it('boardsBBox cobre todos os elementos com padding', () => {
    const bb = boardsBBox([
      rect({ x: 100, y: 100, w: 80, h: 50 }),
      rect({ x: 300, y: 400, w: 10, h: 10 }),
    ]);
    expect(bb.x).toBeLessThanOrEqual(100);
    expect(bb.x + bb.w).toBeGreaterThanOrEqual(310);
    expect(bb.y + bb.h).toBeGreaterThanOrEqual(410);
  });

  it('boardsBBox vazio retorna padrão', () => {
    expect(boardsBBox([])).toEqual({ x: 0, y: 0, w: 1000, h: 700 });
  });

  it('rotateAround gira 90 graus', () => {
    const p = rotateAround({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(1, 5);
  });

  it('screenToWorld converte considerando pan/zoom', () => {
    expect(screenToWorld({ x: 110, y: 60 }, { x: 10, y: 10 }, 2)).toEqual({
      x: 50,
      y: 25,
    });
  });

  it('rectsIntersect detecta sobreposição AABB', () => {
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('groupBBox une vários elementos', () => {
    const g = groupBBox([rect({ x: 100, y: 100, w: 80, h: 50 }), rect({ x: 0, y: 0, w: 10, h: 10 })]);
    expect(g).toEqual({ x: 0, y: 0, w: 180, h: 150 });
    expect(groupBBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('marqueeSelect pega retângulos que intersectam', () => {
    const els = [rect({ id: 'a', x: 0, y: 0, w: 10, h: 10 }), rect({ id: 'b', x: 100, y: 100, w: 10, h: 10 })];
    expect(marqueeSelect(els, { x: 5, y: 5, w: 20, h: 20 })).toEqual(['a']);
    expect(marqueeSelect(els, { x: 30, y: 30, w: -25, h: -25 })).toEqual(['a']); // normaliza negativo (5..30 sobrepõe a)
  });

  it('diamondPoints retorna os 4 vértices', () => {
    const d = rect({ kind: 'diamond', x: 0, y: 0, w: 40, h: 40 });
    expect(diamondPoints(d)).toEqual([
      { x: 20, y: 0 },
      { x: 40, y: 20 },
      { x: 20, y: 40 },
      { x: 0, y: 20 },
    ]);
  });

  it('pointInPolygon acerta dentro/fora', () => {
    const poly = [
      { x: 20, y: 0 },
      { x: 40, y: 20 },
      { x: 20, y: 40 },
      { x: 0, y: 20 },
    ];
    expect(pointInPolygon({ x: 20, y: 20 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 0, y: 0 }, poly)).toBe(false);
  });

  it('hitTest acerta losango', () => {
    const d = rect({ kind: 'diamond', x: 0, y: 0, w: 40, h: 40 });
    expect(hitTest(d, { x: 20, y: 20 })).toBe(true);
    expect(hitTest(d, { x: 0, y: 0 })).toBe(false);
  });

  it('splitStrokeAtEraser: sem corte', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(splitStrokeAtEraser(pts, { center: { x: 200, y: 200 }, r: 5 })).toEqual([pts]);
  });

  it('splitStrokeAtEraser: corte no meio gera 2 subs', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    const subs = splitStrokeAtEraser(pts, { center: { x: 50, y: 0 }, r: 5 });
    expect(subs.length).toBe(2);
  });

  it('splitStrokeAtEraser: apaga tudo', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const subs = splitStrokeAtEraser(pts, { center: { x: 10, y: 0 }, r: 50 });
    expect(subs).toEqual([]);
  });

  it('splitStrokeAtEraser: descarta sub de 1 ponto', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
    // Apaga o primeiro segmento perto de x=0; sub [p0] deve ser descartada.
    const subs = splitStrokeAtEraser(pts, { center: { x: 5, y: 0 }, r: 20 });
    expect(subs.every((s) => s.length > 1)).toBe(true);
  });

  it('moveElements move o conjunto', () => {
    const els = [rect({ id: 'a', x: 0, y: 0 }), rect({ id: 'b', x: 100, y: 100 })];
    const out = moveElements(els, new Set(['a']), 10, 20);
    expect(out[0].x).toBe(10);
    expect(out[0].y).toBe(20);
    expect(out[1].x).toBe(100);
  });

  it('boardsBBox cobre stroke e diamond', () => {
    const bb = boardsBBox([
      { id: 's', kind: 'stroke', x: 0, y: 0, w: 0, h: 0, points: [{ x: 5, y: 5 }, { x: 15, y: 15 }] },
      rect({ kind: 'diamond', x: 100, y: 100, w: 40, h: 40 }),
    ]);
    expect(bb.x).toBeLessThanOrEqual(5);
    expect(bb.x + bb.w).toBeGreaterThanOrEqual(140);
  });
});