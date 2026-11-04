// Testes do pop-up flutuante do Pomodoro (issue #41).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PomodoroFloating } from './PomodoroFloating';
import { PomodoroTimer } from './PomodoroTimer';
import { PomodoroProvider } from '../pomodoro';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    focusToday: vi.fn(),
    subjects: vi.fn(),
    completeFocusSession: vi.fn(),
    startFocusSession: vi.fn(),
  },
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function tickAsync(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Card da Home + pop-up sob o mesmo provider: é assim que o app monta. */
function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PomodoroProvider>
        <PomodoroTimer />
        <PomodoroFloating />
      </PomodoroProvider>
    </MemoryRouter>,
  );
}

const popup = () => screen.queryByLabelText('Cronômetro Pomodoro');

describe('PomodoroFloating (issue #41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    vi.mocked(api.focusToday).mockResolvedValue({ minutes: 0 });
    vi.mocked(api.subjects).mockResolvedValue([] as never);
    vi.mocked(api.startFocusSession).mockResolvedValue({
      id: 'fs1',
      subjectId: null,
      subjectName: null,
      durationSec: 1500,
      startedAt: new Date().toISOString(),
    });
    vi.mocked(api.completeFocusSession).mockResolvedValue({
      id: 'fs1',
      subjectId: null,
      subjectName: null,
      durationSec: 1500,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fica escondido enquanto o timer está ocioso', async () => {
    renderApp();
    await flush();
    expect(popup()).not.toBeInTheDocument();
  });

  it('aparece com o relógio ao iniciar um ciclo', async () => {
    renderApp();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(60_000);

    expect(popup()).toBeInTheDocument();
    expect(screen.getByText('Focando')).toBeInTheDocument();
    // O relógio aparece no card e no pop-up.
    expect(screen.getAllByText('24:00').length).toBe(2);
  });

  it('minimiza para uma pílula e volta a expandir', async () => {
    renderApp();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(1000);

    fireEvent.click(screen.getByLabelText('Minimizar cronômetro'));
    expect(popup()).not.toBeInTheDocument();

    const pill = screen.getByLabelText(/Abrir o cronômetro/);
    fireEvent.click(pill);
    expect(popup()).toBeInTheDocument();
  });

  it('pausa e retoma pelo pop-up', async () => {
    renderApp();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(60_000);

    // O card e o pop-up têm o mesmo botão; o do pop-up é o segundo.
    fireEvent.click(screen.getAllByText('Pausar')[1]);
    await tickAsync(30_000);
    expect(screen.getByText('Foco pausado')).toBeInTheDocument();
    expect(screen.getAllByText('24:00').length).toBe(2); // parado

    fireEvent.click(screen.getAllByText('Retomar')[1]);
    await tickAsync(10_000);
    expect(screen.getAllByText('23:50').length).toBe(2);
  });

  it('some na própria tela do Pomodoro (o relógio grande já está lá)', async () => {
    renderApp('/pomodoro');
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(1000);

    expect(popup()).not.toBeInTheDocument();
  });
});
