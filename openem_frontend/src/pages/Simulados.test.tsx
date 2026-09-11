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

describe('Simulados — provas oficiais do ENEM', () => {
  const prova = (
    slug: string,
    year: number,
    day: number,
    isReapplication = false,
  ) => ({
    id: `enem-${slug}-dia${day}`,
    name: `ENEM ${year} · ${day}º dia`,
    scope: 'EXAM',
    questionCount: day === 1 ? 89 : 88,
    timeLimitMin: day === 1 ? 330 : 300,
    subject: null,
    exam: { slug, year, label: `ENEM ${year}`, isReapplication },
    day,
    areas:
      day === 1
        ? [
            'Linguagens, Códigos e suas Tecnologias',
            'Ciências Humanas e suas Tecnologias',
          ]
        : [
            'Ciências da Natureza e suas Tecnologias',
            'Matemática e suas Tecnologias',
          ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.startSimulation).mockResolvedValue(START_RESPONSE as never);
  });

  it('agrupa por ano, com os dois dias, áreas, questões e tempo oficial', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue([
      prova('2023', 2023, 1),
      prova('2023', 2023, 2),
      prova('2023-reaplicacao', 2023, 1, true),
      TEMPLATES[1],
    ] as never);
    renderPage();

    expect(await screen.findByText('ENEM 2023')).toBeInTheDocument();
    expect(screen.getByText('Aplicação regular')).toBeInTheDocument();
    expect(screen.getByText('Reaplicação')).toBeInTheDocument();
    expect(screen.getAllByText('1º dia')).toHaveLength(2);
    // Regular e reaplicação têm 1º dia com 89 questões; o 2º dia, 88.
    expect(screen.getAllByText('89 questões')).toHaveLength(2);
    expect(screen.getByText('88 questões')).toBeInTheDocument();
    // 330 min vira "5h30"; 300 vira "5h".
    expect(screen.getAllByText('5h30').length).toBeGreaterThan(0);
    expect(screen.getByText('5h')).toBeInTheDocument();
    // Nomes curtos das áreas do dia.
    expect(screen.getAllByText('Linguagens').length).toBeGreaterThan(0);
    expect(screen.getByText('Natureza')).toBeInTheDocument();
  });

  it('iniciar um dia chama o start com o template da prova', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue([
      prova('2023', 2023, 1),
      prova('2023', 2023, 2),
    ] as never);
    renderPage();

    const segundoDia = (await screen.findAllByText('2º dia'))[0].closest(
      'button',
    )!;
    fireEvent.click(segundoDia);

    await waitFor(() =>
      expect(api.startSimulation).toHaveBeenCalledWith(
        'enem-2023-dia2',
        undefined,
      ),
    );
  });

  it('mostra só os três anos mais recentes até pedir todos', async () => {
    vi.mocked(api.simulationTemplates).mockResolvedValue(
      [2025, 2024, 2023, 2022, 2021].flatMap((ano) => [
        prova(String(ano), ano, 1),
      ]) as never,
    );
    renderPage();

    expect(await screen.findByText('ENEM 2025')).toBeInTheDocument();
    expect(screen.queryByText('ENEM 2022')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ver todas as provas/));

    expect(screen.getByText('ENEM 2022')).toBeInTheDocument();
    expect(screen.getByText('ENEM 2021')).toBeInTheDocument();
  });
});
