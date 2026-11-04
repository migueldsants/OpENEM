import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// --- Mocks para isolar a tabbar mobile (sem providers reais de auth/theme) ---
// Perfil mutável: um teste tira o apelido para ver a tela de escolha.
const profile = vi.hoisted(() => ({
  onboarded: true,
  focusMode: false,
  nickname: 'ana' as string | null,
}));
vi.mock('./auth', () => ({
  useAuth: () => ({
    authenticated: true,
    logout: vi.fn(),
    refreshMe: vi.fn(),
    me: { email: 'teste@exemplo.com', profile },
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

    // Atalhos primários visíveis. Revisão entrou (antes não estava em menu
    // nenhum) no lugar do Perfil, que foi para o "Mais".
    for (const label of ['Início', 'Painel', 'Questões', 'Simulados', 'Revisão']) {
      expect(withinTab.getByText(label)).toBeInTheDocument();
    }
    // Botão "Mais".
    expect(withinTab.getByLabelText('Mais telas')).toBeInTheDocument();
    // Telas secundárias NÃO estão direto na tabbar.
    expect(withinTab.queryByText('Comunidade')).not.toBeInTheDocument();
    expect(withinTab.queryByText('Progresso')).not.toBeInTheDocument();
    expect(withinTab.queryByText('Perfil')).not.toBeInTheDocument();
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
      'Ferramentas',
      'Favoritos',
      'Desempenho',
      'Perfil',
    ]) {
      expect(withinSheet.getByText(label)).toBeInTheDocument();
    }
    // A aba Games saiu do app.
    expect(withinSheet.queryByText('Games')).not.toBeInTheDocument();
    // Agrupado como na sidebar.
    for (const secao of ['Estudar', 'Planejar', 'Acompanhar', 'Social', 'Conta']) {
      expect(withinSheet.getByText(secao)).toBeInTheDocument();
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

  it('Ajuda abre a documentação, fora do app (sidebar e sheet)', () => {
    const { container } = renderApp('/');
    const sidebar = container.querySelector('aside.sidebar') as HTMLElement;
    expect(within(sidebar).getByText('Ajuda').closest('a')).toHaveAttribute(
      'href',
      '/docs/',
    );
    const tabbar = container.querySelector('nav.tabbar');
    fireEvent.click(within(tabbar as HTMLElement).getByLabelText('Mais telas'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ajuda').closest('a')).toHaveAttribute(
      'href',
      '/docs/',
    );
  });

  it('o botão Mais fica destacado quando a rota atual é uma tela secundária', () => {
    const { container } = renderApp('/progresso');
    const tabbar = container.querySelector('nav.tabbar');
    const maisBtn = within(tabbar!).getByLabelText('Mais telas');
    // Destacado => classe text-brand (rota atual é /progresso, que está no "Mais").
    expect(maisBtn.className).toContain('text-brand');
  });
});

describe('Sidebar do desktop — cabe em janela baixa', () => {
  it('a lista de telas rola sozinha, sem empurrar o rodapé para fora', () => {
    const { container } = renderApp('/');
    const nav = container.querySelector('nav.sidebar-nav');
    expect(nav).not.toBeNull();

    // As 17 telas pedem ~800px de altura; um notebook 1366x768 tem 768, e com
    // a escala de 125% do Windows sobram 614. Sem rolagem própria na lista,
    // Perfil, o cartão de XP e o botão Sair ficavam fora da tela.
    expect(nav!.className).toContain('overflow-y-auto');
    // flex-1 + min-h-0: a lista absorve a sobra e pode encolher abaixo do
    // conteúdo — sem min-h-0 o flex recusa encolher e a rolagem não acontece.
    expect(nav!.className).toContain('flex-1');
    expect(nav!.className).toContain('min-h-0');
  });

  it('o rodapé (tema e sair) fica fora da área que rola', () => {
    const { container } = renderApp('/');
    const aside = container.querySelector('aside');
    const nav = container.querySelector('nav.sidebar-nav');
    const sair = within(aside as HTMLElement).getByLabelText('Sair');

    expect(aside).toContainElement(sair);
    expect(nav!.contains(sair)).toBe(false);
  });

  it('todas as telas continuam acessíveis pela sidebar', () => {
    const { container } = renderApp('/');
    const nav = container.querySelector('nav.sidebar-nav');
    const withinNav = within(nav as HTMLElement);
    for (const label of [
      'Início',
      'Painel',
      'Questões',
      'Simulados',
      'Perfil',
    ]) {
      expect(withinNav.getByText(label)).toBeInTheDocument();
    }
    // As que na tabbar ficam atrás do "Mais" também estão aqui, diretas.
    for (const label of ['Comunidade', 'Fórmulas', 'Vídeos', 'Quadro']) {
      expect(withinNav.getByText(label)).toBeInTheDocument();
    }
    // Revisão e Desempenho não estavam em menu nenhum.
    expect(withinNav.getByText('Revisão').closest('a')).toHaveAttribute('href', '/revisao');
    expect(withinNav.getByText('Desempenho').closest('a')).toHaveAttribute('href', '/desempenho');
    // Conquistas entra pelo Progresso, não duplica a entrada no menu.
    expect(withinNav.queryByText('Conquistas')).not.toBeInTheDocument();
    // A aba Games saiu do app.
    expect(withinNav.queryByText('Games')).not.toBeInTheDocument();
  });
});

describe('Apelido obrigatório', () => {
  it('sem apelido, qualquer endereço abre a escolha antes do app', () => {
    profile.nickname = null;
    try {
      const { container } = renderApp('/questoes');
      expect(
        screen.getByRole('heading', { name: 'Escolha seu apelido' }),
      ).toBeInTheDocument();
      expect(container.querySelector('nav.tabbar')).toBeNull();
    } finally {
      profile.nickname = 'ana';
    }
  });
});
