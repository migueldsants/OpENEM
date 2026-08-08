import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';
import { IconTrophy, IconStar } from './icons';

function withRouter(ui: React.ReactNode) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

describe('EmptyState', () => {
  it('renderiza ícone, título, descrição, CTA (link) e dica', () => {
    render(
      withRouter(
        <EmptyState
          icon={IconTrophy}
          title="Ainda sem dados"
          description="Responda sua primeira questão para ver sua evolução."
          action={{ to: '/questoes', label: 'Responder primeira questão' }}
          tip="Veja sua evolução após algumas questões"
        />,
      ),
    );
    expect(screen.getByText('Ainda sem dados')).toBeInTheDocument();
    expect(
      screen.getByText('Responda sua primeira questão para ver sua evolução.'),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: 'Responder primeira questão',
    });
    expect(link).toHaveAttribute('href', '/questoes');
    expect(
      screen.getByText('Veja sua evolução após algumas questões'),
    ).toBeInTheDocument();
  });

  it('renderiza um botão quando a ação é onClick', () => {
    const onClick = vi.fn();
    render(
      withRouter(
        <EmptyState
          icon={IconStar}
          title="Nenhuma favorita ainda"
          description="Toque na estrela ao responder."
          action={{ onClick, label: 'Explorar questões' }}
        />,
      ),
    );
    const btn = screen.getByRole('button', { name: 'Explorar questões' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});