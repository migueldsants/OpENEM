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
        kind: 'arrow',
        x: 50,
        y: 80,
        w: 140,
        h: 40,
        color: '#2563eb',
        arrowStart: 'dot',
        arrowEnd: 'arrow',
      },
      {
        id: 'e5',
        kind: 'sticky',
        x: 70,
        y: 90,
        w: 160,
        h: 100,
        fill: '#fff7cc',
        textColor: '#5a4a1a',
        text: 'Nota',
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
    expect(back.elements).toHaveLength(5);
    expect(back.elements[1].points).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 6 },
    ]);
    expect(back.elements[2].latex).toBe('\\frac{a}{b}');
    expect(back.elements[3].arrowStart).toBe('dot');
    expect(back.elements[3].arrowEnd).toBe('arrow');
    expect(back.elements[4].textColor).toBe('#5a4a1a');
  });

  it('filtra nós de mapa mental de arquivos antigos', () => {
    const old = JSON.stringify({
      schemaVersion: 1,
      type: 'study-board',
      id: 'b',
      title: 't',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      elements: [
        { id: 'r', kind: 'rect', x: 0, y: 0, w: 10, h: 10 },
        { id: 'm', kind: 'mindnode', x: 0, y: 0, w: 10, h: 10, linkTo: 'r' },
      ],
    });
    const back = parseOpenEm(old);
    expect(back.elements).toHaveLength(1);
    expect(back.elements[0].kind).toBe('rect');
  });

  it('rejeita JSON malformado', () => {
    expect(() => parseOpenEm('{ not json')).toThrow(OpenEmParseError);
  });

  it('rejeita tipo incorreto', () => {
    const bad = JSON.stringify({ ...sampleBoard(), type: 'other' });
    expect(() => parseOpenEm(bad)).toThrow(/não é um quadro de estudos/);
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

  it('round-trip preserva pressão dos pontos e o losango', () => {
    const board = sampleBoard({
      elements: [
        {
          id: 's',
          kind: 'stroke',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          points: [
            { x: 1, y: 1, p: 0.2 },
            { x: 5, y: 6, p: 0.9 },
          ],
        },
        {
          id: 'd',
          kind: 'diamond',
          x: 100,
          y: 100,
          w: 40,
          h: 40,
          color: '#2563eb',
        },
      ],
    });
    const back = parseOpenEm(toOpenEm(board));
    expect(back.elements[0].points).toEqual([
      { x: 1, y: 1, p: 0.2 },
      { x: 5, y: 6, p: 0.9 },
    ]);
    expect(back.elements[1].kind).toBe('diamond');
    expect(back.elements[1].w).toBe(40);
  });

  it('arquivo antigo (sem pressão) normaliza points sem p', () => {
    const old = JSON.stringify({
      schemaVersion: 1,
      type: 'study-board',
      id: 'b',
      title: 't',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      elements: [
        {
          id: 's',
          kind: 'stroke',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          points: [
            { x: 1, y: 1 },
            { x: 5, y: 6 },
          ],
        },
      ],
    });
    const back = parseOpenEm(old);
    expect(back.elements[0].points).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 6 },
    ]);
    // sem p
    expect(back.elements[0].points?.[0].p).toBeUndefined();
  });
});