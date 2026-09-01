// Testes do Cronograma com visão canônica de matérias (issue #46).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Cronograma from './Cronograma';
import { api } from '../api';
import type { StudyPlan } from '../api';

vi.mock('../api', () => ({
  api: {
    studyPlan: vi.fn(),
    generateStudyPlan: vi.fn(),
    setSessionDone: vi.fn(),
    updateProfile: vi.fn(),
  },
}));
vi.mock('../auth', () => ({
  useAuth: () => ({
    me: { profile: { minutesPerDay: 60 } },
    refreshMe: vi.fn(),
  }),
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn(), summary: null }),
}));

/** Plano iniciado hoje: dia 0 é hoje (para o card "Hoje" aparecer). */
function makePlan(): StudyPlan {
  return {
    id: 'plan-1',
    minutesPerDay: 60,
    createdAt: new Date().toISOString(),
    sessions: [
      {
        id: 's1',
        dayIndex: 0,
        minutes: 30,
        done: false,
        topic: {
          id: 't1',
          name: 'Funções',
          subject: { id: 'subj-mat', name: 'Matemática e suas Tecnologias' },
        },
      },
      {
        id: 's2',
        dayIndex: 0,
        minutes: 30,
        done: false,
        topic: {
          id: 't2',
          name: 'Probabilidade',
          subject: { id: 'subj-mat', name: 'Matemática e suas Tecnologias' },
        },
      },
      {
        id: 's3',
        dayIndex: 1,
        minutes: 30,
        done: true,
        topic: {
          id: 't3',
          name: 'Células',
          subject: { id: 'subj-bio', name: 'Biologia' },
        },
      },
    ],
  } as never;
}

describe('Cronograma — visão por matéria (issue #46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra o card "Hoje: Dia de [Matéria]" com as sessões do dia', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    render(
      <MemoryRouter>
        <Cronograma />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Dia de')).toBeInTheDocument();
    // "Matemática" aparece no card Hoje e no rótulo do dia.
    expect(screen.getAllByText('Matemática').length).toBeGreaterThanOrEqual(1);
    // Card Hoje: "2 sessões · 60 min" (texto único do parágrafo do dia).
    expect(
      screen.getByText((_, el) => el?.textContent === '2 sessões · 60 min'),
    ).toBeInTheDocument();
    // Sem tudo concluído: sem o chip "concluído".
    expect(screen.queryByText(/concluído/)).not.toBeInTheDocument();
  });

  it('cada dia do calendário rotula a matéria dominante', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    render(
      <MemoryRouter>
        <Cronograma />
      </MemoryRouter>,
    );

    await screen.findByText('Dia de');
    // Dia 1 é Biologia — o rótulo curto aparece na célula.
    expect(screen.getByText('Biologia')).toBeInTheDocument();
  });

  it('chip de concluído quando todas as sessões de hoje estão feitas', async () => {
    const plan = makePlan();
    plan.sessions.forEach((s) => (s.done = true));
    vi.mocked(api.studyPlan).mockResolvedValue(plan);
    render(
      <MemoryRouter>
        <Cronograma />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/concluído/)).toBeInTheDocument();
  });

  it('sem card "Hoje" quando não há plano', async () => {
    vi.mocked(api.studyPlan).mockRejectedValue(new Error('no plan'));
    render(
      <MemoryRouter>
        <Cronograma />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('Sem cronograma ainda'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Dia de')).not.toBeInTheDocument();
  });
});