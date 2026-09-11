// A Home é um hub: só atalhos, sem as métricas (que ficam no Painel).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { api } from '../api';

vi.mock('../api', () => ({
  api: { reviewQueue: vi.fn() },
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

describe('Home (hub)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.reviewQueue).mockResolvedValue([]);
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

  it('não carrega métricas: só a fila de revisão, para o selo', () => {
    renderHome();
    expect(screen.queryByText(/de acerto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Desempenho por área/)).not.toBeInTheDocument();
    expect(Object.keys(api)).toEqual(['reviewQueue']);
  });

  it('com revisão vencida, mostra o selo e a contagem no atalho', async () => {
    vi.mocked(api.reviewQueue).mockResolvedValue([{}, {}, {}] as never);
    renderHome();
    expect(await screen.findByLabelText('3 para revisar')).toBeInTheDocument();
    expect(screen.getByText('3 assuntos vencidos')).toBeInTheDocument();
  });

  it('sem revisão vencida, não há selo', async () => {
    renderHome();
    expect(await screen.findByText('Revisão espaçada')).toBeInTheDocument();
    expect(screen.queryByLabelText(/para revisar/)).not.toBeInTheDocument();
  });
});
