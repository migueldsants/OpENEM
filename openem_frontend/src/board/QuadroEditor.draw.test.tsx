// Smoke test do fluxo de desenho do QuadroEditor (issue #32). Monta o editor,
// simula pointer down/move/up para desenhar um retângulo e verifica se o
// elemento aparece no onChange. jsdom não faz layout (getBoundingClientRect
// retorna 0), então o viewport é tratado como origem (0,0) — o que basta p/
// exercitar a lógica de toWorld/commit.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { QuadroEditor } from './QuadroEditor';
import { createBoard } from './types';
import type { Board } from './types';

function makeBoard(): Board {
  return createBoard({ id: 'b1', title: 't' });
}

function viewport(container: HTMLElement): HTMLElement {
  // O viewport tem touch-none + bg-bg.
  const el = container.querySelector('.touch-none') as HTMLElement;
  if (!el) throw new Error('viewport não encontrado');
  return el;
}

describe('QuadroEditor — fluxo de desenho', () => {
  it('desenha um retângulo via pointer down/move/up', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    // Seleciona a ferramenta retângulo.
    const rectBtn = container.querySelector('button[title="Retângulo"]') as HTMLButtonElement;
    act(() => fireEvent.click(rectBtn));

    const vp = viewport(container);

    act(() => {
      fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(vp, { clientX: 200, clientY: 220, pointerId: 1 });
      fireEvent.pointerUp(vp, { clientX: 200, clientY: 220, pointerId: 1 });
    });

    const last = onChange.mock.calls.at(-1)?.[0] as Board | undefined;
    expect(last).toBeDefined();
    const shapes = last!.elements.filter((e) => e.kind === 'rect');
    expect(shapes.length).toBe(1);
    expect(shapes[0].w).toBeGreaterThan(0);
    expect(shapes[0].h).toBeGreaterThan(0);
  });
});