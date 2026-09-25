// A Home tem uma ação principal (o próximo passo) e atalhos; métricas ficam no Painel.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    reviewQueue: vi.fn(),
    studyPlan: vi.fn(),
    recommendations: vi.fn(),
  },
}));
vi.mock('../auth', () => ({
  useAuth: () => ({ me: { profile: { displayName: 'Ana Souza' } } }),
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.reviewQueue).mockResolvedValue([]);
    vi.mocked(api.studyPlan).mockRejectedValue(new Error('404'));
    vi.mocked(api.recommendations).mockResolvedValue([]);
  });

  it('cumprimenta pelo primeiro nome', () => {
    renderHome();
    expect(screen.getByText('Bora estudar, Ana?')).toBeInTheDocument();
  });

  it('mostra os atalhos principais, incluindo o Painel', () => {
    renderHome();
    const nav = within(screen.getByRole('navigation', { name: 'Atalhos' }));
    for (const [nome, rota] of [
      ['Questões', '/questoes'],
      ['Simulados', '/simulados'],
      ['Painel', '/painel'],
      ['Revisão', '/revisao'],
      ['Redação', '/redacao'],
      ['Pomodoro', '/pomodoro'],
    ]) {
      expect(nav.getByText(nome).closest('a')).toHaveAttribute('href', rota);
    }
  });

  it('não mostra métricas de desempenho', async () => {
    renderHome();
    await screen.findByText('Próximo passo');
    expect(screen.queryByText(/de acerto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Desempenho por área/)).not.toBeInTheDocument();
  });

  it('com revisão vencida, o próximo passo é revisar e o atalho ganha selo', async () => {
    vi.mocked(api.reviewQueue).mockResolvedValue([{}, {}, {}] as never);
    renderHome();
    expect(
      await screen.findByText('3 assuntos para revisar'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Revisar agora/ })).toHaveAttribute(
      'href',
      '/revisao',
    );
    expect(screen.getByLabelText('3 para revisar')).toBeInTheDocument();
  });

  it('sem nada pendente e se tudo falhar, sugere começar pelas questões', async () => {
    vi.mocked(api.reviewQueue).mockRejectedValue(new Error('offline'));
    vi.mocked(api.recommendations).mockRejectedValue(new Error('offline'));
    renderHome();
    expect(
      await screen.findByText('Responda questões do ENEM'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Começar/ })).toHaveAttribute(
      'href',
      '/questoes',
    );
    expect(screen.queryByLabelText(/para revisar/)).not.toBeInTheDocument();
  });
});
