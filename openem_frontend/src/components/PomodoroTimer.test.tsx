// Testes do card Modo Foco na Home (issue #41).
// Fake timers + flush manual de microtasks (o RTL waitFor depende de timers
// reais, então usamos queries síncronas após avançar os timers).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PomodoroTimer } from './PomodoroTimer';
import { PomodoroProvider } from '../pomodoro';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    focusToday: vi.fn(),
    subjects: vi.fn(),
    completeFocusSession: vi.fn(),
  },
}));

const SUBJECTS = [
  { id: 's1', name: 'Matemática e suas Tecnologias', topics: [] },
];

/** Resolve as microtasks pendentes (promises mockadas) dentro do act. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Tick async: processa timers re-agendados (chain de setTimeout) + effects. */
async function tickAsync(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderTimer() {
  return render(
    <MemoryRouter>
      <PomodoroProvider>
        <PomodoroTimer />
      </PomodoroProvider>
    </MemoryRouter>,
  );
}

describe('PomodoroTimer (issue #41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); // a sessão é persistida entre renders
    vi.useFakeTimers();
    vi.mocked(api.focusToday).mockResolvedValue({ minutes: 0 });
    vi.mocked(api.subjects).mockResolvedValue(SUBJECTS as never);
    vi.mocked(api.completeFocusSession).mockResolvedValue({
      id: 'fs1',
      subjectId: 's1',
      subjectName: 'Matemática',
      durationSec: 1500,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('idle: mostra minutos de hoje e select de matéria', async () => {
    renderTimer();
    await flush();
    expect(screen.getByText('Pomodoro')).toBeInTheDocument();
    expect(screen.getByText('0 min de foco hoje')).toBeInTheDocument();
    expect(screen.getByLabelText('Matéria da sessão')).toBeInTheDocument();
    expect(screen.getByText(/Focar 25 min/)).toBeInTheDocument();
  });

  it('focando: cronômetro decresce e permite pausar', async () => {
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));

    expect(screen.getByText('25:00')).toBeInTheDocument();
    await tickAsync(2000);
    expect(screen.getByText('24:58')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pausar'));
    await tickAsync(5000);
    expect(screen.getByText('24:58')).toBeInTheDocument(); // pausado não anda
    expect(screen.getByText('Retomar')).toBeInTheDocument();
  });

  it('retomar continua de onde parou', async () => {
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));

    await tickAsync(60_000);
    fireEvent.click(screen.getByText('Pausar'));
    await tickAsync(30_000); // tempo parado não conta
    fireEvent.click(screen.getByText('Retomar'));
    await tickAsync(10_000);

    expect(screen.getByText('23:50')).toBeInTheDocument();
  });

  it('ao zerar registra a sessão e entra em pausa com feedback', async () => {
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));

    await tickAsync(25 * 60_000); // completa os 25 min
    await flush();

    expect(api.completeFocusSession).toHaveBeenCalledWith(
      expect.objectContaining({ durationSec: 1500 }),
    );
    expect(screen.getByText(/Sessão registrada/)).toBeInTheDocument();
  });

  it('registra a sessão uma única vez ao zerar', async () => {
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));

    await tickAsync(25 * 60_000 + 5000);
    await flush();

    expect(api.completeFocusSession).toHaveBeenCalledTimes(1);
  });

  it('registro envia a matéria selecionada', async () => {
    renderTimer();
    await flush();
    fireEvent.change(screen.getByLabelText('Matéria da sessão'), {
      target: { value: 's1' },
    });
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(25 * 60_000);
    await flush();

    expect(api.completeFocusSession).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 's1', durationSec: 1500 }),
    );
  });

  it('falha ao registrar mostra a pausa sem quebrar (silencioso)', async () => {
    vi.mocked(api.completeFocusSession).mockRejectedValue(new Error('offline'));
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(25 * 60_000);
    await flush();

    // Entra na pausa mesmo com falha no registro (não mostra "registrada").
    expect(screen.getByText(/Pausa de 5 minutos/)).toBeInTheDocument();
  });

  it('a pausa também roda e volta ao estado ocioso ao zerar', async () => {
    renderTimer();
    await flush();
    fireEvent.click(screen.getByText(/Focar 25 min/));
    await tickAsync(25 * 60_000);
    await flush();

    expect(screen.getByText('5:00')).toBeInTheDocument();
    await tickAsync(5 * 60_000);
    await flush();

    // De volta ao início: o botão de começar reaparece.
    expect(screen.getByText(/Focar 25 min/)).toBeInTheDocument();
  });
});
