// Testes do builder de simulado personalizado (issue #40).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Simulados from './Simulados';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    simulationTemplates: vi.fn(),
    subjects: vi.fn(),
    startSimulation: vi.fn(),
  },
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn(), summary: null }),
}));

const TEMPLATES = [
  {
    id: 'seed-template-full',
    name: 'Simulado completo (demonstração)',
    scope: 'FULL',
    questionCount: 6,
    timeLimitMin: 330,
    subject: null,
  },
  {
    id: 'seed-template-custom',
    name: 'Personalizado',
    scope: 'FULL',
    questionCount: 10,
    timeLimitMin: null,
    subject: null,
  },
];

const SUBJECTS = [
  {
    id: 'subj-mat',
    name: 'Matemática e suas Tecnologias',
    topics: [
      { id: 'topic-funcoes', name: 'Funções' },
      { id: 'topic-prob', name: 'Probabilidade' },
    ],
  },
];

const START_RESPONSE = {
  id: 'sim-1',
  startedAt: new Date().toISOString(),
  timeLimitMin: 30,
  questionCount: 10,
  questions: [
    {
      id: 'q1',
      statement: 's',
      difficulty: 1,
      topic: { id: 't', name: 'T', subject: { id: 'subj-mat', name: 'S' } },
      alternatives: [{ id: 'a', text: 'x' }],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Simulados />
    </MemoryRouter>,
  );
}

describe('Simulados — builder personalizado (issue #40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.simulationTemplates).mockResolvedValue(
      TEMPLATES as never,
    );
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
  });

  it('mostra o card de simulado personalizado', async () => {
    renderPage();
    expect(await screen.findByText(/Simulado completo/)).toBeInTheDocument();
    expect(screen.getByText('Simulado personalizado')).toBeInTheDocument();
    // O template "custom" não vira card duplicado na lista (nome exato
    // "Personalizado" só existe no header do builder).
    expect(screen.queryByText('Personalizado')).not.toBeInTheDocument();
  });

  it('abre o builder, escolhe matéria/tópico/quantidade e inicia com filtros', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Montar'));

    // Matérias carregadas.
    const subjectSelect = await screen.findByDisplayValue(
      'Todas as matérias',
    );
    fireEvent.change(subjectSelect, { target: { value: 'subj-mat' } });

    // Tópicos da matéria aparecem.
    const topicSelect = await screen.findByDisplayValue('Todos os assuntos');
    fireEvent.change(topicSelect, { target: { value: 'topic-funcoes' } });

    // Quantidade rápida 10 já é o default; clica 5 (rápido).
    fireEvent.click(screen.getByText('5'));

    fireEvent.click(screen.getByText('Iniciar com 5 questões'));

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(
        'seed-template-custom',
        {
          subjectId: 'subj-mat',
          topicId: 'topic-funcoes',
          questionCount: 5,
          pareto: true,
        },
      ),
    );
  });

  it('inicia sem filtros quando nada é escolhido', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Montar'));
    fireEvent.click(
      await screen.findByText('Iniciar com 10 questões'),
    );

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(
        'seed-template-custom',
        {
          subjectId: undefined,
          topicId: undefined,
          questionCount: 10,
          pareto: true,
        },
      ),
    );
  });

  it('desabilita o seletor de assunto sem matéria', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Montar'));
    const topicSelect = await screen.findByDisplayValue(
      'Escolha uma matéria',
    );
    expect(topicSelect).toBeDisabled();
  });

  it('exibe erro quando o start falha', async () => {
    vi.mocked(api.startSimulation).mockRejectedValueOnce(
      new Error('Sem questões para este filtro'),
    );
    renderPage();
    fireEvent.click(await screen.findByText('Montar'));
    fireEvent.click(await screen.findByText('Iniciar com 10 questões'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sem questões para este filtro');
  });
});