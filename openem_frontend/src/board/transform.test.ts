import { describe, it, expect } from 'vitest';
import {
  snap,
  moveElement,
  resizeElement,
  hitTest,
  boardsBBox,
  rotateAround,
  screenToWorld,
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
});