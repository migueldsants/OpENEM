// Testes da tela de cronômetros e timers, e do aviso de fim de timer.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Cronometros from './Cronometros';
import { TimerAlarme } from '../components/TimerAlarme';
import { relogios } from '../relogios';
import { chime } from '../sound';

vi.mock('../sound', () => ({ chime: vi.fn() }));

const KEY = 'openem.relogios';

function avancar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TimerAlarme />
      <Cronometros />
    </MemoryRouter>,
  );
}

function clicar(nome: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: nome }));
}

function criarTimer(min: string, seg: string, nome = '') {
  clicar('Timer');
  fireEvent.change(screen.getByLabelText('Minutos'), {
    target: { value: min },
  });
  fireEvent.change(screen.getByLabelText('Segundos'), {
    target: { value: seg },
  });
  if (nome) {
    fireEvent.change(screen.getByLabelText('Nome (opcional)'), {
      target: { value: nome },
    });
  }
  clicar('Criar timer');
}

describe('Cronometros', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 14, 0, 0));
    vi.clearAllMocks();
    localStorage.clear();
    act(() => relogios.recarregar());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('começa vazia, com a orientação de criar um relógio', () => {
    renderPage();
    expect(screen.getByText('Nenhum relógio ainda')).toBeInTheDocument();
  });

  it('cronômetro: inicia, marca voltas, pausa, retoma e zera', () => {
    renderPage();
    clicar('Cronômetro');
    const visor = screen.getByRole('timer', { name: 'Cronômetro 1' });
    expect(visor).toHaveTextContent('0:00.0');

    clicar('Iniciar');
    avancar(2_500);
    expect(visor).toHaveTextContent('0:02.5');

    clicar('Volta');
    avancar(1_500);
    clicar('Volta');
    const voltas = within(screen.getByLabelText('Voltas de Cronômetro 1'));
    expect(voltas.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['Volta 20:01.50:04.0', 'Volta 10:02.50:02.5'],
    );

    clicar('Pausar');
    avancar(30_000);
    expect(visor).toHaveTextContent('0:04.0');
    expect(screen.queryByRole('button', { name: 'Volta' })).toBeNull();

    clicar('Retomar');
    avancar(1_000);
    expect(visor).toHaveTextContent('0:05.0');

    clicar('Zerar');
    expect(visor).toHaveTextContent('0:00.0');
    expect(screen.queryByLabelText('Voltas de Cronômetro 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
  });

  it('timer: conta para baixo, toca uma vez no fim e reinicia', () => {
    renderPage();
    criarTimer('0', '10', 'Intervalo');
    const visor = screen.getByRole('timer', { name: 'Intervalo' });
    expect(visor).toHaveTextContent('0:10');
    expect(screen.getByText('Timer de 10 s')).toBeInTheDocument();

    clicar('Iniciar');
    expect(screen.getByText('Termina às 14:00')).toBeInTheDocument();
    avancar(4_000);
    expect(visor).toHaveTextContent('0:06');
    expect(chime).not.toHaveBeenCalled();

    avancar(6_100);
    expect(visor).toHaveTextContent('0:00');
    expect(screen.getByText('Tempo esgotado')).toBeInTheDocument();
    expect(chime).toHaveBeenCalledTimes(1);
    avancar(5_000);
    expect(chime).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();

    clicar('Reiniciar');
    expect(visor).toHaveTextContent('0:10');
    clicar('Iniciar');
    avancar(10_100);
    expect(chime).toHaveBeenCalledTimes(2);
  });

  it('dá nome ao timer pela duração e aceita os atalhos', () => {
    renderPage();
    clicar('Timer');
    clicar('15 min');
    clicar('Criar timer');
    expect(
      screen.getByRole('timer', { name: 'Timer de 15 min' }),
    ).toHaveTextContent('15:00');
  });

  it('não cria timer de duração zero e deixa cancelar', () => {
    renderPage();
    clicar('Timer');
    fireEvent.change(screen.getByLabelText('Minutos'), {
      target: { value: '0' },
    });
    expect(screen.getByRole('button', { name: 'Criar timer' })).toBeDisabled();
    clicar('Cancelar');
    expect(screen.queryByText('Novo timer')).toBeNull();
    expect(screen.getByText('Nenhum relógio ainda')).toBeInTheDocument();
  });

  it('corre vários relógios ao mesmo tempo, cada um no seu tempo', () => {
    renderPage();
    clicar('Cronômetro');
    clicar('Cronômetro');
    const [iniciarA, iniciarB] = screen.getAllByRole('button', {
      name: 'Iniciar',
    });
    fireEvent.click(iniciarA);
    avancar(3_000);
    fireEvent.click(iniciarB);
    avancar(2_000);
    expect(screen.getByRole('timer', { name: 'Cronômetro 1' })).toHaveTextContent(
      '0:05.0',
    );
    expect(screen.getByRole('timer', { name: 'Cronômetro 2' })).toHaveTextContent(
      '0:02.0',
    );
  });

  it('renomeia e remove um relógio', () => {
    renderPage();
    clicar('Cronômetro');
    const nome = screen.getByLabelText('Nome de Cronômetro 1');
    fireEvent.change(nome, { target: { value: 'Matemática' } });
    expect(screen.getByRole('timer', { name: 'Matemática' })).toBeInTheDocument();

    // Nome apagado volta para o padrão ao sair do campo.
    fireEvent.change(nome, { target: { value: '  ' } });
    fireEvent.blur(nome);
    expect(screen.getByRole('timer', { name: 'Cronômetro' })).toBeInTheDocument();

    clicar('Remover Cronômetro');
    expect(screen.getByText('Nenhum relógio ainda')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
  });

  it('continua contando depois de sair da tela e voltar', () => {
    const { unmount } = renderPage();
    clicar('Cronômetro');
    clicar('Iniciar');
    avancar(1_000);
    unmount();

    vi.advanceTimersByTime(60_000);
    act(() => relogios.recarregar());
    renderPage();
    expect(screen.getByRole('timer', { name: 'Cronômetro 1' })).toHaveTextContent(
      '1:01.0',
    );
  });

  it('o timer toca mesmo com a tela de cronômetros fechada', () => {
    const { unmount } = renderPage();
    criarTimer('0', '30');
    clicar('Iniciar');
    unmount();

    render(<TimerAlarme />);
    avancar(29_000);
    expect(chime).not.toHaveBeenCalled();
    avancar(1_100);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('avisa ao abrir o app se o timer acabou enquanto ele estava fechado', () => {
    const { unmount } = renderPage();
    criarTimer('1', '0');
    clicar('Iniciar');
    unmount();
    vi.advanceTimersByTime(5 * 60_000);

    render(<TimerAlarme />);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('trava a criação no limite de relógios', () => {
    renderPage();
    for (let i = 0; i < 12; i++) clicar('Cronômetro');
    expect(screen.getByRole('button', { name: 'Cronômetro' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Timer' })).toBeDisabled();
    expect(screen.getByText(/limite de 12 relógios/)).toBeInTheDocument();
    expect(screen.getAllByRole('timer')).toHaveLength(12);
  });
});
