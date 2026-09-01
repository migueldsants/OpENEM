// Testes do widget de metas semanais (issue #44).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeeklyGoalsCard } from './WeeklyGoalsCard';
import { api } from '../api';
import type { WeeklyGoal } from '../api';

vi.mock('../api', () => ({
  api: {
    weeklyGoals: vi.fn(),
    createWeeklyGoal: vi.fn(),
    deleteWeeklyGoal: vi.fn(),
    subjects: vi.fn(),
  },
}));

const GOAL_Q: WeeklyGoal = {
  id: 'g1',
  subjectAreaId: null,
  subjectAreaName: null,
  subjectId: 'subj-mat',
  subjectName: 'Matemática e suas Tecnologias',
  topicId: null,
  topicName: null,
  targetMinutes: 0,
  targetQuestions: 20,
  weekStart: new Date().toISOString(),
  minutesDone: 0,
  questionsDone: 8,
  completed: false,
};

const GOAL_MIN: WeeklyGoal = {
  ...GOAL_Q,
  id: 'g2',
  subjectId: null,
  subjectName: null,
  targetMinutes: 120,
  targetQuestions: 0,
  minutesDone: 130,
  questionsDone: 0,
  completed: true,
};

function renderCard() {
  return render(
    <MemoryRouter>
      <WeeklyGoalsCard />
    </MemoryRouter>,
  );
}

describe('WeeklyGoalsCard (issue #44)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.subjects).mockResolvedValue([
      {
        id: 'subj-mat',
        name: 'Matemática e suas Tecnologias',
        topics: [],
      },
    ] as never);
  });

  it('mostra as metas com progresso e barra', async () => {
    vi.mocked(api.weeklyGoals).mockResolvedValue([GOAL_Q, GOAL_MIN]);
    renderCard();

    expect(await screen.findByText('Metas da semana')).toBeInTheDocument();
    expect(screen.getByText('Matemática')).toBeInTheDocument();
    expect(screen.getByText(/8\/20 questões/)).toBeInTheDocument();
    expect(screen.getByText(/130\/120 min/)).toBeInTheDocument();
  });

  it('estado vazio convida a criar meta', async () => {
    vi.mocked(api.weeklyGoals).mockResolvedValue([]);
    renderCard();

    expect(
      await screen.findByText(/Defina uma meta/),
    ).toBeInTheDocument();
  });

  it('cria meta via formulário (matéria + questões)', async () => {
    vi.mocked(api.weeklyGoals).mockResolvedValue([]);
    vi.mocked(api.createWeeklyGoal).mockResolvedValue(GOAL_Q);
    renderCard();

    fireEvent.click(await screen.findByText('+ Nova'));
    fireEvent.change(await screen.findByDisplayValue(/Semana inteira/), {
      target: { value: 'subj-mat' },
    });
    fireEvent.click(screen.getByText('Criar meta'));

    await waitFor(() =>
      expect(api.createWeeklyGoal).toHaveBeenCalledWith({
        subjectId: 'subj-mat',
        targetQuestions: 20,
        targetMinutes: 0,
      }),
    );
    // A meta criada aparece na lista.
    expect(await screen.findByText(/8\/20 questões/)).toBeInTheDocument();
  });

  it('remove meta ao clicar na lixeira', async () => {
    vi.mocked(api.weeklyGoals).mockResolvedValue([GOAL_Q]);
    vi.mocked(api.deleteWeeklyGoal).mockResolvedValue({ removed: true });
    renderCard();

    fireEvent.click(
      await screen.findByRole('button', { name: /Remover meta Matemática/ }),
    );
    await waitFor(() =>
      expect(api.deleteWeeklyGoal).toHaveBeenCalledWith('g1'),
    );
    await waitFor(() =>
      expect(screen.queryByText(/8\/20 questões/)).not.toBeInTheDocument(),
    );
  });

  it('sem dados (API falha) esconde o widget silenciosamente', async () => {
    vi.mocked(api.weeklyGoals).mockRejectedValue(new Error('boom'));
    renderCard();

    // Falha de carregamento: widget some (vazio), sem crash.
    await waitFor(() =>
      expect(screen.queryByText('Metas da semana')).not.toBeInTheDocument(),
    );
  });
});