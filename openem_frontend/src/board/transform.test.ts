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
  moveEndpoint,
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
  atFront,
  atBack,
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

  it('resizeElement escala texto uniformemente (w/h/fonte pela razão dominante)', () => {
    const t = rect({ kind: 'text', id: 't', w: 86, h: 24, fontSize: 18 });
    // Arrasto vertical dominante (h: 24 → 48, razão 2) → dobra tudo, NW fixo.
    const out = resizeElement(t, 'se', 0, 24);
    expect(out.h).toBe(48);
    expect(out.w).toBe(172); // 86 * 2 (uniforme, não só a altura)
    expect(out.fontSize).toBe(36);
    expect(out.x).toBe(100);
    expect(out.y).toBe(100);
  });

  it('resizeElement texto: canto NW mantém o SE fixo', () => {
    const t = rect({ kind: 'text', id: 't', x: 100, y: 100, w: 86, h: 24, fontSize: 18 });
    // Arrasta NW p/ cima-esquerda (dx,dy negativos): razão 1.5, SE (186,124) fixo.
    const out = resizeElement(t, 'nw', -43, -12);
    expect(out.x + out.w).toBeCloseTo(186, 0);
    expect(out.y + out.h).toBeCloseTo(124, 0);
    expect(out.fontSize).toBeGreaterThan(18);
  });

  it('resizeElement texto: encolher respeita mínimo de fonte 6 e bbox 4', () => {
    const t = rect({ kind: 'text', id: 't', w: 86, h: 24, fontSize: 18 });
    const out = resizeElement(t, 'se', -82, -20); // arrasto p/ dentro → encolhe
    expect(out.fontSize).toBe(6);
    expect(out.w).toBeGreaterThanOrEqual(4);
    expect(out.h).toBeGreaterThanOrEqual(4);
  });

  it('resizeElement não muda a fonte de formas (só texto escala)', () => {
    const out = resizeElement(rect(), 'se', 0, 40);
    expect(out.h).toBe(90);
    expect((out as BoardElement).fontSize).toBeUndefined();
  });

  it('hitTest: retângulo vazado acerta só na borda (não no centro do bbox)', () => {
    // retângulo 100,100 80x50, sem preenchimento → borda apenas.
    expect(hitTest(rect(), { x: 100, y: 120 })).toBe(true); // aresta esquerda
    expect(hitTest(rect(), { x: 140, y: 100 })).toBe(true); // aresta superior
    expect(hitTest(rect(), { x: 140, y: 125 })).toBe(false); // centro do bbox
    expect(hitTest(rect(), { x: 50, y: 50 })).toBe(false); // fora
  });

  it('hitTest: retângulo preenchido acerta em qualquer ponto interno', () => {
    const r = rect({ fill: '#2563eb' });
    expect(hitTest(r, { x: 140, y: 125 })).toBe(true); // centro
    expect(hitTest(r, { x: 100, y: 120 })).toBe(true); // borda
    expect(hitTest(r, { x: 50, y: 50 })).toBe(false); // fora
  });

  it('hitTest: elipse vazada acerta na borda, não no centro', () => {
    const e = rect({ kind: 'ellipse', x: 0, y: 0, w: 80, h: 80 });
    expect(hitTest(e, { x: 40, y: 0 })).toBe(true); // topo (borda)
    expect(hitTest(e, { x: 40, y: 40 })).toBe(false); // centro
    const ef = rect({ kind: 'ellipse', x: 0, y: 0, w: 80, h: 80, fill: '#2563eb' });
    expect(hitTest(ef, { x: 40, y: 40 })).toBe(true); // centro preenchido
  });

  it('hitTest: forma rotacionada leva o ponto ao frame local', () => {
    // retângulo 80x50 girado 90° em torno do centro (140,125): vira 50(larg)x80(alt).
    const r = rect({ rotation: 90 });
    // (115,125) = meio da aresta esquerda da forma girada → borda → acerta.
    expect(hitTest(r, { x: 115, y: 125 })).toBe(true);
    // (140,125) = centro da forma girada → vazado, longe da borda → não acerta.
    expect(hitTest(r, { x: 140, y: 125 })).toBe(false);
    // Preenchido: centro acerta.
    expect(hitTest(rect({ rotation: 90, fill: '#2563eb' }), { x: 140, y: 125 })).toBe(true);
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

  it('hitTest acerta losango (borda se vazio, interior se preenchido)', () => {
    const d = rect({ kind: 'diamond', x: 0, y: 0, w: 40, h: 40 });
    expect(hitTest(d, { x: 20, y: 0 })).toBe(true); // vértice (borda)
    expect(hitTest(d, { x: 20, y: 20 })).toBe(false); // centro do losango vazio
    expect(hitTest(d, { x: 0, y: 0 })).toBe(false);
    const df = rect({ kind: 'diamond', x: 0, y: 0, w: 40, h: 40, fill: '#2563eb' });
    expect(hitTest(df, { x: 20, y: 20 })).toBe(true); // centro preenchido
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

  describe('moveEndpoint (alças de linha/seta)', () => {
    const line = (over: Partial<BoardElement> = {}): BoardElement => ({
      id: 'l',
      kind: 'line',
      x: 100,
      y: 100,
      w: 50,
      h: 0,
      ...over,
    });

    it('ep-end redefine o delta até o ponto', () => {
      const out = moveEndpoint(line(), 'ep-end', { x: 200, y: 130 });
      expect(out.x).toBe(100);
      expect(out.y).toBe(100);
      expect(out.w).toBe(100);
      expect(out.h).toBe(30);
    });

    it('ep-start redefine a origem e ajusta o delta', () => {
      const out = moveEndpoint(line(), 'ep-start', { x: 80, y: 120 });
      // extremidade final (x+w, y+h) = (150, 100) permanece
      expect(out.x).toBe(80);
      expect(out.y).toBe(120);
      expect(out.x + out.w).toBe(150);
      expect(out.y + out.h).toBe(100);
    });
  });

  describe('z-order (camadas)', () => {
    const abc = (): BoardElement[] => [
      rect({ id: 'a' }),
      rect({ id: 'b' }),
      rect({ id: 'c' }),
    ];

    it('bringToFront manda o selecionado para o final (topo)', () => {
      const out = bringToFront(abc(), ['a']);
      expect(out.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    });

    it('sendToBack manda o selecionado para o início (fundo)', () => {
      const out = sendToBack(abc(), ['c']);
      expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    });

    it('bringForward avança uma posição', () => {
      const out = bringForward(abc(), ['a']);
      expect(out.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    });

    it('sendBackward recua uma posição', () => {
      const out = sendBackward(abc(), ['c']);
      expect(out.map((e) => e.id)).toEqual(['a', 'c', 'b']);
    });

    it('preserva ordem relativa na multi-seleção (bringToFront)', () => {
      // a,b selecionados (nessa ordem no array) → vão ao topo mantendo a,b
      const out = bringToFront(abc(), ['a', 'b']);
      expect(out.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    });

    it('bringForward com múltiplos preserva ordem relativa', () => {
      const els = [rect({ id: 'a' }), rect({ id: 'x' }), rect({ id: 'b' }), rect({ id: 'y' }), rect({ id: 'c' })];
      // a,b avançam uma posição cada, trocando só com não-selecionados (x,y)
      const out = bringForward(els, ['a', 'b']);
      expect(out.map((e) => e.id)).toEqual(['x', 'a', 'y', 'b', 'c']);
    });

    it('idempotente nos limites (já no topo/fundo)', () => {
      const els = abc();
      expect(bringForward(els, ['c']).map((e) => e.id)).toEqual(['a', 'b', 'c']);
      expect(sendBackward(els, ['a']).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    it('atFront/atBack detectam os limites', () => {
      const els = abc();
      expect(atFront(els, ['c'])).toBe(true);
      expect(atFront(els, ['a'])).toBe(false);
      expect(atBack(els, ['a'])).toBe(true);
      expect(atBack(els, ['c'])).toBe(false);
      // multi: todos no topo
      expect(atFront(abc(), ['b', 'c'])).toBe(true);
      expect(atFront(abc(), ['a', 'c'])).toBe(false);
    });
  });
});