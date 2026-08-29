import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBanner } from './ErrorBanner';

describe('ErrorBanner (issue #49)', () => {
  it('não renderiza nada sem mensagem', () => {
    const { container } = render(<ErrorBanner message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza a mensagem com role=alert', () => {
    render(<ErrorBanner message="Falha ao carregar" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar');
  });

  it('oferece retry que dispara o callback', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Erro" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('sem onRetry não mostra botão', () => {
    render(<ErrorBanner message="Erro" />);
    expect(screen.queryByText('Tentar de novo')).not.toBeInTheDocument();
  });
});