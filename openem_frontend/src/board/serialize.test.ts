import { describe, it, expect } from 'vitest';
import {
  toOpenEm,
  parseOpenEm,
  OpenEmParseError,
  cryptoRandomId,
} from './serialize';
import { createBoard, type Board } from './types';

function sampleBoard(overrides: Partial<Board> = {}): Board {
  return {
    ...createBoard({ id: 'b1', title: 'Quadro teste' }),
    elements: [
      {
        id: 'e1',
        kind: 'rect',
        x: 10,
        y: 20,
        w: 100,
        h: 50,
        color: '#e0234e',
        strokeWidth: 2,
      },
      {
        id: 'e2',
        kind: 'stroke',
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        points: [
          { x: 1, y: 1 },
          { x: 5, y: 6 },
        ],
        highlight: true,
      },
      {
        id: 'e3',
        kind: 'formula',
        x: 30,
        y: 30,
        w: 120,
        h: 40,
        latex: '\\frac{a}{b}',
      },
      {
        id: 'e4',
        kind: 'mindnode',
        x: 50,
        y: 80,
        w: 140,
        h: 40,
        text: 'Tópico',
        linkTo: 'e1',
      },
    ],
    ...overrides,
  };
}

describe('serialize .openem', () => {
  it('round-trip preserva o board sem perda', () => {
    const board = sampleBoard();
    const text = toOpenEm(board);
    const back = parseOpenEm(text);
    expect(back.id).toBe('b1');
    expect(back.title).toBe('Quadro teste');
    expect(back.schemaVersion).toBe(1);
    expect(back.type).toBe('study-board');
    expect(back.elements).toHaveLength(4);
    expect(back.elements[1].points).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 6 },
    ]);
    expect(back.elements[2].latex).toBe('\\frac{a}{b}');
    expect(back.elements[3].linkTo).toBe('e1');
  });

  it('rejeita JSON malformado', () => {
    expect(() => parseOpenEm('{ not json')).toThrow(OpenEmParseError);
  });

  it('rejeita tipo incorreto', () => {
    const bad = JSON.stringify({ ...sampleBoard(), type: 'other' });
    expect(() => parseOpenEm(bad)).toThrow(/tipo incorreto/);
  });

  it('rejeita schemaVersion incompatível', () => {
    const bad = JSON.stringify({ ...sampleBoard(), schemaVersion: 999 });
    expect(() => parseOpenEm(bad)).toThrow(/Versão .openem incompatível/);
  });

  it('rejeita se elements não é array', () => {
    const bad = JSON.stringify({ ...sampleBoard(), elements: null });
    expect(() => parseOpenEm(bad)).toThrow(/elements ausente/);
  });

  it('normaliza campos faltantes em elementos', () => {
    const bad = JSON.stringify({
      schemaVersion: 1,
      type: 'study-board',
      id: 'b',
      title: 't',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      elements: [{ kind: 'rect' }], // sem id/x/y/w/h
    });
    const back = parseOpenEm(bad);
    expect(back.elements).toHaveLength(1);
    expect(back.elements[0].id).toBeTruthy();
    expect(back.elements[0].x).toBe(0);
    expect(back.elements[0].w).toBe(0);
  });

  it('cryptoRandomId gera strings únicas', () => {
    const a = cryptoRandomId();
    const b = cryptoRandomId();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});