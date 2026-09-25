import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RouteTransition from './RouteTransition';
import { Portal, useDialog } from './Modal';

function Dialogo({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <Portal>
      <div ref={ref} tabIndex={-1} role="dialog" aria-label={label}>
        <button>primeiro</button>
        <button>último</button>
        {children}
      </div>
    </Portal>
  );
}

function Pagina() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>abrir</button>
      {aberto && <Dialogo label="Modal" onClose={() => setAberto(false)} />}
    </>
  );
}

describe('Modal', () => {
  it('renderiza no body, fora do wrapper animado da rota', () => {
    render(
      <MemoryRouter>
        <RouteTransition>
          <Pagina />
        </RouteTransition>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('abrir'));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo.parentElement).toBe(document.body);
    expect(dialogo.closest('.animate-route')).toBeNull();
  });

  it('Esc fecha e o foco volta para quem abriu', () => {
    render(<Pagina />);
    const abrir = screen.getByText('abrir');
    abrir.focus();
    fireEvent.click(abrir);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(abrir);
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab no último item volta para o primeiro (foco preso)', () => {
    render(<Dialogo label="Modal" onClose={() => {}} />);
    const ultimo = screen.getByText('último');
    ultimo.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('primeiro'));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it('com dois abertos, Esc fecha só o de cima', () => {
    const fechaFundo = vi.fn();
    const fechaTopo = vi.fn();
    render(
      <Dialogo label="fundo" onClose={fechaFundo}>
        <Dialogo label="topo" onClose={fechaTopo} />
      </Dialogo>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(fechaTopo).toHaveBeenCalledTimes(1);
    expect(fechaFundo).not.toHaveBeenCalled();
  });
});
