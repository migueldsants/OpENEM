import { render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Landing } from './Landing';

describe('Landing: rodapé', () => {
  it('aponta para a Política de Privacidade e os Termos de Uso', () => {
    render(<Landing />);
    const rodape = screen.getByRole('navigation', { name: 'Rodapé' });
    expect(within(rodape).getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '/privacidade/');
    expect(within(rodape).getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos/');
  });
});

describe('Landing: botão do app', () => {
  afterEach(() => localStorage.clear());

  it('sem sessão, convida a começar e leva ao /app/', () => {
    render(<Landing />);
    const botoes = screen.getAllByRole('link', { name: /Começar a estudar/ });
    expect(botoes.length).toBeGreaterThan(0);
    for (const b of botoes) expect(b).toHaveAttribute('href', '/app/');
  });

  it('com sessão do app na mesma origem, vira "Continuar estudando"', async () => {
    localStorage.setItem('openem.token', 'tok');
    render(<Landing />);
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Continuar estudando/ }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole('link', { name: /Começar a estudar/ })).not.toBeInTheDocument();
  });

  it('o HTML pré-renderizado sempre diz "Começar" (funciona sem JavaScript)', () => {
    localStorage.setItem('openem.token', 'tok');
    const html = renderToString(<Landing />);
    expect(html).toContain('Começar a estudar');
    expect(html).not.toContain('Continuar estudando');
  });
});
