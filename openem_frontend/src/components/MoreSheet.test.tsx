import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MoreSheet, type NavItem } from './MoreSheet';
import { IconTrophy, IconChat } from './icons';

const items: NavItem[] = [
  { to: '/progresso', label: 'Progresso', Icon: IconTrophy },
  { to: '/comunidade', label: 'Comunidade', Icon: IconChat },
];

function renderSheet(onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <MoreSheet items={items} onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('MoreSheet (issue #21)', () => {
  it('renderiza as telas secundárias', () => {
    renderSheet();
    expect(screen.getByText('Progresso')).toBeInTheDocument();
    expect(screen.getByText('Comunidade')).toBeInTheDocument();
    expect(screen.getByText('Mais')).toBeInTheDocument(); // título do sheet
  });

  it('fecha ao clicar no backdrop', () => {
    const onClose = renderSheet();
    // O backdrop é a camada escura clicável (aria-hidden).
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar num item (e navega)', () => {
    const onClose = renderSheet();
    const link = screen.getByText('Comunidade').closest('a');
    expect(link).toHaveAttribute('href', '/comunidade');
    fireEvent.click(link!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fecha pelo botão X', () => {
    const onClose = renderSheet();
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});