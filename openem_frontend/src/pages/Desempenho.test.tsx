import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesempenhoSemanal, SemanaDeEstudo } from '../api';

const { performanceWeeks, performanceHeatmap, gamificacao } = vi.hoisted(() => ({
  performanceWeeks: vi.fn(),
  performanceHeatmap: vi.fn(),
  gamificacao: { ligada: true },
}));
vi.mock('../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api')>();
  return { ...original, api: { ...original.api, performanceWeeks, performanceHeatmap } };
});

vi.mock('../gamification', () => ({
  useGamification: () => ({
    summary: { enabled: gamificacao.ligada },
    refresh: async () => {},
  }),
}));

import Desempenho from './Desempenho';

function semana(start: string, dias: Partial<SemanaDeEstudo['days'][number]>[], extra: Partial<SemanaDeEstudo> = {}): SemanaDeEstudo {
  const [y, m, d] = start.split('-').map(Number);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    return { date, answers: 0, correct: 0, minutes: 0, studied: false, ...dias[i] };
  });
  const answers = days.reduce((s, x) => s + x.answers, 0);
  const correct = days.reduce((s, x) => s + x.correct, 0);
  return {
    start,
    end: days[6].date,
    days,
    answers,
    correct,
    accuracy: answers ? Math.round((correct / answers) * 100) : null,
    minutes: days.reduce((s, x) => s + x.minutes, 0),
    daysStudied: days.filter((x) => x.studied).length,
    areas: [
      { area: 'mat', answers: 5, correct: 4, accuracy: 80 },
      { area: 'nat', answers: 8, correct: 2, accuracy: 25 },
      { area: 'hum', answers: 0, correct: 0, accuracy: null },
      { area: 'lin', answers: 6, correct: 5, accuracy: 83 },
    ],
    delta: null,
    ...extra,
  };
}

const DADOS: DesempenhoSemanal = {
  today: '2026-10-21',
  weeks: [
    semana('2026-10-19', [{ answers: 10, correct: 7, minutes: 25, studied: true }, {}, { answers: 15, correct: 10, studied: true }], { delta: 18 }),
    semana('2026-10-12', [{ answers: 20, correct: 10, minutes: 45, studied: true }], { delta: -13 }),
  ],
  priorities: [
    { topicId: 't 1', topic: 'Estequiometria', subject: 'Química', area: 'nat', answers: 6, correct: 0, accuracy: 0, weight: 5 },
  ],
  unclassified: 12,
  streak: 2,
  goalMinutesPerDay: 90,
};

function renderizar() {
  return render(
    <MemoryRouter>
      <Desempenho />
    </MemoryRouter>,
  );
}

describe('Desempenho semana a semana', () => {
  beforeEach(() => {
    performanceWeeks.mockReset();
    performanceHeatmap.mockReset();
    gamificacao.ligada = true;
  });

  it('mostra a semana atual contra a meta, os dias e o acerto por área', async () => {
    performanceWeeks.mockResolvedValue(DADOS);
    renderizar();
    expect(await screen.findByRole('heading', { name: 'Esta semana' })).toBeInTheDocument();
    expect(screen.getByText(/meta de 1h30 por dia/)).toBeInTheDocument();
    expect(screen.getByText('19 a 25 out')).toBeInTheDocument();
    expect(screen.getByText(/de 630/)).toBeInTheDocument();
    expect(screen.getByLabelText(/segunda, 19 de out: estudou, 10 questões, 25 min de foco/)).toBeInTheDocument();
    expect(screen.getByLabelText(/quarta, 21 de out: hoje, estudou, 15 questões/)).toBeInTheDocument();
    expect(screen.getByLabelText(/terça, 20 de out: sem estudo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/quinta, 22 de out: ainda não chegou/)).toBeInTheDocument();
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sem questão').length).toBeGreaterThan(0);
    expect(screen.getByText('2 dias seguidos de estudo')).toBeInTheDocument();
    expect(performanceWeeks).toHaveBeenCalledWith(8);
  });

  it('prioridade leva a praticar o assunto e avisa as respostas sem assunto', async () => {
    performanceWeeks.mockResolvedValue(DADOS);
    renderizar();
    const praticar = await screen.findByRole('link', { name: 'Praticar Estequiometria' });
    expect(praticar).toHaveAttribute('href', '/questoes?topicId=t%201');
    expect(screen.getByText(/0 de 6 certas/)).toBeInTheDocument();

    expect(screen.getByText('Cai muito na prova')).toBeInTheDocument();
    expect(screen.getByText(/12 respostas do último mês/)).toBeInTheDocument();
  });

  it('semanas anteriores mostram a variação com sinal', async () => {
    performanceWeeks.mockResolvedValue(DADOS);
    renderizar();
    expect(await screen.findByRole('heading', { name: 'Semanas anteriores' })).toBeInTheDocument();
    expect(screen.getByText('12 a 18 out')).toBeInTheDocument();
    expect(screen.getByText('−13 p.p.')).toBeInTheDocument();
  });

  it('o atalho para Progresso some com a gamificação desligada', async () => {
    performanceWeeks.mockResolvedValue(DADOS);
    const { unmount } = renderizar();
    expect(await screen.findByRole('link', { name: /Nível e conquistas/ })).toHaveAttribute('href', '/progresso');
    unmount();
    gamificacao.ligada = false;
    renderizar();
    await screen.findByRole('heading', { name: 'Esta semana' });
    expect(screen.queryByRole('link', { name: /Nível e conquistas/ })).toBeNull();
  });

  it('sem nenhuma atividade mostra o começo, com caminho para estudar', async () => {
    performanceWeeks.mockResolvedValue({
      ...DADOS,
      weeks: [semana('2026-10-19', []), semana('2026-10-12', [])],
      priorities: [],
      unclassified: 0,
      streak: 0,
    });
    renderizar();
    expect(await screen.findByText('Sua primeira semana começa agora')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Questões' })).toHaveAttribute('href', '/questoes');
  });

  it('erro de rede oferece tentar de novo, e tentar de novo carrega', async () => {
    performanceWeeks.mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValueOnce(DADOS);
    renderizar();
    expect(await screen.findByText('Sem conexão')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Esta semana' })).toBeInTheDocument());
    expect(performanceWeeks).toHaveBeenCalledTimes(2);
  });

  it('todos os assuntos só carregam quando o aluno abre', async () => {
    performanceWeeks.mockResolvedValue(DADOS);
    performanceHeatmap.mockResolvedValue([]);
    renderizar();
    const abrir = await screen.findByRole('button', { name: 'Abrir' });
    expect(performanceHeatmap).not.toHaveBeenCalled();
    fireEvent.click(abrir);
    expect(performanceHeatmap).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveAttribute('aria-expanded', 'true');
  });
});
