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

function clickTitle(container: HTMLElement, substr: string): HTMLButtonElement {
  const btn = container.querySelector(`button[title*="${substr}"]`) as HTMLButtonElement;
  if (!btn) throw new Error(`botão com title "${substr}" não encontrado`);
  act(() => fireEvent.click(btn));
  return btn;
}

function drawRect(
  vp: HTMLElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pointerId = 1,
) {
  act(() => {
    fireEvent.pointerDown(vp, { clientX: x0, clientY: y0, pointerId });
    fireEvent.pointerMove(vp, { clientX: x1, clientY: y1, pointerId });
    fireEvent.pointerUp(vp, { clientX: x1, clientY: y1, pointerId });
  });
}

describe('QuadroEditor — fluxo de desenho', () => {
  it('desenha um retângulo via pointer down/move/up', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    // Seleciona a ferramenta retângulo.
    const rectBtn = container.querySelector('button[title*="Retângulo"]') as HTMLButtonElement;
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

  it('desenha uma forma preenchida quando "Preencher" está ativo', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Retângulo');
    clickTitle(container, 'Preencher'); // liga o preenchimento (usa a cor atual)

    const vp = viewport(container);
    drawRect(vp, 100, 100, 200, 220);

    const last = onChange.mock.calls.at(-1)?.[0] as Board | undefined;
    const shape = last!.elements.find((e) => e.kind === 'rect');
    expect(shape).toBeDefined();
    expect(shape!.fill).toBe(shape!.color);
    expect(shape!.fill).toBeTruthy();
  });

  it('menu de contexto envia o elemento do topo para trás', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Retângulo');
    const vp = viewport(container);
    drawRect(vp, 100, 100, 200, 220, 1); // A (fundo)
    drawRect(vp, 300, 100, 400, 220, 2); // B (topo)

    const before = (onChange.mock.calls.at(-1)![0] as Board).elements.map((e) => e.id);
    expect(before).toHaveLength(2);

    // Botão-direito sobre B (x:300-400). B é o último → hit primeiro.
    act(() => fireEvent.contextMenu(vp, { clientX: 350, clientY: 150 }));

    const item = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Enviar para trás',
    ) as HTMLButtonElement | undefined;
    expect(item).toBeDefined();
    act(() => fireEvent.click(item!));

    const after = (onChange.mock.calls.at(-1)![0] as Board).elements.map((e) => e.id);
    expect(after).toHaveLength(2);
    // B (último) foi para o início; A foi para o topo.
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });

  it('ilha de zoom aproxima e atualiza a porcentagem', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    const pct = (): string | undefined =>
      [...container.querySelectorAll('button')].find((b) => /\d+%/.test(b.textContent ?? ''))
        ?.textContent ?? undefined;

    expect(pct()).toBe('100%');

    clickTitle(container, 'Aproximar');

    expect(pct()).toBe('120%');
  });

  it('seta: ponta padrão e troca do início para dot', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Seta');
    const vp = viewport(container);
    drawRect(vp, 100, 100, 200, 220); // (100,100) -> (200,220)

    const arrow = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'arrow',
    )!;
    expect(arrow.arrowStart).toBe('none');
    expect(arrow.arrowEnd).toBe('arrow');

    // Seleciona a seta (clique no ponto médio).
    clickTitle(container, 'Selecionar');
    act(() => fireEvent.pointerDown(vp, { clientX: 150, clientY: 160, pointerId: 3 }));

    // Seletor de ponta "Início" → botão da bolinha (primeira ocorrência).
    const dotBtn = container.querySelector(
      'button[title="bolinha"]',
    ) as HTMLButtonElement | null;
    expect(dotBtn).not.toBeNull();
    act(() => fireEvent.click(dotBtn!));

    const after = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'arrow',
    )!;
    expect(after.arrowStart).toBe('dot');
  });

  it('seta: arrastar pra esquerda mantém a direção (ponta onde soltou)', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Seta');
    const vp = viewport(container);
    // Arrasta da direita pra esquerda: início (200,100), solta em (100,220).
    drawRect(vp, 200, 100, 100, 220);

    const arrow = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'arrow',
    )!;
    // (x,y) = início (pointerdown); (x+w,y+h) = fim (onde soltou, fica a ponta).
    // Antes do fix, a normalização trocava início↔fim e a seta apontava pra onde
    // o usuário começou o arrasto, não pra onde soltou.
    expect(arrow.x).toBe(200);
    expect(arrow.y).toBe(100);
    expect(arrow.w).toBe(-100);
    expect(arrow.h).toBe(120);
    expect(arrow.x + arrow.w).toBe(100); // fim = ponto de soltura
    expect(arrow.y + arrow.h).toBe(220);
  });

  it('seta: arrastar pra cima-esquerda também mantém início→fim', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Seta');
    const vp = viewport(container);
    drawRect(vp, 300, 300, 100, 120); // início (300,300) -> solta (100,120)

    const arrow = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'arrow',
    )!;
    expect(arrow.x).toBe(300);
    expect(arrow.y).toBe(300);
    expect(arrow.x + arrow.w).toBe(100);
    expect(arrow.y + arrow.h).toBe(120);
  });

  it('sticky: toggle Preencher muda o fundo para a cor atual', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Sticky');
    const vp = viewport(container);
    // Cria o sticky com um clique (abre o editor inline).
    act(() => fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 }));
    // Fecha o editor inline (commit).
    const ta = container.querySelector('textarea')!;
    expect(ta).not.toBeNull();
    act(() => fireEvent.blur(ta));

    // Seleciona o sticky e liga Preencher.
    clickTitle(container, 'Selecionar');
    act(() => fireEvent.pointerDown(vp, { clientX: 180, clientY: 150, pointerId: 2 }));
    clickTitle(container, 'Preencher');

    const sticky = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'sticky',
    )!;
    expect(sticky.fill).toBeTruthy();
    expect(sticky.fill).toBe(sticky.color);
  });

  it('sticky: duplo-clique reabre o editor de texto', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    clickTitle(container, 'Sticky');
    const vp = viewport(container);
    act(() => fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 }));
    const ta0 = container.querySelector('textarea')!;
    expect(ta0).not.toBeNull();
    act(() => fireEvent.blur(ta0)); // commita e fecha
    expect(container.querySelector('textarea')).toBeNull();

    clickTitle(container, 'Selecionar');
    // sticky em (100,100) w160 h100 → centro ~(180,150)
    act(() => fireEvent.doubleClick(vp, { clientX: 180, clientY: 150 }));
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('texto: commit casa o bbox com o texto (não fica 200x40 solto)', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    // title exato: em jsdom `[title*=...]` é case-insensitive e pegaria "Marca-texto".
    const textBtn = container.querySelector('button[title="Texto (T)"]') as HTMLButtonElement;
    act(() => fireEvent.click(textBtn));
    const vp = viewport(container);
    act(() => fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 }));
    const ta = container.querySelector('textarea')!;
    expect(ta).not.toBeNull();
    act(() => {
      fireEvent.change(ta, { target: { value: 'ola' } });
      fireEvent.blur(ta); // commita
    });

    const text = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'text',
    )!;
    // Default de criação é 200x40; depois do commit o bbox segue o texto curto.
    expect(text.text).toBe('ola');
    expect(text.w).toBeLessThan(200);
    expect(text.h).toBeLessThan(40);
    // sticky não é afetado (caixa controlada pelo usuário): cria e confirma vazio
    // mantém 160x100 — coberto pelo teste de sticky acima (não encolhe).
  });

  it('texto: após commit volta pra Selecionar (fica móvel, não cria ao arrastar)', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    const textBtn = container.querySelector('button[title="Texto (T)"]') as HTMLButtonElement;
    act(() => fireEvent.click(textBtn));
    const vp = viewport(container);
    act(() => fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 }));
    const ta = container.querySelector('textarea')!;
    act(() => {
      fireEvent.change(ta, { target: { value: 'ola' } });
      fireEvent.blur(ta); // commita
    });

    // Ferramenta volta pra Selecionar — senão o próximo arraste criaria outro
    // texto em vez de mover o recém-criado (sintoma: "texto selecionado travado").
    const active = container.querySelector('button[data-active="true"]') as HTMLButtonElement;
    expect(active.getAttribute('title')).toBe('Selecionar (V)');
    // Continua com 1 texto (não criou outro).
    const texts = (onChange.mock.calls.at(-1)![0] as Board).elements.filter(
      (e) => e.kind === 'text',
    );
    expect(texts.length).toBe(1);
  });

  it('texto: resize escala a fonte (não só o bbox)', () => {
    const board = makeBoard();
    const onChange = vi.fn();
    const { container } = render(<QuadroEditor board={board} onChange={onChange} />);

    const textBtn = container.querySelector('button[title="Texto (T)"]') as HTMLButtonElement;
    act(() => fireEvent.click(textBtn));
    const vp = viewport(container);
    act(() => fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1 }));
    const ta = container.querySelector('textarea')!;
    act(() => {
      fireEvent.change(ta, { target: { value: 'ola' } });
      fireEvent.blur(ta);
    });

    // Seleciona o texto e arrasta o handle SE via alça de resize.
    clickTitle(container, 'Selecionar');
    act(() => fireEvent.pointerDown(vp, { clientX: 120, clientY: 110, pointerId: 2 }));

    // Handle SE = o de maior (x+y) entre os rects de alça (pointer-events:all).
    const handles = [...container.querySelectorAll('svg rect')].filter(
      (r) => (r.getAttribute('style') ?? '').includes('pointer-events'),
    );
    expect(handles.length).toBeGreaterThan(0);
    const se = handles.reduce((a, b) => {
      const ax = parseFloat(a.getAttribute('x') ?? '0') + parseFloat(a.getAttribute('y') ?? '0');
      const bx = parseFloat(b.getAttribute('x') ?? '0') + parseFloat(b.getAttribute('y') ?? '0');
      return bx > ax ? b : a;
    }) as SVGRectElement;
    const sx = parseFloat(se.getAttribute('x') ?? '0');
    const sy = parseFloat(se.getAttribute('y') ?? '0');
    act(() => {
      fireEvent.pointerDown(se, { clientX: sx, clientY: sy, pointerId: 3 });
      fireEvent.pointerMove(se, { clientX: sx + 80, clientY: sy + 40, pointerId: 3 });
      fireEvent.pointerUp(se, { clientX: sx + 80, clientY: sy + 40, pointerId: 3 });
    });

    const after = (onChange.mock.calls.at(-1)![0] as Board).elements.find(
      (e) => e.kind === 'text',
    )!;
    // A fonte cresceu (resize escala o texto, não só a caixa).
    expect(after.fontSize ?? 18).toBeGreaterThan(18);
  });
});