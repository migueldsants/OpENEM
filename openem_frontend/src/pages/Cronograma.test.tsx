// Testes do Cronograma customizável (issue #46).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Cronograma from './Cronograma';
import { api, HttpError } from '../api';
import type { StudyPlan, StudySession } from '../api';

vi.mock('../api', () => {
  class HttpError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
      this.name = 'HttpError';
    }
  }
  return {
    HttpError,
    api: {
      studyPlan: vi.fn(),
      generateStudyPlan: vi.fn(),
      clearStudyPlan: vi.fn(),
      addSession: vi.fn(),
      updateSession: vi.fn(),
      removeSession: vi.fn(),
      updateProfile: vi.fn(),
      subjects: vi.fn(),
    },
  };
});
vi.mock('../auth', () => ({
  useAuth: () => ({
    me: { profile: { minutesPerDay: 60 } },
    refreshMe: vi.fn(),
  }),
}));
vi.mock('../gamification', () => ({
  useGamification: () => ({ refresh: vi.fn(), summary: null }),
}));

const MAT = { id: 'subj-mat', name: 'Matemática' };

function session(over: Partial<StudySession> = {}): StudySession {
  return {
    id: 's1',
    label: 'Matemática',
    dayIndex: 0,
    minutes: 45,
    done: false,
    position: 0,
    subject: MAT,
    ...over,
  };
}

/** Plano iniciado hoje: dia 0 é hoje (para o card "Hoje" aparecer). */
function makePlan(sessions?: StudySession[]): StudyPlan {
  return {
    id: 'plan-1',
    minutesPerDay: 60,
    createdAt: new Date().toISOString(),
    sessions: sessions ?? [
      session(),
      session({ id: 's2', label: 'Física', minutes: 45, position: 1 }),
      session({ id: 's3', label: 'Biologia', dayIndex: 1, done: true }),
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Cronograma />
    </MemoryRouter>,
  );
}

describe('Cronograma — calendário customizável (issue #46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.subjects).mockResolvedValue([
      { id: MAT.id, name: MAT.name, topics: [] },
    ] as never);
  });

  it('mostra os blocos pelo nome, sem subtópicos', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    renderPage();

    // O nome do bloco é a matéria, não "Acústica"/"Análise combinatória".
    expect(
      await screen.findByRole('button', { name: 'Concluir Física' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Renomear Matemática' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Renomear Biologia' }),
    ).toBeInTheDocument();
  });

  it('renderiza os 7 dias da semana mesmo com dias vazios', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan([session()]));
    renderPage();

    await screen.findByRole('button', { name: 'Renomear Matemática' });
    const adicionar = screen.getAllByRole('button', {
      name: /Adicionar bloco em/,
    });
    expect(adicionar).toHaveLength(7);
  });

  it('adiciona um bloco com nome livre', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    vi.mocked(api.addSession).mockResolvedValue(
      session({ id: 's9', label: 'Inglês', subject: null }),
    );
    renderPage();

    const botoes = await screen.findAllByRole('button', {
      name: /Adicionar bloco em/,
    });
    fireEvent.click(botoes[2]);
    const campo = await screen.findByLabelText(/^Adicionar em/);
    fireEvent.change(campo, { target: { value: 'Inglês' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    // O nome é livre: não precisa ser matéria do ENEM.
    await waitFor(() =>
      expect(api.addSession).toHaveBeenCalledWith('Inglês', 2),
    );
  });

  it('renomeia um bloco clicando nele', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan([session()]));
    vi.mocked(api.updateSession).mockResolvedValue(
      session({ label: 'Revisar simulado', subject: null }),
    );
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Renomear Matemática' }),
    );
    const campo = await screen.findByLabelText('Nome do bloco Matemática');
    fireEvent.change(campo, { target: { value: 'Revisar simulado' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    await waitFor(() =>
      expect(api.updateSession).toHaveBeenCalledWith('s1', {
        label: 'Revisar simulado',
      }),
    );
  });

  it('remove um bloco', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan([session()]));
    vi.mocked(api.removeSession).mockResolvedValue({ removed: true });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Renomear Matemática' }),
    );
    fireEvent.click(await screen.findByLabelText('Remover Matemática'));

    await waitFor(() => expect(api.removeSession).toHaveBeenCalledWith('s1'));
  });

  it('altera a duração de um bloco', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan([session()]));
    vi.mocked(api.updateSession).mockResolvedValue(session({ minutes: 90 }));
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Renomear Matemática' }),
    );
    fireEvent.change(await screen.findByLabelText('Duração de Matemática'), {
      target: { value: '90' },
    });

    await waitFor(() =>
      expect(api.updateSession).toHaveBeenCalledWith('s1', { minutes: 90 }),
    );
  });

  it('conclui um bloco', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan([session()]));
    vi.mocked(api.updateSession).mockResolvedValue(session({ done: true }));
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Concluir Matemática' }),
    );
    await waitFor(() =>
      expect(api.updateSession).toHaveBeenCalledWith('s1', { done: true }),
    );
  });

  it('limpar exige confirmação em dois passos', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    vi.mocked(api.clearStudyPlan).mockResolvedValue(makePlan([]));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Limpar' }));
    expect(api.clearStudyPlan).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar — apaga tudo/ }),
    );
    await waitFor(() => expect(api.clearStudyPlan).toHaveBeenCalled());
  });

  it('gerar sobre um plano existente exige confirmação', async () => {
    vi.mocked(api.studyPlan).mockResolvedValue(makePlan());
    vi.mocked(api.generateStudyPlan).mockResolvedValue(makePlan());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Gerar semana' }));
    expect(api.generateStudyPlan).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /Confirmar — substitui a semana/ }),
    );
    await waitFor(() => expect(api.generateStudyPlan).toHaveBeenCalled());
  });

  it('sem plano oferece gerar ou começar do zero', async () => {
    vi.mocked(api.studyPlan).mockRejectedValue(new HttpError(404, 'no plan'));
    renderPage();

    expect(await screen.findByText('Monte sua semana')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Começar do zero/ }),
    ).toBeInTheDocument();
  });

  it('erro de rede não se disfarça de "sem cronograma"', async () => {
    vi.mocked(api.studyPlan).mockRejectedValue(new HttpError(500, 'Boom'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
    expect(screen.queryByText('Monte sua semana')).not.toBeInTheDocument();
  });

  it('minutos fora da faixa do backend bloqueiam a geração', async () => {
    vi.mocked(api.studyPlan).mockRejectedValue(new HttpError(404, 'no plan'));
    renderPage();

    await screen.findByText('Monte sua semana');
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });

    expect(screen.getByText(/Entre 5 e 1440 minutos/)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', { name: 'Gerar cronograma' })
        .some((b) => (b as HTMLButtonElement).disabled),
    ).toBe(true);
    expect(api.generateStudyPlan).not.toHaveBeenCalled();
  });

  it('avisa quando o cronograma já terminou', async () => {
    const plan = makePlan();
    plan.createdAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    vi.mocked(api.studyPlan).mockResolvedValue(plan);
    renderPage();

    expect(
      await screen.findByText('Este cronograma já terminou'),
    ).toBeInTheDocument();
  });
});
