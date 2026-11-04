// Testes da tela dedicada do Pomodoro (issue #41).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pomodoro from './Pomodoro';
import { PomodoroProvider } from '../pomodoro';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    focusToday: vi.fn(),
    subjects: vi.fn(),
    completeFocusSession: vi.fn(),
    startFocusSession: vi.fn(),
    focusHistory: vi.fn(),
    focusBySubject: vi.fn(),
  },
}));

const NOW = new Date('2026-03-10T18:00:00');

const SESSIONS = [
  {
    id: 'a',
    subjectId: 's1',
    subjectName: 'Matemática',
    durationSec: 1500,
    startedAt: '2026-03-10T14:00:00',
    completedAt: '2026-03-10T14:25:00',
  },
  {
    id: 'b',
    subjectId: null,
    subjectName: null,
    durationSec: 3000,
    startedAt: '2026-03-09T09:00:00',
    completedAt: '2026-03-09T09:50:00',
  },
];

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PomodoroProvider>
        <Pomodoro />
      </PomodoroProvider>
    </MemoryRouter>,
  );
}

describe('Pomodoro (tela dedicada, issue #41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(api.focusToday).mockResolvedValue({ minutes: 75 });
    vi.mocked(api.subjects).mockResolvedValue([
      { id: 's1', name: 'Matemática', topics: [] },
    ] as never);
    vi.mocked(api.focusHistory).mockResolvedValue({
      sessions: SESSIONS,
      totalMinutes: 75,
    } as never);
    vi.mocked(api.focusBySubject).mockResolvedValue([
      { subjectId: 's1', subjectName: 'Matemática', minutes: 25 },
      { subjectId: null, subjectName: 'Sem matéria', minutes: 50 },
    ] as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o relógio parado na duração configurada', async () => {
    renderPage();
    await flush();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Pronto para focar')).toBeInTheDocument();
  });

  it('resume o foco de hoje e do período em horas', async () => {
    renderPage();
    await flush();
    // 75 min viram "1 h 15 min" — em "hoje" e no total de 30 dias.
    expect(screen.getAllByText('1 h 15 min').length).toBe(2);
    expect(screen.getByText('sessões')).toBeInTheDocument();
  });

  it('agrupa o histórico por dia relativo', async () => {
    renderPage();
    await flush();
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('Ontem')).toBeInTheDocument();
    // "50 min" aparece na barra por matéria e no item do histórico.
    expect(screen.getAllByText('50 min').length).toBe(2);
    expect(screen.getByText('09:50')).toBeInTheDocument();
  });

  it('aplica um preset e reflete no relógio e no botão', async () => {
    renderPage();
    await flush();
    fireEvent.click(screen.getByText('Ajustar'));
    fireEvent.click(screen.getByText('Imersão'));

    expect(screen.getByText('50:00')).toBeInTheDocument();
    expect(screen.getByText(/Focar 50 min/)).toBeInTheDocument();
  });

  it('duração fora da faixa é limitada ao máximo aceito', async () => {
    renderPage();
    await flush();
    fireEvent.click(screen.getByText('Ajustar'));
    fireEvent.change(screen.getByLabelText('Foco'), {
      target: { value: '9999' },
    });

    expect(screen.getByText(/Focar 240 min/)).toBeInTheDocument();
  });

  it('histórico vazio mostra o estado vazio', async () => {
    vi.mocked(api.focusHistory).mockResolvedValue({
      sessions: [],
      totalMinutes: 0,
    } as never);
    vi.mocked(api.focusBySubject).mockResolvedValue([] as never);
    renderPage();
    await flush();

    expect(screen.getByText('Nenhuma sessão ainda')).toBeInTheDocument();
  });
});
