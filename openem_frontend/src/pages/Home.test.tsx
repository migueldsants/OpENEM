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
      ['Ferramentas', '/ferramentas'],
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

  describe('coluna Hoje (monitor largo)', () => {
    const hoje = () => within(screen.getByRole('complementary', { name: 'Hoje' }));

    it('lista os blocos de hoje do cronograma, com os feitos marcados', async () => {
      const dayIndex = 0;
      vi.mocked(api.studyPlan).mockResolvedValue({
        id: 'p', minutesPerDay: 60, createdAt: new Date().toISOString(),
        sessions: [
          { id: 'a', label: 'Matemática', dayIndex, minutes: 60, done: true, position: 0, subject: null },
          { id: 'b', label: 'Biologia', dayIndex, minutes: 30, done: false, position: 1, subject: null },
          { id: 'c', label: 'Física', dayIndex: 3, minutes: 45, done: false, position: 0, subject: null },
        ],
      } as never);
      renderHome();
      expect(await hoje().findByText('1 de 2 blocos feitos')).toBeInTheDocument();
      expect(hoje().getByText('Biologia')).toBeInTheDocument();
      expect(hoje().getByText('30 min')).toBeInTheDocument();
      expect(hoje().getByLabelText('feito')).toBeInTheDocument();
      expect(hoje().queryByText('Física')).not.toBeInTheDocument();
      expect(hoje().getByText('Cronograma').closest('a')).toHaveAttribute(
        'href',
        '/cronograma',
      );
    });

    it('escreve a data de hoje por extenso', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 1, 12));
      try {
        renderHome();
        expect(await hoje().findByText('quinta-feira, 1 de outubro')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('sem pendências, diz que está em dia e não abre lista de blocos', async () => {
      renderHome();
      expect(await hoje().findByText('Nenhum assunto vencido')).toBeInTheDocument();
      expect(hoje().getByText('Nenhum bloco para hoje')).toBeInTheDocument();
      // Só a lista de itens do dia: nada de sublista vazia de blocos.
      expect(hoje().getAllByRole('list')).toHaveLength(1);
    });

    it('usa singular e plural certos', async () => {
      vi.mocked(api.reviewQueue).mockResolvedValue([{}, {}] as never);
      vi.mocked(api.studyPlan).mockResolvedValue({
        id: 'p', minutesPerDay: 60, createdAt: new Date().toISOString(),
        sessions: [
          { id: 'a', label: 'Química', dayIndex: 0, minutes: 30, done: true, position: 0, subject: null },
        ],
      } as never);
      renderHome();
      expect(await hoje().findByText('2 assuntos vencidos')).toBeInTheDocument();
      expect(hoje().getByText('1 de 1 bloco feito')).toBeInTheDocument();
      expect(hoje().getByText('Química')).toHaveClass('line-through');
    });

    it('a bolinha do bloco usa a cor da matéria, com o nome como reserva', async () => {
      vi.mocked(api.studyPlan).mockResolvedValue({
        id: 'p', minutesPerDay: 60, createdAt: new Date().toISOString(),
        sessions: [
          { id: 'a', label: 'Bloco livre', dayIndex: 0, minutes: 30, done: false, position: 0, subject: { id: 'm', name: 'Matemática' } },
          { id: 'b', label: 'Biologia', dayIndex: 0, minutes: 30, done: false, position: 1, subject: null },
        ],
      } as never);
      renderHome();
      const livre = await hoje().findByText('Bloco livre');
      expect(livre.previousElementSibling).toHaveClass('bg-mat');
      expect(hoje().getByText('Biologia').previousElementSibling).toHaveClass('bg-nat');
    });

    it('mostra a revisão e a recomendação como ações', async () => {
      vi.mocked(api.reviewQueue).mockResolvedValue([{}] as never);
      vi.mocked(api.recommendations).mockResolvedValue([
        {
          question: {
            topic: { id: 't 1', name: 'Funções', subject: { id: 'm', name: 'Matemática' } },
          },
          reason: 'Você errou 3 de 4 em Funções.',
        },
      ] as never);
      renderHome();
      expect(await hoje().findByText('1 assunto vencido')).toBeInTheDocument();
      expect(hoje().getByText('Nenhum bloco para hoje')).toBeInTheDocument();
      expect(hoje().getByText('Funções').closest('a')).toHaveAttribute(
        'href',
        '/questoes?topicId=t%201',
      );
    });
  });
});
