import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// --- Mocks para isolar a tabbar mobile (sem providers reais de auth/theme) ---
vi.mock('./auth', () => ({
  useAuth: () => ({
    authenticated: true,
    logout: vi.fn(),
    me: {
      email: 'teste@exemplo.com',
      profile: { onboarded: true, focusMode: false },
    },
  }),
}));

vi.mock('./gamification', () => ({
  useGamification: () => ({ summary: null }),
}));

// ThemeToggle usa matchMedia (ausente no jsdom) — stub.
vi.mock('./components/ThemeToggle', () => ({
  default: () => <button aria-label="toggle tema" />,
}));

// Página inicial renderizada na rota '/'. As demais não são montadas neste
// teste, então não precisam de stub.
vi.mock('./pages/Home', () => ({
  default: () => <div data-testid="page-home" />,
}));

function renderApp(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Tabbar mobile — botão Mais (issue #21)', () => {
  it('mostra 5 atalhos visíveis + botão Mais (sem Comunidade/Progresso diretos)', () => {
    const { container } = renderApp('/');
    const tabbar = container.querySelector('nav.tabbar');
    expect(tabbar).not.toBeNull();
    const withinTab = within(tabbar!);

    // Atalhos primários visíveis.
    for (const label of ['Início', 'Questões', 'Simulados', 'Games', 'Perfil']) {
      expect(withinTab.getByText(label)).toBeInTheDocument();
    }
    // Botão "Mais".
    expect(withinTab.getByLabelText('Mais telas')).toBeInTheDocument();
    // Telas secundárias NÃO estão direto na tabbar.
    expect(withinTab.queryByText('Comunidade')).not.toBeInTheDocument();
    expect(withinTab.queryByText('Progresso')).not.toBeInTheDocument();
  });

  it('clicar em Mais abre o bottom-sheet com as telas secundárias', () => {
    const { container } = renderApp('/');
    const tabbar = container.querySelector('nav.tabbar');
    const maisBtn = within(tabbar!).getByLabelText('Mais telas');
    fireEvent.click(maisBtn);

    // Atributo aria-expanded reflete o estado aberto.
    expect(maisBtn).toHaveAttribute('aria-expanded', 'true');

    const dialog = screen.getByRole('dialog');
    const withinSheet = within(dialog);
    for (const label of [
      'Progresso',
      'Comunidade',
      'Cronograma',
      'Redação',
      'Favoritos',
    ]) {
      expect(withinSheet.getByText(label)).toBeInTheDocument();
    }
  });

  it('clicar num item do sheet navega e fecha o sheet', () => {
    const { container } = renderApp('/');
    const tabbar = container.querySelector('nav.tabbar');
    fireEvent.click(within(tabbar!).getByLabelText('Mais telas'));

    const dialog = screen.getByRole('dialog');
    const link = within(dialog).getByText('Comunidade').closest('a');
    expect(link).toHaveAttribute('href', '/comunidade');
    fireEvent.click(link!);

    // Sheet fechou: o dialog some.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o botão Mais fica destacado quando a rota atual é uma tela secundária', () => {
    const { container } = renderApp('/progresso');
    const tabbar = container.querySelector('nav.tabbar');
    const maisBtn = within(tabbar!).getByLabelText('Mais telas');
    // Destacado => classe text-brand (rota atual é /progresso, que está no "Mais").
    expect(maisBtn.className).toContain('text-brand');
  });
});